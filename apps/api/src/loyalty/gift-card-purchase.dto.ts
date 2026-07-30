import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateGiftCardPurchaseDto {
  @IsEmail() purchaserEmail!: string;
  @IsEmail() recipientEmail!: string;
  @IsOptional() @IsString() @MaxLength(120) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(500) message?: string;
  @IsInt() @Min(1000) amountCents!: number;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class ConfirmGiftCardPurchaseDto {
  @IsString() @MaxLength(160) providerPaymentId!: string;
}
