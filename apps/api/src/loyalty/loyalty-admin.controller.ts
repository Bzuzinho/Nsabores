import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { PrismaService } from '../prisma.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')
@Controller('v1/admin/loyalty')
export class AdminLoyaltyAccountsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('accounts')
  accounts(@Query('search') search?: string) {
    const value = search?.trim() || null;
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT la.*, u."email", u."firstName", u."lastName"
      FROM "LoyaltyAccount" la
      JOIN "User" u ON u."id" = la."userId"
      WHERE ${value}::text IS NULL
         OR u."email" ILIKE '%' || ${value} || '%'
         OR u."firstName" ILIKE '%' || ${value} || '%'
         OR u."lastName" ILIKE '%' || ${value} || '%'
      ORDER BY la."updatedAt" DESC
      LIMIT 100
    `;
  }

  @Get('gift-cards/:id')
  async giftCard(@Param('id') id: string) {
    const cards = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "codeLast4", "status", "initialAmountCents", "balanceCents", "reservedCents",
        "currency", "recipientEmail", "recipientName", "message", "expiresAt", "activatedAt",
        "blockedAt", "blockReason", "createdAt", "updatedAt"
      FROM "GiftCard" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!cards[0]) throw new NotFoundException('Vale-oferta não encontrado.');
    const transactions = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`
      SELECT * FROM "GiftCardTransaction"
      WHERE "giftCardId" = ${id}::uuid ORDER BY "createdAt" DESC
    `;
    return { ...cards[0], transactions };
  }
}
