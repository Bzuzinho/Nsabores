import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { StockStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localOrHttpUrl = /^(\/images\/[a-zA-Z0-9._/-]+|https?:\/\/.+)$/;

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class ProductQueryDto {
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  featured?: boolean;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsEnum(['name', 'price', 'createdAt']) sort = 'createdAt';
  @IsOptional() @IsEnum(['asc', 'desc']) order: 'asc' | 'desc' = 'desc';
  @IsOptional() @IsEnum(StockStatus) stockStatus?: StockStatus;
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  active?: boolean;
}

export class CategoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  active?: boolean;
}

export class CreateCategoryDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsString() @Matches(slugPattern) @MaxLength(100) slug!: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  description?: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(localOrHttpUrl)
  imageUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateProductDto {
  @IsString() @IsNotEmpty() @MaxLength(140) name!: string;
  @IsString() @Matches(slugPattern) @MaxLength(140) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(240) shortDescription!: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(4000)
  description?: string;
  @IsString() @Matches(/^[A-Z0-9][A-Z0-9._-]*$/) @MaxLength(60) sku!: string;
  @IsInt() @Min(0) priceCents!: number;
  @IsOptional() @IsInt() @Min(0) compareAtPriceCents?: number;
  @Matches(localOrHttpUrl) imageUrl!: string;
  @IsOptional()
  @IsArray()
  @Matches(localOrHttpUrl, { each: true })
  gallery?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsEnum(StockStatus) stockStatus?: StockStatus;
  @IsString() @IsNotEmpty() categoryId!: string;

  @ValidateIf(
    (item: CreateProductDto) => item.compareAtPriceCents !== undefined,
  )
  validComparePrice() {
    return (
      this.compareAtPriceCents === undefined ||
      this.compareAtPriceCents > this.priceCents
    );
  }
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
