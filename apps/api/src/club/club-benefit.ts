export function calculateClubPercentageDiscount(
  subtotalCents: number,
  existingProductDiscountCents: number,
  discountPercent: number,
) {
  const subtotal = Math.max(0, Math.trunc(subtotalCents));
  const existing = Math.min(subtotal, Math.max(0, Math.trunc(existingProductDiscountCents)));
  const percent = Math.min(100, Math.max(0, Math.trunc(discountPercent)));
  const eligibleSubtotal = Math.max(0, subtotal - existing);
  const amountCents = Math.min(
    eligibleSubtotal,
    Math.round((eligibleSubtotal * percent) / 100),
  );
  return { percent, eligibleSubtotal, amountCents };
}
