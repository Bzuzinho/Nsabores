import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
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
import {
  BusinessAccountStatus,
  InventoryCountStatus,
  PaymentTerms,
  PriceListType,
  PurchaseOrderStatus,
} from '@prisma/client';

export class SupplierDto {
  @IsString() @IsNotEmpty() tradeName!: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() primaryContact?: string;
  address!: Record<string, unknown>;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsInt() @Min(0) averageLeadTimeDays?: number;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PurchaseItemDto {
  @IsUUID() productId!: string;
  @IsString() @IsNotEmpty() supplierSku!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsInt() @Min(1) orderedQuantity!: number;
  @IsInt() @Min(0) unitCostCents!: number;
  @IsOptional() @IsInt() @Min(0) taxRateBasisPoints?: number;
}

export class PurchaseOrderDto {
  @IsUUID() supplierId!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() paymentTermsSnapshot?: string;
  @IsOptional() @IsString() expectedAt?: string;
}

export class ReceiptLineDto {
  @IsUUID() purchaseOrderItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class PurchaseReceiptDto {
  @IsString() @IsNotEmpty() @MaxLength(100) idempotencyKey!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  items!: ReceiptLineDto[];
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() allowOverReceipt?: boolean;
}

export class InventoryLineDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(0) countedQuantity!: number;
  @IsOptional() @IsString() reason?: string;
}

export class InventoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  items!: InventoryLineDto[];
  @IsOptional() @IsString() notes?: string;
}

export class ResellerApplicationDto {
  @IsString() @IsNotEmpty() tradeName!: string;
  @IsString() @IsNotEmpty() legalName!: string;
  @IsString() @IsNotEmpty() taxNumber!: string;
  @IsString() @IsNotEmpty() contactName!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() phone!: string;
  address!: Record<string, unknown>;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() socialMedia?: string;
  @IsString() @IsNotEmpty() activity!: string;
  @IsOptional() @IsString() estimatedVolume?: string;
  @IsOptional() @IsString() @MaxLength(3000) message?: string;
}

export class ApplicationDecisionDto {
  @IsBoolean() approved!: boolean;
  @IsOptional() @IsUUID() priceListId?: string;
  @IsOptional() @IsEnum(PaymentTerms) paymentTerms?: PaymentTerms;
  @IsOptional() @IsString() internalReason?: string;
}

export class BusinessStatusDto {
  @IsEnum(BusinessAccountStatus) status!: BusinessAccountStatus;
}

export class PriceItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(0) priceCents!: number;
  @IsOptional() @IsInt() @Min(0) promotionalPriceCents?: number;
  @IsOptional() @IsInt() @Min(1) minimumQuantity?: number;
  @IsOptional() @IsInt() @Min(1) maximumQuantity?: number;
}

export class PriceListDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() code!: string;
  @IsEnum(PriceListType) type!: PriceListType;
  @IsOptional() @IsBoolean() includesTax?: boolean;
  @IsOptional() @IsInt() priority?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceItemDto)
  items!: PriceItemDto[];
}

export class PurchaseStatusDto {
  @IsEnum(PurchaseOrderStatus) status!: PurchaseOrderStatus;
}

export class InventoryStatusDto {
  @IsEnum(InventoryCountStatus) status!: InventoryCountStatus;
}
