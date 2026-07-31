import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { ClubBillingProvider } from './billing.provider';
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
  private readonly manual: ManualClubPaymentsService;

  constructor(
    private readonly club: ClubService,
    prisma: PrismaService,
    config: ConfigService,
    billing: ClubBillingProvider,
  ) {
    this.manual = new ManualClubPaymentsService(
      prisma,
      config,
      club,
      billing,
    );
  }

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
  private readonly manual: ManualClubPaymentsService;

  constructor(
    private readonly club: ClubService,
    prisma: PrismaService,
    config: ConfigService,
    billing: ClubBillingProvider,
  ) {
    this.manual = new ManualClubPaymentsService(
      prisma,
      config,
      club,
      billing,
    );
  }

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
