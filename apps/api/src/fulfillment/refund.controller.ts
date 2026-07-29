import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { ReturnRefundService } from './refund.service';
import { ReturnReplacementService } from './replacement.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/returns')
export class AdminReturnRefundController {
  constructor(
    private readonly refunds: ReturnRefundService,
    private readonly replacements: ReturnReplacementService,
  ) {}

  @Post(':id/refund')
  refund(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.refunds.refundReturn(id, user.sub);
  }

  @Post(':id/replacement')
  replacement(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.replacements.createReplacement(id, user.sub);
  }
}
