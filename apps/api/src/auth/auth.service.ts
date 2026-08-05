import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { MailProvider } from './mail.provider';
import type { AuthPrincipal, RequestWithAuth } from './auth.types';
import type {
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto';

const publicUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailProvider,
  ) {}

  async register(
    dto: RegisterDto,
    request: RequestWithAuth,
    response: Response,
  ) {
    const token = this.randomToken();
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: await this.hashPassword(dto.password),
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          emailVerificationTokenHash: this.hashToken(token),
          emailVerificationExpiresAt: this.expiry(
            'EMAIL_VERIFICATION_TOKEN_TTL',
            '24h',
          ),
          customerProfile: {
            create: {
              marketingConsent: dto.marketingConsent ?? false,
              marketingConsentAt: dto.marketingConsent ? new Date() : null,
            },
          },
        },
        select: publicUser,
      });
      this.mail.sendEmailVerification(user.email, token);
      await this.createSession(user, request, response);
      return { user };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Não foi possível criar a conta com estes dados.',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto, request: RequestWithAuth, response: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = user
      ? await argon2.verify(user.passwordHash, dto.password)
      : false;
    if (!valid || !user?.isActive) {
      throw new UnauthorizedException('Email ou password inválidos.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.createSession(user, request, response);
    return { user: this.toPublicUser(user) };
  }

  async refresh(
    refreshToken: string | undefined,
    request: RequestWithAuth,
    response: Response,
  ) {
    if (!refreshToken) throw new UnauthorizedException('Sessão inválida.');
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      this.clearCookies(response);
      throw new UnauthorizedException('Sessão inválida.');
    }
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await this.createSession(session.user, request, response);
    return { user: this.toPublicUser(session.user) };
  }

  async logout(refreshToken: string | undefined, response: Response) {
    if (refreshToken) {
      await this.prisma.authSession.updateMany({
        where: {
          refreshTokenHash: this.hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
    this.clearCookies(response);
    return { success: true };
  }

  async logoutAll(userId: string, response: Response) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.clearCookies(response);
    return { success: true };
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        ...publicUser,
        customerProfile: {
          select: { taxNumber: true, marketingConsent: true },
        },
      },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.isActive) {
      const token = this.randomToken();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: this.hashToken(token),
          passwordResetExpiresAt: this.expiry('PASSWORD_RESET_TOKEN_TTL', '1h'),
        },
      });
      this.mail.sendPasswordReset(user.email, token);
    }
    return {
      message: 'Se a conta existir, receberá instruções de recuperação.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: this.hashToken(dto.token),
        passwordResetExpiresAt: { gt: new Date() },
        isActive: true,
      },
    });
    if (!user) throw new UnauthorizedException('Token inválido ou expirado.');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await this.hashPassword(dto.password),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: this.hashToken(token),
        emailVerificationExpiresAt: { gt: new Date() },
      },
    });
    if (!user) throw new UnauthorizedException('Token inválido ou expirado.');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
    await this.linkApprovedBusinessAccount(user.id, user.email);
    return { success: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.emailVerifiedAt) {
      const token = this.randomToken();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationTokenHash: this.hashToken(token),
          emailVerificationExpiresAt: this.expiry(
            'EMAIL_VERIFICATION_TOKEN_TTL',
            '24h',
          ),
        },
      });
      this.mail.sendEmailVerification(user.email, token);
    }
    return { success: true };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const previous = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    const consentAt =
      dto.marketingConsent === true && !previous?.marketingConsent
        ? new Date()
        : dto.marketingConsent === false
          ? null
          : undefined;
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        customerProfile: {
          upsert: {
            create: {
              taxNumber: dto.taxNumber,
              marketingConsent: dto.marketingConsent ?? false,
              marketingConsentAt: consentAt,
            },
            update: {
              taxNumber: dto.taxNumber,
              marketingConsent: dto.marketingConsent,
              marketingConsentAt: consentAt,
            },
          },
        },
      },
      select: {
        ...publicUser,
        customerProfile: {
          select: { taxNumber: true, marketingConsent: true },
        },
      },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Password atual incorreta.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await this.hashPassword(newPassword) },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  sessions(userId: string) {
    return this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private async createSession(
    user: { id: string; email: string; role: UserRole },
    request: RequestWithAuth,
    response: Response,
  ) {
    const refreshToken = this.randomToken();
    const refreshExpires = this.expiry('AUTH_REFRESH_TOKEN_TTL', '30d');
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpires,
        userAgent:
          String(request.headers['user-agent'] ?? '').slice(0, 255) || null,
        ipAddress: request.ip?.slice(0, 64) ?? null,
      },
    });
    const principal: AuthPrincipal = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessExpires = this.expiry('AUTH_ACCESS_TOKEN_TTL', '15m');
    const accessToken = await this.jwt.signAsync(principal, {
      expiresIn: Math.max(
        1,
        Math.floor((accessExpires.getTime() - Date.now()) / 1000),
      ),
    });
    response.cookie(
      'nsabores_access',
      accessToken,
      this.cookieOptions(accessExpires),
    );
    response.cookie(
      'nsabores_refresh',
      refreshToken,
      this.cookieOptions(refreshExpires, '/v1/auth'),
    );
  }

  private cookieOptions(expires: Date, path = '/') {
    const domain = this.config.get<string>('AUTH_COOKIE_DOMAIN');
    return {
      httpOnly: true,
      secure:
        this.config.get('AUTH_COOKIE_SECURE') === true ||
        this.config.get('AUTH_COOKIE_SECURE') === 'true',
      sameSite: 'lax' as const,
      domain: domain || undefined,
      path,
      expires,
    };
  }

  private clearCookies(response: Response) {
    const options = this.cookieOptions(new Date(0));
    response.clearCookie('nsabores_access', options);
    response.clearCookie('nsabores_refresh', { ...options, path: '/v1/auth' });
  }

  private hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: Number(this.config.get('AUTH_ARGON2_MEMORY_COST') ?? 19456),
      timeCost: Number(this.config.get('AUTH_ARGON2_TIME_COST') ?? 2),
      parallelism: 1,
    });
  }

  private randomToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiry(key: string, fallback: string) {
    const raw = this.config.get<string>(key) ?? fallback;
    const match = /^(\d+)(m|h|d)$/.exec(raw);
    if (!match) throw new Error(`Invalid duration in ${key}`);
    const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]!]!;
    return new Date(Date.now() + Number(match[1]) * unit);
  }

  private async linkApprovedBusinessAccount(userId: string, email: string) {
    const businessAccount = await this.prisma.businessAccount.findFirst({
      where: { businessEmail: email, status: 'APPROVED' },
      select: { id: true },
    });
    if (!businessAccount) return;
    await this.prisma.businessAccountUser.upsert({
      where: {
        businessAccountId_userId: {
          businessAccountId: businessAccount.id,
          userId,
        },
      },
      create: {
        businessAccountId: businessAccount.id,
        userId,
        role: 'OWNER',
      },
      update: { isActive: true },
    });
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: UserRole;
    isActive: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}
