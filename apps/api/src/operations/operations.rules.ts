export const availableQuantity = (onHand: number, reserved: number) =>
  onHand - reserved;

export function validatesOrderQuantity(
  quantity: number,
  minimum: number,
  multiple: number,
) {
  return quantity >= minimum && quantity % multiple === 0;
}

export function canReserve(
  onHand: number,
  reserved: number,
  requested: number,
  trackStock = true,
) {
  return !trackStock || requested <= availableQuantity(onHand, reserved);
}
