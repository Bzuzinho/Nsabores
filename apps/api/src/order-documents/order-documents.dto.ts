import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UploadOrderDocumentDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsString()
  @IsIn([
    'INVOICE',
    'RECEIPT',
    'INVOICE_RECEIPT',
    'CREDIT_NOTE',
    'DELIVERY_NOTE',
    'OTHER',
  ])
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;
}
