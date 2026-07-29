import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { CouponDto, PromotionDto } from './dto';
import { PromotionsService } from './promotions.service';

@Controller('v1/promotions')
export class PublicPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(@Query('channel') channel?: 'B2C' | 'B2B') {
    return this.promotions.publicPromotions(channel ?? 'B2C');
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin')
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get('promotions')
  promotionsList() {
    return this.promotions.promotions();
  }

  @Get('promotions/:id')
  promotion(@Param('id') id: string) {
    return this.promotions.promotion(id);
  }

  @Post('promotions')
  createPromotion(@Body() body: PromotionDto) {
    return this.promotions.createPromotion(body);
  }

  @Patch('promotions/:id')
  updatePromotion(@Param('id') id: string, @Body() body: PromotionDto) {
    return this.promotions.updatePromotion(id, body);
  }

  @Get('coupons')
  coupons() {
    return this.promotions.coupons();
  }

  @Get('coupons/:id')
  coupon(@Param('id') id: string) {
    return this.promotions.coupon(id);
  }

  @Post('coupons')
  createCoupon(@Body() body: CouponDto) {
    return this.promotions.createCoupon(body);
  }

  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() body: CouponDto) {
    return this.promotions.updateCoupon(id, body);
  }
}
