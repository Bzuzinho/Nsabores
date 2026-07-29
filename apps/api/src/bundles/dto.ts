import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
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

export enum BundleModeDtoValue {
  FIXED = 'FIXED',
  CONFIGURABLE = 'CONFIGURABLE',
}

export enum BundlePricingModeDtoValue {
  PRODUCT_PRICE = 'PRODUCT_PRICE',
  COMPONENT_TOTAL = 'COMPONENT_TOTAL',
}

export class BundleGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsInt() @Min(0) minimumSelections!: number;
  @IsOptional() @IsInt() @Min(1) maximumSelections?: number;
  @IsInt() sortOrder!: number;
}

export class BundleItemDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsString() @MaxLength(80) groupCode?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsBoolean() isRequired!: boolean;
  @IsInt() @Min(0) minimumQuantity!: number;
  @IsOptional() @IsInt() @Min(1) maximumQuantity?: number;
  @IsInt() priceDeltaCents!: number;
  @IsInt() sortOrder!: number;
  @IsBoolean() isActive!: boolean;
}

export class PersonalizationConfigDto {
  @IsBoolean() allowGiftMessage!: boolean;
  @IsBoolean() allowRecipientName!: boolean;
  @IsBoolean() allowSpecialPackaging!: boolean;
  @IsInt() @Min(0) specialPackagingCents!: number;
  @IsBoolean() allowRequestedDate!: boolean;
  @IsBoolean() allowNotes!: boolean;
  @IsBoolean() allowHidePrice!: boolean;
  @IsInt() @Min(1) messageMaxLength!: number;
  @IsInt() @Min(1) notesMaxLength!: number;
}

export class BundleUpsertDto {
  @IsUUID() productId!: string;
  @IsEnum(BundleModeDtoValue) mode!: BundleModeDtoValue;
  @IsEnum(BundlePricingModeDtoValue) pricingMode!: BundlePricingModeDtoValue;
  @IsOptional() @IsInt() @Min(0) minimumSelections?: number;
  @IsOptional() @IsInt() @Min(1) maximumSelections?: number;
  @IsBoolean() isActive!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleGroupDto)
  groups!: BundleGroupDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  items!: BundleItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalizationConfigDto)
  personalization?: PersonalizationConfigDto;
}

export class BundleSelectionDto {
  @IsUUID() bundleItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class BundlePriceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleSelectionDto)
  selections!: BundleSelectionDto[];

  @IsOptional() @IsBoolean() specialPackaging?: boolean;
}

export class BundlePersonalizationDto {
  @IsOptional() @IsString() @MaxLength(2000) giftMessage?: string;
  @IsOptional() @IsString() @MaxLength(200) recipientName?: string;
  @IsOptional() @IsBoolean() specialPackaging?: boolean;
  @IsOptional() @IsDateString() requestedDate?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsBoolean() hidePrice?: boolean;
}

export class BundleCartDto {
  @IsInt() @Min(1) quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleSelectionDto)
  selections!: BundleSelectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BundlePersonalizationDto)
  personalization?: BundlePersonalizationDto;
}
