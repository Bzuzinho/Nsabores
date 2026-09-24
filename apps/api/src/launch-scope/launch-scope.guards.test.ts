import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AutomaticPaymentGuard } from './automatic-payment.guard';
import { DeferredFeatureGuard } from './deferred-feature.guard';

function config(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('launch scope guards', () => {
  it('permite funcionalidades adiadas por defeito em desenvolvimento e testes', () => {
    const guard = new DeferredFeatureGuard(config({}));
    expect(guard.canActivate()).toBe(true);
  });

  it('bloqueia funcionalidades adiadas quando o arranque está restrito', () => {
    const guard = new DeferredFeatureGuard(
      config({ DEFERRED_FEATURES_ENABLED: false }),
    );
    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('bloqueia pagamentos online em modo manual', () => {
    const guard = new AutomaticPaymentGuard(
      config({ PAYMENT_FLOW_MODE: 'manual' }),
    );
    expect(() => guard.canActivate()).toThrow(ConflictException);
  });

  it('permite pagamentos online apenas em modo automatic', () => {
    const guard = new AutomaticPaymentGuard(
      config({ PAYMENT_FLOW_MODE: 'automatic' }),
    );
    expect(guard.canActivate()).toBe(true);
  });
});
