import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { ClubService } from './club.service';
import { ClubCancelDto, ClubPlanDto, JoinClubDto } from './dto';
import { ManualClubPaymentsService } from './manual-club-payments.service';

@Controller('v1/club')
export class PublicClubController {
  constructor(private readonly club: ClubService) {}

  @Get('plans')
  plans() {
    return this.club.publicPlans();
  }
}

@UseGuards(AuthGuard)
@Controller('v1/account/club')
export class AccountClubController {
  constructor(
    private readonly club: ClubService,
    private readonly manual: ManualClubPaymentsService,
  ) {}

  @Get()
  subscription(@CurrentUser() user: AuthPrincipal) {
    return this.manual.accountSubscription(user.sub);
  }

  @Post('join')
  join(@CurrentUser() user: AuthPrincipal, @Body() body: JoinClubDto) {
    return this.manual.join(user.sub, body);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: AuthPrincipal, @Body() body: ClubCancelDto) {
    return this.club.cancel(user.sub, body);
  }

  @Post('resume')
  resume(@CurrentUser() user: AuthPrincipal) {
    return this.club.resume(user.sub);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/club')
export class AdminClubController {
  constructor(
    private readonly club: ClubService,
    private readonly prisma: PrismaService,
    private readonly manual: ManualClubPaymentsService,
  ) {}

  @Get('plans')
  plans() {
    return this.club.plans();
  }

  @Get('plans/:id')
  plan(@Param('id') id: string) {
    return this.club.plan(id);
  }

  @Post('plans')
  createPlan(@Body() body: ClubPlanDto) {
    return this.club.createPlan(body);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: ClubPlanDto) {
    return this.club.updatePlan(id, body);
  }

  @Get('subscriptions')
  subscriptions() {
    return this.club.subscriptions();
  }

  @Get('pending-charges')
  pendingCharges() {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c."id", c."subscriptionId", c."periodStart", c."periodEnd",
             c."amountCents", c."currency", c."status", c."createdAt",
             s."status" AS "subscriptionStatus", p."name" AS "planName",
             p."code" AS "planCode", u."email", u."firstName", u."lastName"
      FROM "ClubSubscriptionCharge" c
      JOIN "ClubSubscription" s ON s."id" = c."subscriptionId"
      JOIN "ClubPlan" p ON p."id" = s."planId"
      JOIN "User" u ON u."id" = s."userId"
      WHERE c."status" = 'PENDING'::"ClubChargeStatus"
      ORDER BY c."createdAt" ASC
    `;
  }

  @Get('subscriptions/:id')
  subscription(@Param('id') id: string) {
    return this.club.subscriptionDetail(id);
  }

  @Post('subscriptions/:id/renew')
  renew(@Param('id') id: string) {
    return this.manual.requestRenewal(id);
  }

  @Post('subscriptions/:id/charges/:chargeId/confirm')
  confirmCharge(
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() body: { reference?: string; note?: string },
  ) {
    return this.manual.confirmCharge(
      id,
      chargeId,
      user.sub,
      body.reference,
      body.note,
    );
  }
}
