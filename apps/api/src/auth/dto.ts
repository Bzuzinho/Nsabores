import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

export class RegisterDto {
  @Transform(email) @IsEmail() @MaxLength(254) email!: string;
  @IsString()
  @Matches(passwordPattern, {
    message:
      'A password deve ter 10 caracteres, maiúscula, minúscula e número.',
  })
  password!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
}

export class LoginDto {
  @Transform(email) @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}

export class TokenDto {
  @IsString() @Length(32, 256) token!: string;
}

export class ForgotPasswordDto {
  @Transform(email) @IsEmail() email!: string;
}

export class ResetPasswordDto extends TokenDto {
  @Matches(passwordPattern) password!: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @Matches(passwordPattern) newPassword!: string;
}

export class UpdateProfileDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\d{9}$/)
  taxNumber?: string;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
}

export class AddressDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) label!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) company?: string;
  @IsOptional() @Transform(trim) @Matches(/^\d{9}$/) taxNumber?: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(160) line1!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) line2?: string;
  @Transform(trim) @Matches(/^\d{4}-\d{3}$/) postalCode!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) city!: string;
  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsBoolean() isDefaultShipping?: boolean;
  @IsOptional() @IsBoolean() isDefaultBilling?: boolean;
}

export class UpdateAddressDto extends PartialType(AddressDto) {}

export class UsersQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['CUSTOMER', 'STAFF', 'ADMIN']) role?:
    'CUSTOMER' | 'STAFF' | 'ADMIN';
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  active?: boolean;
  @IsOptional() @Type(() => Number) page = 1;
  @IsOptional() @Type(() => Number) limit = 25;
}

export class UpdateUserAdminDto {
  @IsOptional() @IsIn(['CUSTOMER', 'STAFF', 'ADMIN']) role?:
    'CUSTOMER' | 'STAFF' | 'ADMIN';
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class InviteUserDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @IsIn(['CUSTOMER', 'STAFF', 'ADMIN']) role!: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}
