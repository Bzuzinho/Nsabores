import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ProductionPriority, ProductionWorkStatus } from '@prisma/client';

export class UpdateProductionDto {
  @IsOptional() @IsEnum(ProductionPriority) priority?: ProductionPriority;
  @IsOptional() @IsEnum(ProductionWorkStatus) status?: ProductionWorkStatus;
  @IsOptional() @IsString() targetDate?: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsString() @MaxLength(3000) productionNotes?: string;
}

export class CompleteProductionDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
