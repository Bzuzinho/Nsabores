import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClubBillingProvider, type ClubInterval } from './billing.provider';
import type { JoinClubDto } from './dto';
import { ClubService } from './club.service';

type PlanRow = {
  id: string;
  name: string;
  code: string;
  priceCents: number;
  currency: string;
  billingInterval: ClubInterval;
  trialDays: number | null;
  benefits: Record<string, unknown>;
};

type SubscriptionRow = {
  id: string;
  userId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  priceCentsSnapshot: number;
  currencySnapshot: string;
  billingIntervalSnapshot: ClubInterval;
};

type ChargeRow = {
  id: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
};

const normalizeCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '-');

export class ManualClubPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly club: ClubService,
    private readonly billing: ClubBillingProvider,
  ) {}

  isManual() {
    return this.config.get<string>('PAYMENT_FLOW_MODE') === 'manual';
  }

  async accountSubscription(userId: string) {
    if (!this.isManual()) return this.club.accountSubscription(userId);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ClubSubscription"
      WHERE "userId" = ${userId}::uuid
        AND "status" IN (
          'PENDING_ACTIVATION','TRIALING','ACTIVE','PAST_DUE','PAUSED','CANCEL_AT_PERIOD_END'
        )
      ORDER BY "createdAt" DESC LIMIT 1
    `;
    return rows[0] ? this.club.subscriptionDetail(rows[0].id, userId) : null;
  }

  async join(userId: string, body: JoinClubDto) {
    if (!this.isManual()) return this.club.join(userId, body);

    const existing = await this.accountSubscription(userId);
    if (existing) return existing;

    const plans = await this.prisma.$queryRaw<PlanRow[]>`
      SELECT "id", "name", "code", "priceCents", "currency", "billingInterval", "trialDays", "benefits"
      FROM "ClubPlan"
      WHERE "code" = ${normalizeCode(body.planCode)}
        AND "status" = 'ACTIVE'::"ClubPlanStatus"
      LIMIT 1
    `;
    const plan = plans[0];
    if (!plan) throw new NotFoundException('Plano do Clube indisponível.');

    if (plan.trialDays && plan.trialDays > 0) {
      return this.club.join(userId, body);
    }

    const subscriptionId = randomUUID();
    const chargeId = randomUUID();
    const now = new Date();
    const periodEnd = this.billing.nextPeriod(now, plan.billingInterval);
    const idempotencyKey = `club:${body.idempotencyKey}:initial`;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "ClubSubscription" (
            "id", "userId", "planId", "status", "provider",
            "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd",
            "priceCentsSnapshot", "currencySnapshot", "billingIntervalSnapshot",
            "planSnapshot", "createdAt", "updatedAt"
          ) VALUES (
            ${subscriptionId}::uuid, ${userId}::uuid, ${plan.id}::uuid,
            'PENDING_ACTIVATION'::"ClubSubscriptionStatus", 'manual',
            ${now}, ${periodEnd}, false, ${plan.priceCents}, ${plan.currency},
            ${plan.billingInterval}::"ClubBillingInterval",
            ${JSON.stringify({ id: plan.id, name: plan.name, code: plan.code, benefits: plan.benefits })}::jsonb,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;

        await tx.$executeRaw`
          INSERT INTO "ClubSubscriptionCharge" (
            "id", "subscriptionId", "periodStart", "periodEnd", "amountCents",
            "currency", "status", "provider", "idempotencyKey", "metadata",
            "createdAt", "updatedAt"
          ) VALUES (
            ${chargeId}::uuid, ${subscriptionId}::uuid, ${now}, ${periodEnd},
            ${plan.priceCents}, ${plan.currency}, 'PENDING'::"ClubChargeStatus",
            'manual', ${idempotencyKey},
            ${JSON.stringify({ kind: 'INITIAL_MEMBERSHIP' })}::jsonb,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;

        await tx.$executeRaw`
          INSERT INTO "ClubSubscriptionEvent" (
            "id", "subscriptionId", "type", "fromStatus", "toStatus",
            "note", "payload", "createdAt"
          ) VALUES (
            ${randomUUID()}::uuid, ${subscriptionId}::uuid,
            'CREATED'::"ClubSubscriptionEventType", NULL,
            'PENDING_ACTIVATION'::"ClubSubscriptionStatus",
            'Adesão criada e a aguardar confirmação manual do pagamento.',
            ${JSON.stringify({ chargeId })}::jsonb, CURRENT_TIMESTAMP
          )
        `;
      });
    } catch (error) {
      const current = await this.accountSubscription(userId);
      if (current) return current;
      throw error;
    }

    return this.club.subscriptionDetail(subscriptionId, userId);
  }

  async requestRenewal(subscriptionId: string) {
    if (!this.isManual()) return this.club.renew(subscriptionId);

    const current = await this.subscription(subscriptionId);
    if (!['ACTIVE', 'PAST_DUE', 'TRIALING'].includes(current.status)) {
      throw new ConflictException('Subscrição não renovável.');
    }

    const start = current.currentPeriodEnd;
    const end = this.billing.nextPeriod(start, current.billingIntervalSnapshot);
    const idempotencyKey = `club:${subscriptionId}:${start.toISOString()}`;

    await this.prisma.$executeRaw`
      INSERT INTO "ClubSubscriptionCharge" (
        "id", "subscriptionId", "periodStart", "periodEnd", "amountCents",
        "currency", "status", "provider", "idempotencyKey", "metadata",
        "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${subscriptionId}::uuid, ${start}, ${end},
        ${current.priceCentsSnapshot}, ${current.currencySnapshot},
        'PENDING'::"ClubChargeStatus", 'manual', ${idempotencyKey},
        ${JSON.stringify({ kind: 'RENEWAL' })}::jsonb,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT ("idempotencyKey") DO NOTHING
    `;

    return this.club.subscriptionDetail(subscriptionId);
  }

  async confirmCharge(
    subscriptionId: string,
    chargeId: string,
    authorId: string,
    reference?: string,
    note?: string,
  ) {
    if (!this.isManual()) {
      throw new ConflictException('A confirmação manual não está ativa.');
    }

    await this.prisma.$transaction(async (tx) => {
      const charges = await tx.$queryRaw<Array<ChargeRow & { subscriptionStatus: string }>>(
        Prisma.sql`
          SELECT c.*, s."status"::text AS "subscriptionStatus"
          FROM "ClubSubscriptionCharge" c
          JOIN "ClubSubscription" s ON s."id" = c."subscriptionId"
          WHERE c."id" = ${chargeId}::uuid
            AND c."subscriptionId" = ${subscriptionId}::uuid
          FOR UPDATE
        `,
      );
      const charge = charges[0];
      if (!charge) throw new NotFoundException('Cobrança do Clube não encontrada.');
      if (charge.status === 'PAID') return;
      if (charge.status !== 'PENDING') {
        throw new ConflictException('A cobrança não pode ser confirmada.');
      }

      await tx.$executeRaw`
        UPDATE "ClubSubscriptionCharge" SET
          "status" = 'PAID'::"ClubChargeStatus",
          "paidAt" = CURRENT_TIMESTAMP,
          "providerPaymentId" = COALESCE(${reference?.trim() || null}, "providerPaymentId"),
          "metadata" = COALESCE("metadata", '{}'::jsonb) ||
            ${JSON.stringify({ confirmedBy: authorId, note: note?.trim() || null })}::jsonb,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${chargeId}::uuid
      `;

      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET
          "status" = 'ACTIVE'::"ClubSubscriptionStatus",
          "currentPeriodStart" = ${charge.periodStart},
          "currentPeriodEnd" = ${charge.periodEnd},
          "trialEndsAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${subscriptionId}::uuid
      `;

      const eventType =
        charge.subscriptionStatus === 'PENDING_ACTIVATION'
          ? 'ACTIVATED'
          : 'RENEWED';
      await tx.$executeRaw`
        INSERT INTO "ClubSubscriptionEvent" (
          "id", "subscriptionId", "type", "fromStatus", "toStatus",
          "authorId", "note", "payload", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${subscriptionId}::uuid,
          ${eventType}::"ClubSubscriptionEventType",
          ${charge.subscriptionStatus}::"ClubSubscriptionStatus",
          'ACTIVE'::"ClubSubscriptionStatus", ${authorId}::uuid,
          ${note?.trim() || 'Pagamento confirmado manualmente.'},
          ${JSON.stringify({ chargeId, reference: reference?.trim() || null })}::jsonb,
          CURRENT_TIMESTAMP
        )
      `;

      await tx.$executeRaw`
        INSERT INTO "ClubSubscriptionEvent" (
          "id", "subscriptionId", "type", "fromStatus", "toStatus",
          "authorId", "note", "payload", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${subscriptionId}::uuid,
          'PAYMENT_CONFIRMED'::"ClubSubscriptionEventType",
          'ACTIVE'::"ClubSubscriptionStatus", 'ACTIVE'::"ClubSubscriptionStatus",
          ${authorId}::uuid, 'Cobrança do Clube confirmada.',
          ${JSON.stringify({ chargeId, reference: reference?.trim() || null })}::jsonb,
          CURRENT_TIMESTAMP
        )
      `;
    });

    return this.club.subscriptionDetail(subscriptionId);
  }

  private async subscription(id: string) {
    const rows = await this.prisma.$queryRaw<SubscriptionRow[]>`
      SELECT "id", "userId", "status", "currentPeriodStart", "currentPeriodEnd",
             "priceCentsSnapshot", "currencySnapshot", "billingIntervalSnapshot"
      FROM "ClubSubscription" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Subscrição não encontrada.');
    return rows[0];
  }
}
