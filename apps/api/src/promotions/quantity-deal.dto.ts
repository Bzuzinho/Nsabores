import { IsInt, Min } from 'class-validator';

export class QuantityDealDto {
  @IsInt()
  @Min(2)
  quantityBuy!: number;

  @IsInt()
  @Min(1)
  quantityPay!: number;
}
