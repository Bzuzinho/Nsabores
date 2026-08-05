import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BusinessAccountType,
  BusinessAccountStatus,
  BusinessAccountUserRole,
  InventoryCountStatus,
  PaymentTerms,
  PriceListType,
  PurchaseOrderStatus,
  StockMovementType,
} from '@prisma/client';

export class SupplierDto {
  @IsString() @IsNotEmpty() tradeName!: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() primaryContact?: string;
  @IsObject() address!: Record<string, unknown>;
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
  @ArrayMinSize(1)
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
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  items!: ReceiptLineDto[];
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() allowOverReceipt?: boolean;
}

export class InventoryLineDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsInt() @Min(0) countedQuantity?: number;
  @IsOptional() @IsString() reason?: string;
}

export class InventoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  items!: InventoryLineDto[];
  @IsOptional() @IsString() notes?: string;
}

export class InventoryUpdateDto extends InventoryDto {}

export class ResellerApplicationDto {
  @IsString() @IsNotEmpty() tradeName!: string;
  @IsString() @IsNotEmpty() legalName!: string;
  @IsString() @Matches(/^\d{9}$/) taxNumber!: string;
  @IsString() @IsNotEmpty() contactName!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsObject() address!: Record<string, unknown>;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() socialMedia?: string;
  @IsString() @IsNotEmpty() activity!: string;
  @IsOptional() @IsString() estimatedVolume?: string;
  @IsOptional() @IsString() @MaxLength(3000) message?: string;
}

export class BusinessOrderDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() @MaxLength(120) customerReference?: string;
  @IsString() @IsNotEmpty() @MaxLength(100) idempotencyKey!: string;
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

export class BusinessAccountDto {
  @IsEnum(BusinessAccountType) type!: BusinessAccountType;
  @IsString() @IsNotEmpty() tradeName!: string;
  @IsString() @IsNotEmpty() legalName!: string;
  @IsString() @Matches(/^\d{9}$/) taxNumber!: string;
  @IsEmail() businessEmail!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsObject() billingAddress!: Record<string, unknown>;
  @IsOptional() @IsUUID() priceListId?: string | null;
  @IsEnum(PaymentTerms) paymentTerms!: PaymentTerms;
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['CARD', 'BANK_TRANSFER', 'PAY_ON_DELIVERY'], { each: true })
  allowedPaymentMethods!: string[];
  @IsOptional() @IsInt() @Min(0) creditLimitCents?: number | null;
  @IsOptional() @IsInt() @Min(0) minimumOrderCents?: number | null;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsOptional() @IsInt() @Min(0) shippingCents?: number | null;
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  internalNotes?: string | null;
}

export class BusinessAccountUserDto {
  @IsEmail() email!: string;
  @IsEnum(BusinessAccountUserRole) role!: BusinessAccountUserRole;
}

export class UpdateBusinessAccountUserDto {
  @IsOptional()
  @IsEnum(BusinessAccountUserRole)
  role?: BusinessAccountUserRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
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
  @IsString() @Matches(/^[A-Za-z0-9._-]+$/) code!: string;
  @IsEnum(PriceListType) type!: PriceListType;
  @IsOptional() @IsBoolean() includesTax?: boolean;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsArray()
  @ArrayMinSize(1)
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

export class StockConfigurationDto {
  @IsOptional() @IsInt() @Min(0) reorderPoint?: number | null;
  @IsOptional() @IsInt() @Min(0) reorderQuantity?: number | null;
  @IsOptional() @IsBoolean() trackStock?: boolean;
}

export class StockAdjustmentDto {
  @IsUUID() productId!: string;
  @IsEnum(StockMovementType)
  @IsIn([
    StockMovementType.ADJUSTMENT_IN,
    StockMovementType.ADJUSTMENT_OUT,
    StockMovementType.DAMAGE,
    StockMovementType.LOSS,
  ])
  type!: StockMovementType;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @IsNotEmpty() @MaxLength(500) note!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) idempotencyKey!: string;
}
