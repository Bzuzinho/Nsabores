import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum PromotionStatusDtoValue {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum PromotionBenefitTypeDtoValue {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING',
  SPECIAL_PRICE = 'SPECIAL_PRICE',
  QUANTITY_DEAL = 'QUANTITY_DEAL',
}

export enum PromotionChannelDtoValue {
  B2C = 'B2C',
  B2B = 'B2B',
  BOTH = 'BOTH',
}

export class PromotionTargetDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() priceListId?: string;
  @IsOptional() @IsUUID() businessAccountId?: string;
  @IsOptional() @IsInt() @Min(1) minimumQuantity?: number;
}

export class PromotionDto {
  @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
  @IsEnum(PromotionStatusDtoValue) status!: PromotionStatusDtoValue;
  @IsEnum(PromotionBenefitTypeDtoValue) benefitType!: PromotionBenefitTypeDtoValue;
  @IsInt() @Min(0) benefitValue!: number;
  @IsEnum(PromotionChannelDtoValue) channel!: PromotionChannelDtoValue;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsInt() priority!: number;
  @IsBoolean() stackable!: boolean;
  @IsOptional() @IsInt() @Min(1) globalUsageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perCustomerLimit?: number;
  @IsOptional() @IsInt() @Min(0) minimumCartCents?: number;
  @IsOptional() @IsInt() @Min(0) maximumDiscountCents?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionTargetDto)
  targets?: PromotionTargetDto[];
}

export class CouponDto {
  @IsUUID() promotionId!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  @IsEnum(PromotionChannelDtoValue) channel!: PromotionChannelDtoValue;
  @IsOptional() @IsInt() @Min(0) minimumCartCents?: number;
}
