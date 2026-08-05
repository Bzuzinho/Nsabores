import { PartialType } from '@nestjs/mapped-types';
import { BlogPostStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localOrHttpUrl = /^(\/images\/[a-zA-Z0-9._/-]+|https?:\/\/.+)$/;
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class BlogQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsEnum(BlogPostStatus) status?: BlogPostStatus;
}

export class CreateBlogPostDto {
  @IsString() @IsNotEmpty() @MaxLength(180) title!: string;
  @IsString() @Matches(slugPattern) @MaxLength(180) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(600) excerpt!: string;
  @IsString() @IsNotEmpty() @MaxLength(50_000) content!: string;
  @IsString() @Matches(localOrHttpUrl) coverImageUrl!: string;
  @IsString() @IsNotEmpty() @MaxLength(220) imageAlt!: string;
  @IsOptional() @IsEnum(BlogPostStatus) status?: BlogPostStatus;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsISO8601()
  publishedAt?: string;
}

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {}

export class ContactRequestDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(180) email!: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(40)
  phone?: string;
  @IsString()
  @IsIn(['PRODUCTS', 'EVENTS', 'BUSINESS', 'CLUB', 'OTHER'])
  topic!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) message!: string;
  @Equals(true) privacyAccepted!: boolean;
  @IsOptional() @IsString() @MaxLength(0) website?: string;
}
