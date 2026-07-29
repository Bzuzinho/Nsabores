import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { AdvancedPromotionsService } from './advanced-promotions.service';
import { QuantityDealDto } from './quantity-deal.dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/promotions')
export class QuantityDealController {
  constructor(private readonly promotions: AdvancedPromotionsService) {}

  @Patch(':id/quantity-deal')
  configure(@Param('id') id: string, @Body() body: QuantityDealDto) {
    return this.promotions.configureQuantityDeal(id, body);
  }
}
