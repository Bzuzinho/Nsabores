import { describe, expect, it, vi } from 'vitest';
import { BundleInventoryService } from './bundle-inventory.service';
import type { PrismaService } from '../prisma.service';

interface ReservationCreateInput {
  data: {
    idempotencyKey: string;
    orderId: string;
    productId: string;
    quantity: number;
  };
}

describe('BundleInventoryService', () => {
  it('reserves component stock instead of the bundle parent and aggregates repeated components', async () => {
    const reservationCreate = vi.fn(({ data }: ReservationCreateInput) =>
      Promise.resolve({
        id: data.idempotencyKey,
        ...data,
      }),
    );
    const movementCreate = vi.fn(({ data }: { data: unknown }) =>
      Promise.resolve(data),
    );
    const executeRaw = vi.fn(() => Promise.resolve(1));
    const tx = {
      stockReservation: {
        findMany: vi.fn().mockResolvedValue([]),
        create: reservationCreate,
      },
      stockMovement: { create: movementCreate },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'order-1',
          items: [
            {
              id: 'line-a',
              productId: 'bundle-a',
              productName: 'Cabaz A',
              quantity: 2,
            },
            {
              id: 'line-b',
              productId: 'bundle-b',
              productName: 'Cabaz B',
              quantity: 1,
            },
            {
              id: 'line-c',
              productId: 'normal-c',
              productName: 'Produto C',
              quantity: 4,
            },
          ],
        }),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        {
          orderItemId: 'line-a',
          componentProductId: 'component-x',
          componentName: 'Componente X',
          quantity: 3,
        },
        {
          orderItemId: 'line-b',
          componentProductId: 'component-x',
          componentName: 'Componente X',
          quantity: 2,
        },
      ]),
      $executeRaw: executeRaw,
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    } as unknown as PrismaService;

    const service = new BundleInventoryService(prisma);
    await service.reserveOrder('order-1');

    expect(reservationCreate).toHaveBeenCalledTimes(2);
    const createdReservations = reservationCreate.mock.calls.map(
      ([input]) => input.data,
    );
    expect(createdReservations).toContainEqual({
      idempotencyKey: 'order:order-1:reserve:component-x',
      orderId: 'order-1',
      productId: 'component-x',
      quantity: 8,
    });
    expect(createdReservations).toContainEqual({
      idempotencyKey: 'order:order-1:reserve:normal-c',
      orderId: 'order-1',
      productId: 'normal-c',
      quantity: 4,
    });
    expect(
      createdReservations.some(({ productId }) => productId === 'bundle-a'),
    ).toBe(false);
  });

  it('is idempotent when active reservations already exist', async () => {
    const existing = [{ id: 'reservation-1' }];
    const tx = {
      stockReservation: { findMany: vi.fn().mockResolvedValue(existing) },
      order: { findUnique: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    } as unknown as PrismaService;

    const service = new BundleInventoryService(prisma);
    await expect(service.reserveOrder('order-1')).resolves.toEqual(existing);
    expect(tx.order.findUnique).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
