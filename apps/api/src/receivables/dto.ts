import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum AgreementStatusDto {
  TO_AGREE = 'TO_AGREE',
  AGREED = 'AGREED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ContactTypeDto {
  CONTACT_ATTEMPT = 'CONTACT_ATTEMPT',
  CONTACT_COMPLETED = 'CONTACT_COMPLETED',
  INSTRUCTIONS_SENT = 'INSTRUCTIONS_SENT',
  PAYMENT_PROMISE = 'PAYMENT_PROMISE',
  PROOF_RECEIVED = 'PROOF_RECEIVED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ContactChannelDto {
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  IN_PERSON = 'IN_PERSON',
  OTHER = 'OTHER',
}

export class UpdateAgreementDto {
  @IsOptional()
  @IsEnum(AgreementStatusDto)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  method?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedAmountCents?: number;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publicReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  internalReference?: string;

  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  internalNotes?: string;
}

export class CreateContactEventDto {
  @IsEnum(ContactTypeDto)
  type!: string;

  @IsOptional()
  @IsEnum(ContactChannelDto)
  channel?: string;

  @IsString()
  @MaxLength(2000)
  note!: string;

  @IsOptional()
  @IsString()
  nextContactAt?: string;

  @IsOptional()
  @IsString()
  promisedPaymentAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}
