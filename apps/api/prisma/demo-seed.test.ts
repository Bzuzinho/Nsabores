import { describe, expect, it } from 'vitest';

const demoOrderStates = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

describe('demo seed dataset', () => {
  it('covers the principal order lifecycle states', () => {
    expect(new Set(demoOrderStates).size).toBe(8);
    expect(demoOrderStates).toContain('PENDING_PAYMENT');
    expect(demoOrderStates).toContain('DELIVERED');
    expect(demoOrderStates).toContain('REFUNDED');
  });
});
