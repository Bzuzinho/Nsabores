import { IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class LoyaltyAdjustmentDto {
  @IsInt() points!: number;
  @IsString() @MaxLength(500) note!: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class LoyaltyRuleDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(60) code!: string;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsIn(['B2C', 'B2B']) channel?: 'B2C' | 'B2B';
  @IsInt() @Min(0) pointsPerEuro!: number;
  @IsInt() @Min(0) clubMultiplierBasisPoints!: number;
  @IsOptional() @IsInt() @Min(0) minimumOrderCents?: number;
  @IsOptional() @IsInt() @Min(0) maximumPointsPerOrder?: number;
  @IsInt() @Min(0) @Max(3650) pendingDays!: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsObject() configuration!: Record<string, unknown>;
}

export class IssueGiftCardDto {
  @IsInt() @Min(100) initialAmountCents!: number;
  @IsOptional() @IsEmail() recipientEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(500) message?: string;
  @IsOptional() @IsString() expiresAt?: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class GiftCardLookupDto {
  @IsString() @MaxLength(120) code!: string;
}

export class GiftCardBlockDto {
  @IsString() @MaxLength(500) reason!: string;
}
