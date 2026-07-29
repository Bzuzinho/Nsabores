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
import { ClubService } from './club.service';
import { ClubCancelDto, ClubPlanDto, JoinClubDto } from './dto';

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
  constructor(private readonly club: ClubService) {}

  @Get()
  subscription(@CurrentUser() user: AuthPrincipal) {
    return this.club.accountSubscription(user.sub);
  }

  @Post('join')
  join(@CurrentUser() user: AuthPrincipal, @Body() body: JoinClubDto) {
    return this.club.join(user.sub, body);
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
  constructor(private readonly club: ClubService) {}

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
    return this.club.renew(id);
  }
}
