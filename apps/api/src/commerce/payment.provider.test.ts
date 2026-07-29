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

  it('issues a mock refund with provider reference and idempotency key', () => {
    const provider = new PaymentProvider(config as never);
    const refund = provider.refund(
      'mock_payment_1',
      1250,
      'return:rma-1:refund',
    );
    expect(refund.providerRefundId).toMatch(/^mock_refund_mock_payment_1_/);
    expect(refund.amountCents).toBe(1250);
    expect(refund.status).toBe('REFUNDED');
    expect(refund.idempotencyKey).toBe('return:rma-1:refund');
  });

  it('rejects invalid refund amounts', () => {
    const provider = new PaymentProvider(config as never);
    expect(() => provider.refund('mock_payment_1', 0, 'refund-0')).toThrow(
      'Montante de reembolso inválido.',
    );
    expect(() =>
      provider.refund('mock_payment_1', -100, 'refund-negative'),
    ).toThrow('Montante de reembolso inválido.');
  });
});
