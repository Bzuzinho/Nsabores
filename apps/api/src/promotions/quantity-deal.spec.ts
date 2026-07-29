import { describe, expect, it } from 'vitest';
import { calculateQuantityDeal } from './quantity-deal';

describe('calculateQuantityDeal', () => {
  it('applies buy 3 pay 2 to complete sets only', () => {
    expect(calculateQuantityDeal(7, 500, 3, 2)).toEqual({
      sets: 2,
      discountedUnits: 2,
      discountCents: 1000,
    });
  });

  it('does not discount an incomplete set', () => {
    expect(calculateQuantityDeal(2, 750, 3, 2)).toEqual({
      sets: 0,
      discountedUnits: 0,
      discountCents: 0,
    });
  });

  it('supports multi-unit free quantities such as buy 4 pay 2', () => {
    expect(calculateQuantityDeal(8, 325, 4, 2)).toEqual({
      sets: 2,
      discountedUnits: 4,
      discountCents: 1300,
    });
  });

  it('keeps monetary arithmetic in integer cents', () => {
    expect(calculateQuantityDeal(6, 199, 3, 2).discountCents).toBe(398);
  });

  it('rejects invalid deal definitions', () => {
    expect(() => calculateQuantityDeal(3, 500, 3, 3)).toThrow(RangeError);
    expect(() => calculateQuantityDeal(3, 500, 1, 0)).toThrow(RangeError);
  });
});
