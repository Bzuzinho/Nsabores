import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';

export type CommerceIdentity = {
  userId?: string;
  sessionId: string;
};

@Injectable()
export class CommerceIdentityService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolve(
    request: Request,
    response: Response,
  ): Promise<CommerceIdentity> {
    const token = request.cookies?.nsabores_access as string | undefined;
    let userId: string | undefined;
    if (token) {
      try {
        const principal = await this.jwt.verifyAsync<AuthPrincipal>(token);
        const user = await this.prisma.user.findFirst({
          where: { id: principal.sub, isActive: true },
          select: { id: true },
        });
        userId = user?.id;
      } catch {
        userId = undefined;
      }
    }

    let sessionId = request.cookies?.nsabores_cart as string | undefined;
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      sessionId = randomUUID();
      response.cookie('nsabores_cart', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.get<boolean>('AUTH_COOKIE_SECURE') ?? false,
        domain: this.config.get<string>('AUTH_COOKIE_DOMAIN') || undefined,
        maxAge: 1000 * 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    return { userId, sessionId };
  }
}
