import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChangeClubPlanDto {
  @IsString() @MaxLength(60) planCode!: string;
}

export class ClubAdminActionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ClubWebhookDto {
  @IsString() @MaxLength(160) eventId!: string;
  @IsIn(['renewal.succeeded', 'payment.failed', 'subscription.cancelled'])
  type!: 'renewal.succeeded' | 'payment.failed' | 'subscription.cancelled';
  @IsString() subscriptionId!: string;
}
