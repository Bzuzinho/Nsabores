import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import {
  ConfirmGiftCardPurchaseDto,
  CreateGiftCardPurchaseDto,
} from './gift-card-purchase.dto';
import { GiftCardPurchaseService } from './gift-card-purchase.service';

@Controller('v1/gift-card-purchases')
export class GiftCardPurchaseController {
  constructor(private readonly purchases: GiftCardPurchaseService) {}

  @Post()
  create(@Body() body: CreateGiftCardPurchaseDto) {
    return this.purchases.create(body);
  }

  @Get(':id')
  status(@Param('id') id: string) {
    return this.purchases.status(id);
  }

  @Post(':id/confirm-mock')
  confirmMock(
    @Param('id') id: string,
    @Body() body: ConfirmGiftCardPurchaseDto,
  ) {
    return this.purchases.confirmMock(id, body);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')
@Controller('v1/admin/gift-card-purchases')
export class AdminGiftCardPurchaseController {
  constructor(private readonly purchases: GiftCardPurchaseService) {}

  @Get()
  list() {
    return this.purchases.list();
  }

  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.purchases.markPaid(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.purchases.cancel(id);
  }
}
