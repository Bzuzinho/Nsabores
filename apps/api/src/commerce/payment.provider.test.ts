import { describe, expect, it } from 'vitest';
import { PaymentProvider } from './payment.provider';

const config = {
  get: (key: string) =>
    ({
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret-at-least-16',
      PAYMENT_SUCCESS_URL: 'http://localhost:3000/checkout/sucesso',
    })[key],
};

describe('PaymentProvider', () => {
  it('creates an isolated mock payment session', () => {
    const provider = new PaymentProvider(config as never);
    const session = provider.create('order-id');
    expect(session.provider).toBe('mock');
    expect(session.providerPaymentId).toMatch(/^mock_/);
    expect(session.redirectUrl).toContain('orderId=order-id');
  });

  it('accepts only the HMAC signature for the exact webhook payload', () => {
    const provider = new PaymentProvider(config as never);
    const payload = JSON.stringify({ eventId: 'evt_1', status: 'PAID' });
    expect(provider.verify(payload, provider.signature(payload))).toBe(true);
    expect(provider.verify(`${payload} `, provider.signature(payload))).toBe(
      false,
    );
    expect(provider.verify(payload, 'invalid')).toBe(false);
  });
});
