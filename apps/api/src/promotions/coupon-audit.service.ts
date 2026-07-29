import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CouponAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async redemptions(couponId: string) {
    const exists = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Coupon" WHERE "id" = ${couponId}::uuid LIMIT 1
    `;
    if (!exists[0]) throw new NotFoundException('Cupão não encontrado.');

    return this.prisma.$queryRaw<
      Array<{
        id: string;
        orderId: string;
        orderNumber: string;
        userId: string | null;
        businessAccountId: string | null;
        amountCents: number;
        idempotencyKey: string;
        redeemedAt: Date;
      }>
    >`
      SELECT cr."id", cr."orderId", o."number" AS "orderNumber", cr."userId",
             cr."businessAccountId", cr."amountCents", cr."idempotencyKey", cr."redeemedAt"
      FROM "CouponRedemption" cr
      JOIN "Order" o ON o."id" = cr."orderId"
      WHERE cr."couponId" = ${couponId}::uuid
      ORDER BY cr."redeemedAt" DESC
    `;
  }
}
