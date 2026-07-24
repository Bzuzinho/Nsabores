import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AdminApiKeyGuard } from './admin-api-key.guard';

const context = (key?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ header: () => key }) }),
  }) as never;

describe('AdminApiKeyGuard', () => {
  const guard = new AdminApiKeyGuard({
    get: () => 'development-key-123456',
  } as never);

  it('accepts only the configured key', () => {
    expect(guard.canActivate(context('development-key-123456'))).toBe(true);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('invalid'))).toThrow(
      UnauthorizedException,
    );
  });
});
