import { Body, Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { ClubOperationsService } from './club-operations.service';
import { ChangeClubPlanDto, ClubAdminActionDto, ClubWebhookDto } from './operations.dto';

@UseGuards(AuthGuard)
@Controller('v1/account/club')
export class AccountClubOperationsController {
  constructor(private readonly operations: ClubOperationsService) {}

  @Post('change-plan')
  changePlan(@CurrentUser() user: AuthPrincipal, @Body() body: ChangeClubPlanDto) {
    return this.operations.changePlan(user.sub, body.planCode);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/club/subscriptions')
export class AdminClubOperationsController {
  constructor(private readonly operations: ClubOperationsService) {}

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: ClubAdminActionDto,
  ) {
    return this.operations.scheduleCancel(id, user.sub, body.reason);
  }

  @Post(':id/resume')
  resume(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: ClubAdminActionDto,
  ) {
    return this.operations.resume(id, user.sub, body.reason);
  }
}

@Controller('v1/webhooks/club')
export class ClubWebhookController {
  constructor(private readonly operations: ClubOperationsService) {}

  @Post()
  webhook(
    @Body() body: ClubWebhookDto,
    @Headers('x-club-signature') signature?: string,
  ) {
    return this.operations.handleWebhook(body, signature);
  }
}
