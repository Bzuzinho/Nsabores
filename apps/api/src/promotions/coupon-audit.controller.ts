import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { CouponAuditService } from './coupon-audit.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/coupons')
export class CouponAuditController {
  constructor(private readonly audit: CouponAuditService) {}

  @Get(':id/redemptions')
  redemptions(@Param('id') id: string) {
    return this.audit.redemptions(id);
  }
}
