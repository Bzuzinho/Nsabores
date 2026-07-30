import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';

@UseGuards(AuthGuard)
@Controller('v1/account/orders')
export class AccountReceivablesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':orderId/payment-agreement')
  async agreement(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pa."status", pa."method", pa."expectedAmountCents", pa."dueAt",
             pa."publicReference", pa."paidAt", o."paymentStatus", o."status" AS "orderStatus"
      FROM "PaymentAgreement" pa
      JOIN "Order" o ON o."id" = pa."orderId"
      WHERE pa."orderId" = ${orderId}::uuid AND o."userId" = ${user.sub}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}
