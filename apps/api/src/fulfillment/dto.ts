import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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

export enum ShipmentStatusDtoValue {
  PENDING = 'PENDING',
  READY = 'READY',
  LABEL_CREATED = 'LABEL_CREATED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum ReturnResolutionDtoValue {
  REFUND = 'REFUND',
  REPLACEMENT = 'REPLACEMENT',
  CREDIT = 'CREDIT',
  OTHER = 'OTHER',
}

export enum ReturnRequestStatusDtoValue {
  REQUESTED = 'REQUESTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  INSPECTED = 'INSPECTED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum ReturnItemDispositionDtoValue {
  RESTOCK = 'RESTOCK',
  UNSELLABLE = 'UNSELLABLE',
  RETURN_TO_SUPPLIER = 'RETURN_TO_SUPPLIER',
  DESTROY = 'DESTROY',
}

export enum SupportCaseTypeDtoValue {
  DELAY = 'DELAY',
  LOST_SHIPMENT = 'LOST_SHIPMENT',
  DAMAGED_PACKAGE = 'DAMAGED_PACKAGE',
  DAMAGED_PRODUCT = 'DAMAGED_PRODUCT',
  MISSING_ITEM = 'MISSING_ITEM',
  WRONG_ITEM = 'WRONG_ITEM',
  FAILED_DELIVERY = 'FAILED_DELIVERY',
  RETURN_TO_SENDER = 'RETURN_TO_SENDER',
  OTHER = 'OTHER',
}

export enum SupportCasePriorityDtoValue {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum SupportCaseStatusDtoValue {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  WAITING_CARRIER = 'WAITING_CARRIER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export class ShipmentLineDto {
  @IsUUID() orderItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateShipmentDto {
  @IsUUID() orderId!: string;
  @IsString() @IsNotEmpty() service!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) idempotencyKey!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShipmentLineDto)
  items!: ShipmentLineDto[];
  @IsOptional() @IsInt() @Min(1) weightGrams?: number;
  @IsOptional() @IsInt() @Min(1) lengthMm?: number;
  @IsOptional() @IsInt() @Min(1) widthMm?: number;
  @IsOptional() @IsInt() @Min(1) heightMm?: number;
  @IsOptional() @IsInt() @Min(0) costCents?: number;
}

export class ShipmentEventDto {
  @IsString() @IsNotEmpty() providerEventId!: string;
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsOptional() @IsString() location?: string;
  @IsString() @IsNotEmpty() occurredAt!: string;
  @IsOptional() payload?: Record<string, unknown>;
}

export class ShipmentStatusUpdateDto {
  @IsEnum(ShipmentStatusDtoValue) status!: ShipmentStatusDtoValue;
  @IsOptional() @IsString() note?: string;
}

export class ReturnLineDto {
  @IsUUID() orderItemId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsString() declaredCondition?: string;
}

export class CreateReturnDto {
  @IsUUID() orderId!: string;
  @IsEnum(ReturnResolutionDtoValue) resolution!: ReturnResolutionDtoValue;
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsString() @MaxLength(3000) customerNotes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items!: ReturnLineDto[];
}

export class ReturnDecisionLineDto {
  @IsUUID() returnItemId!: string;
  @IsEnum(ReturnItemDispositionDtoValue)
  disposition!: ReturnItemDispositionDtoValue;
  @IsOptional() @IsString() receivedCondition?: string;
  @IsInt() @Min(0) eligibleRefundCents!: number;
}

export class ReturnDecisionDto {
  @IsBoolean() approved!: boolean;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnDecisionLineDto)
  items?: ReturnDecisionLineDto[];
}

export class ReturnStatusUpdateDto {
  @IsEnum(ReturnRequestStatusDtoValue)
  status!: ReturnRequestStatusDtoValue;
  @IsOptional() @IsString() note?: string;
}

export class GuestTrackingDto {
  @IsString() @IsNotEmpty() orderNumber!: string;
  @IsEmail() email!: string;
}

export class CreateSupportCaseDto {
  @IsOptional() @IsUUID() orderId?: string;
  @IsOptional() @IsUUID() shipmentId?: string;
  @IsEnum(SupportCaseTypeDtoValue) type!: SupportCaseTypeDtoValue;
  @IsOptional()
  @IsEnum(SupportCasePriorityDtoValue)
  priority?: SupportCasePriorityDtoValue;
  @IsString() @IsNotEmpty() subject!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;
}

export class SupportCaseStatusUpdateDto {
  @IsEnum(SupportCaseStatusDtoValue) status!: SupportCaseStatusDtoValue;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsUUID() assignedToId?: string;
}

export class SupportCaseCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
}
