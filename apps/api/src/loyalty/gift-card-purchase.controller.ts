import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
