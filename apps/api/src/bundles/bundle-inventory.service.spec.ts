import { describe, expect, it, vi } from 'vitest';
import { BundleInventoryService } from './bundle-inventory.service';
import type { PrismaService } from '../prisma.service';

describe('BundleInventoryService', () => {
  it('reserves component stock instead of the bundle parent and aggregates repeated components', async () => {
    const reservationCreate = vi.fn(async ({ data }) => ({ id: data.idempotencyKey, ...data }));
    const movementCreate = vi.fn(async ({ data }) => data);
    const executeRaw = vi.fn(async () => 1);
    const tx = {
      stockReservation: {
        findMany: vi.fn(async () => []),
        create: reservationCreate,
      },
      stockMovement: { create: movementCreate },
      order: {
        findUnique: vi.fn(async () => ({
          id: 'order-1',
          items: [
            { id: 'line-a', productId: 'bundle-a', productName: 'Cabaz A', quantity: 2 },
            { id: 'line-b', productId: 'bundle-b', productName: 'Cabaz B', quantity: 1 },
            { id: 'line-c', productId: 'normal-c', productName: 'Produto C', quantity: 4 },
          ],
        })),
      },
      $queryRaw: vi.fn(async () => [
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
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    const service = new BundleInventoryService(prisma);
    await service.reserveOrder('order-1');

    expect(reservationCreate).toHaveBeenCalledTimes(2);
    expect(reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'component-x',
        quantity: 8,
        orderId: 'order-1',
      }),
    });
    expect(reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'normal-c',
        quantity: 4,
        orderId: 'order-1',
      }),
    });
    expect(reservationCreate).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ productId: 'bundle-a' }),
    });
  });

  it('is idempotent when active reservations already exist', async () => {
    const existing = [{ id: 'reservation-1' }];
    const tx = {
      stockReservation: { findMany: vi.fn(async () => existing) },
      order: { findUnique: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    const service = new BundleInventoryService(prisma);
    await expect(service.reserveOrder('order-1')).resolves.toEqual(existing);
    expect(tx.order.findUnique).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
