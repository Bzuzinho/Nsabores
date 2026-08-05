import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export enum ManualPaymentPreferenceDto {
  OPERATOR_CONTACT = 'OPERATOR_CONTACT',
  PAY_ON_DELIVERY = 'PAY_ON_DELIVERY',
  PAY_ON_PICKUP = 'PAY_ON_PICKUP',
  CARRIER_COD = 'CARRIER_COD',
}

export class CartItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity = 1;
}

export class CartQuantityDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class AddressSnapshotDto {
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @IsOptional() @IsString() @MaxLength(150) company?: string;
  @IsOptional() @Matches(/^\d{9}$/) taxNumber?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @Matches(/^\d{4}-\d{3}$/) postalCode!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) city!: string;
  @Matches(/^PT$/) countryCode = 'PT';
}

export class CheckoutDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) customerName!: string;
  @IsPhoneNumber('PT') phone!: string;
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  shippingAddress!: AddressSnapshotDto;
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  billingAddress!: AddressSnapshotDto;
  @IsUUID() deliveryMethodId!: string;
  @IsOptional()
  @IsEnum(ManualPaymentPreferenceDto)
  manualPaymentPreference?: ManualPaymentPreferenceDto;
  @IsBoolean() termsAccepted!: boolean;
  @IsBoolean() privacyAccepted!: boolean;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) customerNotes?: string;
  @IsOptional() @IsInt() @Min(1) loyaltyPoints?: number;
  @IsOptional() @IsString() @MaxLength(120) giftCardCode?: string;
  @IsString() @IsNotEmpty() @MaxLength(100) idempotencyKey!: string;
}

export class PaymentStartDto {
  @IsString() @IsNotEmpty() @MaxLength(100) idempotencyKey!: string;
}

export class ManualPaymentDto {
  @IsOptional() @IsString() @MaxLength(80) method?: string;
  @IsOptional() @IsString() @MaxLength(160) reference?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ShippingQuoteDto {
  @IsInt() @Min(0) amountCents!: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class MockWebhookDto {
  @IsString() @IsNotEmpty() eventId!: string;
  @IsString() @IsNotEmpty() providerPaymentId!: string;
  @IsEnum(PaymentStatus) status!: PaymentStatus;
}

export class OrderQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class OrderStatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class InternalNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(3000) note!: string;
}

export class DeliveryMethodDto {
  @IsBoolean() isActive!: boolean;
  @IsInt() @Min(0) priceCents!: number;
  @IsOptional() @IsInt() @Min(0) freeShippingAboveCents?: number | null;
}

export class CreateDeliveryMethodDto extends DeliveryMethodDto {
  @IsString() @IsNotEmpty() @MaxLength(60) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsIn(['STANDARD', 'LOCAL_PICKUP']) type!: 'STANDARD' | 'LOCAL_PICKUP';
}

export class AdminOrderItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(9999) quantity!: number;
  @IsOptional() @IsInt() @Min(0) unitPriceCents?: number;
}

export class AdminOrderDraftDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) customerName!: string;
  @IsString() @IsNotEmpty() @MaxLength(40) phone!: string;
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  shippingAddress!: AddressSnapshotDto;
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  billingAddress!: AddressSnapshotDto;
  @IsUUID() deliveryMethodId!: string;
  @IsString() @IsNotEmpty() @MaxLength(30) source!: string;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) customerNotes?: string;
  @IsOptional() @IsString() @MaxLength(3000) internalNotes?: string;
  @ValidateNested({ each: true })
  @Type(() => AdminOrderItemDto)
  items!: AdminOrderItemDto[];
}

export class OrderDecisionDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
