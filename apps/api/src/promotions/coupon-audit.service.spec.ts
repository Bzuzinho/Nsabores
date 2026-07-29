import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma.service';
import { CouponAuditService } from './coupon-audit.service';

describe('CouponAuditService', () => {
  it('returns redemption audit rows for an existing coupon', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'coupon-1' }])
      .mockResolvedValueOnce([
        {
          id: 'redemption-1',
          orderId: 'order-1',
          orderNumber: 'NS-2026-0001',
          userId: 'user-1',
          businessAccountId: null,
          amountCents: 500,
          idempotencyKey: 'coupon:coupon-1:order:order-1',
          redeemedAt: new Date('2026-07-29T12:00:00Z'),
        },
      ]);
    const service = new CouponAuditService({ $queryRaw: queryRaw } as unknown as PrismaService);

    await expect(service.redemptions('coupon-1')).resolves.toEqual([
      expect.objectContaining({
        orderNumber: 'NS-2026-0001',
        amountCents: 500,
      }),
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('rejects audit lookup for a missing coupon', async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([]);
    const service = new CouponAuditService({ $queryRaw: queryRaw } as unknown as PrismaService);

    await expect(service.redemptions('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
