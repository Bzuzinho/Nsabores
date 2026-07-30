import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { PrismaService } from '../prisma.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')
@Controller('v1/admin/loyalty/accounts')
export class AdminLoyaltyAccountsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
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
}
