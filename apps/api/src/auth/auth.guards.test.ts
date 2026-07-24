import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard, RolesGuard } from './auth.guards';

const context = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => null,
    getClass: () => null,
  }) as never;

describe('authentication guards', () => {
  it('rejects missing sessions and inactive accounts', async () => {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'one' }) };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ isActive: false }) },
    };
    const guard = new AuthGuard(jwt as never, prisma as never);
    await expect(
      guard.canActivate(context({ cookies: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(context({ cookies: { nsabores_access: 'token' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces STAFF and ADMIN roles', () => {
    const reflector = {
      getAllAndOverride: vi
        .fn()
        .mockReturnValue([UserRole.STAFF, UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as never);
    expect(() =>
      guard.canActivate(context({ user: { role: UserRole.CUSTOMER } })),
    ).toThrow(ForbiddenException);
    expect(guard.canActivate(context({ user: { role: UserRole.ADMIN } }))).toBe(
      true,
    );
  });
});
