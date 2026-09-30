import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CustomerType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CustomerQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(CustomerType) type?: CustomerType;
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}

export class CreateCustomerDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @Transform(email) @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) company?: string;
  @IsOptional() @Transform(trim) @Matches(/^\d{9}$/) taxNumber?: string;
  @IsOptional() @IsEnum(CustomerType) type?: CustomerType;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(3000) notes?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
