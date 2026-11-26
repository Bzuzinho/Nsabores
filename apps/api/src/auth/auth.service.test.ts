import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    customer: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (operations: unknown) => {
      if (typeof operations === 'function') {
        return (operations as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(operations as unknown[]);
    }),
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
    prisma.customer.findFirst.mockResolvedValue(null);
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
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          email: user.email,
          name: 'Ana Silva',
        }) as unknown,
      }),
    );
    expect(mail.sendEmailVerification).toHaveBeenCalled();
    expect(prisma.businessAccountUser.upsert).not.toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  const registration = {
    email: user.email,
    password: 'Password123',
    firstName: 'Ana',
    lastName: 'Silva',
  };

  it('does not change existing accounts or create a duplicate commercial record', async () => {
    const { service, prisma, response, mail } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });
    await expect(
      service.register(registration, { headers: {} }, response as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(mail.sendEmailVerification).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('does not attach an existing customer by email before verified activation', async () => {
    const { service, prisma, response } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.customer.findFirst.mockResolvedValue({ id: 'existing-customer' });
    await expect(
      service.register(registration, { headers: {} }, response as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('handles a real Prisma uniqueness error from concurrent registration', async () => {
    const { service, prisma, response, mail } = setup();
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.register(registration, { headers: {} }, response as never),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(mail.sendEmailVerification).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('activates a verified account without creating or changing a user', async () => {
    const { service, prisma } = setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      customerProfile: null,
    });
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.activateCustomer(user.id)).resolves.toEqual({
      success: true,
    });
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          email: user.email,
          marketingConsent: false,
        }) as unknown,
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each([
    { emailVerifiedAt: null },
    { isActive: false },
    { deletedAt: new Date() },
  ])('rejects activation for an ineligible account (%j)', async (override) => {
    const { service, prisma } = setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date(),
      ...override,
    });
    await expect(service.activateCustomer(user.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('refuses to claim a commercial record based only on email', async () => {
    const { service, prisma } = setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date(),
    });
    prisma.customer.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.activateCustomer(user.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('returns a conflict if another request creates the customer first', async () => {
    const { service, prisma } = setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date(),
    });
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.activateCustomer(user.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not attach an unlinked commercial record via profile editing', async () => {
    const { service, prisma } = setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date(),
    });
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.updateProfile(user.id, {
        firstName: 'Ana',
        lastName: 'Silva',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('is idempotent for a linked active customer', async () => {
    const { service, prisma } = setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date(),
    });
    prisma.customer.findUnique.mockResolvedValue({
      id: 'linked',
      isActive: true,
      deletedAt: null,
    });
    await expect(service.activateCustomer(user.id)).resolves.toEqual({
      success: true,
    });
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('does not reactivate a disabled commercial record', async () => {
    const { service, prisma } = setup();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date(),
    });
    prisma.customer.findUnique.mockResolvedValue({
      id: 'linked',
      isActive: false,
      deletedAt: null,
    });
    await expect(service.activateCustomer(user.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.customer.update).not.toHaveBeenCalled();
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
