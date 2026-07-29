import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ClubInterval = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface BillingSubscriptionResult {
  provider: string;
  providerCustomerId: string;
  providerSubscriptionId: string;
}

export interface BillingChargeResult {
  provider: string;
  providerPaymentId: string;
  status: 'PAID' | 'FAILED';
}

@Injectable()
export class ClubBillingProvider {
  constructor(private readonly config: ConfigService) {}

  name() {
    return this.config.get<string>('CLUB_BILLING_PROVIDER') ?? 'mock';
  }

  createSubscription(userId: string, idempotencyKey: string): BillingSubscriptionResult {
    return {
      provider: this.name(),
      providerCustomerId: `club_customer_${userId}`,
      providerSubscriptionId: `club_sub_${this.stableId(idempotencyKey)}`,
    };
  }

  charge(subscriptionId: string, idempotencyKey: string): BillingChargeResult {
    return {
      provider: this.name(),
      providerPaymentId: `club_pay_${this.stableId(`${subscriptionId}:${idempotencyKey}`)}`,
      status: 'PAID',
    };
  }

  nextPeriod(start: Date, interval: ClubInterval) {
    const months = interval === 'MONTHLY' ? 1 : interval === 'QUARTERLY' ? 3 : 12;
    const end = new Date(start);
    const day = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + months);
    const lastDay = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
    ).getUTCDate();
    end.setUTCDate(Math.min(day, lastDay));
    return end;
  }

  verifyWebhook(rawBody: string, signature?: string) {
    const secret = this.config.get<string>('CLUB_BILLING_WEBHOOK_SECRET') ?? '';
    if (!secret || !signature) return this.name() === 'mock';
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expected = Buffer.from(digest);
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  private stableId(value: string) {
    return (
      createHmac('sha256', 'nsabores-club-mock')
        .update(value)
        .digest('hex')
        .slice(0, 24) || randomUUID()
    );
  }
}
