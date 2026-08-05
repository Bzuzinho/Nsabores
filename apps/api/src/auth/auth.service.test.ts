import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { AuthService } from './auth.service';

vi.mock('argon2', () => ({
  default: {
    argon2id: 2,
    hash: vi.fn().mockResolvedValue('argon-hash'),
    verify: vi.fn(),
  },
}));

const user = {
  id: 'user-id',
  email: 'ana@example.com',
  passwordHash: 'argon-hash',
  firstName: 'Ana',
  lastName: 'Silva',
  phone: null,
  role: 'CUSTOMER',
  isActive: true,
  emailVerifiedAt: null,
  lastLoginAt: null,
  passwordResetTokenHash: null,
  passwordResetExpiresAt: null,
  emailVerificationTokenHash: null,
  emailVerificationExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup() {
  const prisma = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    businessAccount: { findFirst: vi.fn() },
    businessAccountUser: { upsert: vi.fn().mockResolvedValue({}) },
    authSession: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn(),
    },
    customerProfile: { findUnique: vi.fn() },
    $transaction: vi.fn(async (operations: unknown[]) =>
      Promise.all(operations),
    ),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('access-token') };
  const config = {
    get: vi.fn((key: string) => {
      const values: Record<string, string> = {
        AUTH_ACCESS_TOKEN_TTL: '15m',
        AUTH_REFRESH_TOKEN_TTL: '30d',
        PASSWORD_RESET_TOKEN_TTL: '1h',
        EMAIL_VERIFICATION_TOKEN_TTL: '24h',
        AUTH_COOKIE_SECURE: 'false',
      };
      return values[key];
    }),
  };
  const mail = {
    sendPasswordReset: vi.fn(),
    sendEmailVerification: vi.fn(),
  };
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    mail as never,
  );
  return { service, prisma, jwt, mail, response };
}

describe('AuthService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers with a password hash, profile and secure cookies', async () => {
    const { service, prisma, response, mail } = setup();
    prisma.user.create.mockResolvedValue(user);
    await service.register(
      {
        email: user.email,
        password: 'Password123',
        firstName: 'Ana',
        lastName: 'Silva',
        marketingConsent: true,
      },
      { headers: {} },
      response as never,
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          passwordHash: 'argon-hash',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          customerProfile: expect.any(Object),
        }),
      }),
    );
    expect(mail.sendEmailVerification).toHaveBeenCalled();
    expect(prisma.businessAccountUser.upsert).not.toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  it('does not reveal the duplicated email', async () => {
    const { service, prisma, response } = setup();
    prisma.user.create.mockRejectedValue(
      Object.assign(new Error(), {
        code: 'P2002',
        name: 'PrismaClientKnownRequestError',
      }),
    );
    await expect(
      service.register(
        {
          email: user.email,
          password: 'Password123',
          firstName: 'Ana',
          lastName: 'Silva',
        },
        { headers: {} },
        response as never,
      ),
    ).rejects.toBeInstanceOf(Error);
  });

  it('associa a conta empresarial apenas depois de verificar o email', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.businessAccount.findFirst.mockResolvedValue({ id: 'business-id' });
    await service.verifyEmail('verification-token');
    expect(prisma.businessAccountUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          businessAccountId: 'business-id',
          userId: user.id,
          role: 'OWNER',
        }) as unknown,
      }),
    );
  });

  it('accepts valid login and rejects invalid credentials or inactive accounts', async () => {
    const { service, prisma, response } = setup();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);
    await expect(
      service.login(
        { email: user.email, password: 'Password123' },
        { headers: {} },
        response as never,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user: expect.objectContaining({ email: user.email }),
      }),
    );
    vi.mocked(argon2.verify).mockResolvedValueOnce(false);
    await expect(
      service.login(
        { email: user.email, password: 'wrong' },
        { headers: {} },
        response as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);
    await expect(
      service.login(
        { email: user.email, password: 'Password123' },
        { headers: {} },
        response as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh tokens and revokes the previous session', async () => {
    const { service, prisma, response } = setup();
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    await service.refresh('refresh-token', { headers: {} }, response as never);
    expect(prisma.authSession.update).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
    );
    expect(prisma.authSession.create).toHaveBeenCalled();
  });

  it('revokes logout and recovery sessions without enumerating accounts', async () => {
    const { service, prisma, response, mail } = setup();
    await service.logout('refresh-token', response as never);
    expect(prisma.authSession.updateMany).toHaveBeenCalled();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.forgotPassword('missing@example.com'),
    ).resolves.toEqual({
      message: 'Se a conta existir, receberá instruções de recuperação.',
    });
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });
});
