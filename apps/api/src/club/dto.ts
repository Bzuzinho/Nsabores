import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ClubPlanDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(60) code!: string;
  @IsString() @MaxLength(1000) description!: string;
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']) status!: string;
  @IsInt() @Min(0) priceCents!: number;
  @IsIn(['MONTHLY', 'QUARTERLY', 'YEARLY']) billingInterval!: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) trialDays?: number;
  @IsObject() benefits!: Record<string, unknown>;
  @IsBoolean() isPublic!: boolean;
  @IsInt() sortOrder!: number;
}

export class JoinClubDto {
  @IsString() @MaxLength(60) planCode!: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class ClubCancelDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
