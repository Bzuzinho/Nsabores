import { describe, expect, it } from 'vitest';
import { calculateClubPercentageDiscount } from './club-benefit';

describe('calculateClubPercentageDiscount', () => {
  it('applies the club percentage after existing product discounts', () => {
    expect(calculateClubPercentageDiscount(10_000, 2_000, 10)).toEqual({
      percent: 10,
      eligibleSubtotal: 8_000,
      amountCents: 800,
    });
  });

  it('never discounts below zero', () => {
    expect(calculateClubPercentageDiscount(1_000, 1_500, 25)).toEqual({
      percent: 25,
      eligibleSubtotal: 0,
      amountCents: 0,
    });
  });

  it('clamps the benefit percentage between zero and one hundred', () => {
    expect(calculateClubPercentageDiscount(1_000, 0, 150).amountCents).toBe(
      1_000,
    );
    expect(calculateClubPercentageDiscount(1_000, 0, -10).amountCents).toBe(0);
  });

  it('rounds monetary results to cents deterministically', () => {
    expect(calculateClubPercentageDiscount(999, 0, 15).amountCents).toBe(150);
  });
});
