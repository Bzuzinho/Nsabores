export interface QuantityDealResult {
  sets: number;
  discountedUnits: number;
  discountCents: number;
}

export function calculateQuantityDeal(
  quantity: number,
  unitPriceCents: number,
  quantityBuy: number,
  quantityPay: number,
): QuantityDealResult {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError('A quantidade tem de ser um inteiro não negativo.');
  }
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new RangeError('O preço unitário tem de ser um inteiro não negativo.');
  }
  if (!Number.isInteger(quantityBuy) || quantityBuy < 2) {
    throw new RangeError('quantityBuy tem de ser um inteiro igual ou superior a 2.');
  }
  if (!Number.isInteger(quantityPay) || quantityPay < 1 || quantityPay >= quantityBuy) {
    throw new RangeError('quantityPay tem de ser um inteiro entre 1 e quantityBuy - 1.');
  }

  const sets = Math.floor(quantity / quantityBuy);
  const discountedUnits = sets * (quantityBuy - quantityPay);
  return {
    sets,
    discountedUnits,
    discountCents: discountedUnits * unitPriceCents,
  };
}
