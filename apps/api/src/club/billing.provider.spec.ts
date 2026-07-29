import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ClubBillingProvider } from './billing.provider';

const config = {
  get: (key: string) => {
    if (key === 'CLUB_BILLING_PROVIDER') return 'mock';
    if (key === 'CLUB_BILLING_WEBHOOK_SECRET') return '';
    return undefined;
  },
} as unknown as ConfigService;

describe('ClubBillingProvider', () => {
  const provider = new ClubBillingProvider(config);

  it('keeps monthly periods on the last valid calendar day', () => {
    const next = provider.nextPeriod(
      new Date('2026-01-31T10:30:00.000Z'),
      'MONTHLY',
    );
    expect(next.toISOString()).toBe('2026-02-28T10:30:00.000Z');
  });

  it('handles leap-day yearly renewal', () => {
    const next = provider.nextPeriod(
      new Date('2024-02-29T08:00:00.000Z'),
      'YEARLY',
    );
    expect(next.toISOString()).toBe('2025-02-28T08:00:00.000Z');
  });

  it('adds three months for quarterly billing', () => {
    const next = provider.nextPeriod(
      new Date('2026-03-30T12:00:00.000Z'),
      'QUARTERLY',
    );
    expect(next.toISOString()).toBe('2026-06-30T12:00:00.000Z');
  });

  it('returns stable mock provider references for the same idempotency key', () => {
    const first = provider.createSubscription('user-1', 'join-1');
    const second = provider.createSubscription('user-1', 'join-1');
    expect(first.providerSubscriptionId).toBe(second.providerSubscriptionId);
    expect(
      provider.charge('subscription-1', 'period-1').providerPaymentId,
    ).toBe(provider.charge('subscription-1', 'period-1').providerPaymentId);
  });
});
