import { describe, expect, it } from 'vitest';
import {
  availableQuantity,
  canReserve,
  validatesOrderQuantity,
} from './operations.rules';

describe('regras de stock e B2B', () => {
  it('deriva disponibilidade sem persistir um terceiro saldo', () => {
    expect(availableQuantity(20, 7)).toBe(13);
  });

  it('impede stock negativo e permite artigo não controlado', () => {
    expect(canReserve(5, 3, 3)).toBe(false);
    expect(canReserve(0, 0, 100, false)).toBe(true);
  });

  it('valida mínimos e múltiplos B2B', () => {
    expect(validatesOrderQuantity(12, 6, 6)).toBe(true);
    expect(validatesOrderQuantity(5, 6, 1)).toBe(false);
    expect(validatesOrderQuantity(7, 6, 6)).toBe(false);
  });
});
