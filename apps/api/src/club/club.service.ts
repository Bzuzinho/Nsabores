import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClubBillingProvider, type ClubInterval } from './billing.provider';
import type { ClubCancelDto, ClubPlanDto, JoinClubDto } from './dto';
import { isClubSchemaUnavailable } from './schema-compat';

type PlanRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  status: string;
  priceCents: number;
  currency: string;
  billingInterval: ClubInterval;
  trialDays: number | null;
  benefits: Record<string, unknown>;
  isPublic: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type SubscriptionRow = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  priceCentsSnapshot: number;
  currencySnapshot: string;
  billingIntervalSnapshot: ClubInterval;
  planSnapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const code = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '-');

@Injectable()
export class ClubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ClubBillingProvider,
  ) {}

  async publicPlans() {
    try {
      return await this.prisma.$queryRaw<PlanRow[]>`
        SELECT * FROM "ClubPlan"
        WHERE "status" = 'ACTIVE'::"ClubPlanStatus" AND "isPublic" = true
        ORDER BY "sortOrder" ASC, "createdAt" ASC
      `;
    } catch (error) {
      if (isClubSchemaUnavailable(error)) return [];
      throw error;
    }
  }

  async plans() {
    try {
      return await this.prisma.$queryRaw<PlanRow[]>`
        SELECT * FROM "ClubPlan" ORDER BY "sortOrder" ASC, "createdAt" DESC
      `;
    } catch (error) {
      if (isClubSchemaUnavailable(error)) return [];
      throw error;
    }
  }

  async plan(id: string) {
    const rows = await this.prisma.$queryRaw<PlanRow[]>`
      SELECT * FROM "ClubPlan" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Plano do Clube não encontrado.');
    return rows[0];
  }

  async createPlan(body: ClubPlanDto) {
    this.validatePlan(body);
    const id = randomUUID();
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "ClubPlan" (
          "id", "name", "code", "description", "status", "priceCents", "currency",
          "billingInterval", "trialDays", "benefits", "isPublic", "sortOrder", "createdAt", "updatedAt"
        ) VALUES (
          ${id}::uuid, ${body.name.trim()}, ${code(body.code)}, ${body.description.trim()},
          ${body.status}::"ClubPlanStatus", ${body.priceCents}, 'EUR',
          ${body.billingInterval}::"ClubBillingInterval", ${body.trialDays ?? null},
          ${JSON.stringify(body.benefits)}::jsonb, ${body.isPublic}, ${body.sortOrder},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException('Já existe um plano com esse código.');
      throw error;
    }
    return this.plan(id);
  }

  async updatePlan(id: string, body: ClubPlanDto) {
    await this.plan(id);
    this.validatePlan(body);
    try {
      await this.prisma.$executeRaw`
        UPDATE "ClubPlan" SET
          "name" = ${body.name.trim()}, "code" = ${code(body.code)},
          "description" = ${body.description.trim()},
          "status" = ${body.status}::"ClubPlanStatus", "priceCents" = ${body.priceCents},
          "billingInterval" = ${body.billingInterval}::"ClubBillingInterval",
          "trialDays" = ${body.trialDays ?? null},
          "benefits" = ${JSON.stringify(body.benefits)}::jsonb,
          "isPublic" = ${body.isPublic}, "sortOrder" = ${body.sortOrder},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}::uuid
      `;
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException('Já existe um plano com esse código.');
      throw error;
    }
    return this.plan(id);
  }

  async accountSubscription(userId: string) {
    let rows: SubscriptionRow[];
    try {
      rows = await this.prisma.$queryRaw<SubscriptionRow[]>`
        SELECT * FROM "ClubSubscription"
        WHERE "userId" = ${userId}::uuid
          AND "status" IN ('TRIALING','ACTIVE','PAST_DUE','PAUSED','CANCEL_AT_PERIOD_END')
        ORDER BY "createdAt" DESC LIMIT 1
      `;
    } catch (error) {
      if (isClubSchemaUnavailable(error)) return null;
      throw error;
    }
    if (!rows[0]) return null;
    return this.subscriptionDetail(rows[0].id, userId);
  }

  async join(userId: string, body: JoinClubDto) {
    const existing = await this.accountSubscription(userId);
    if (existing) return existing;
    const plans = await this.prisma.$queryRaw<PlanRow[]>`
      SELECT * FROM "ClubPlan"
      WHERE "code" = ${code(body.planCode)} AND "status" = 'ACTIVE'::"ClubPlanStatus"
      LIMIT 1
    `;
    const plan = plans[0];
    if (!plan) throw new BadRequestException('Plano do Clube indisponível.');

    const now = new Date();
    const trialEndsAt = plan.trialDays
      ? new Date(now.getTime() + plan.trialDays * 86_400_000)
      : null;
    const periodEnd =
      trialEndsAt ?? this.billing.nextPeriod(now, plan.billingInterval);
    const status = trialEndsAt ? 'TRIALING' : 'ACTIVE';
    const provider = this.billing.createSubscription(
      userId,
      body.idempotencyKey,
    );
    const subscriptionId = randomUUID();

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "ClubSubscription" (
            "id", "userId", "planId", "status", "provider", "providerCustomerId", "providerSubscriptionId",
            "currentPeriodStart", "currentPeriodEnd", "trialEndsAt", "cancelAtPeriodEnd", "priceCentsSnapshot",
            "currencySnapshot", "billingIntervalSnapshot", "planSnapshot", "createdAt", "updatedAt"
          ) VALUES (
            ${subscriptionId}::uuid, ${userId}::uuid, ${plan.id}::uuid,
            ${status}::"ClubSubscriptionStatus", ${provider.provider},
            ${provider.providerCustomerId}, ${provider.providerSubscriptionId},
            ${now}, ${periodEnd}, ${trialEndsAt}, false, ${plan.priceCents},
            ${plan.currency}, ${plan.billingInterval}::"ClubBillingInterval",
            ${JSON.stringify({ id: plan.id, name: plan.name, code: plan.code, benefits: plan.benefits })}::jsonb,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        await this.event(
          tx,
          subscriptionId,
          trialEndsAt ? 'TRIAL_STARTED' : 'ACTIVATED',
          null,
          status,
          null,
          trialEndsAt
            ? 'Período experimental iniciado.'
            : 'Subscrição ativada.',
        );
        if (!trialEndsAt) {
          await this.createPaidCharge(
            tx,
            subscriptionId,
            now,
            periodEnd,
            plan.priceCents,
            plan.currency,
            `club:${body.idempotencyKey}:initial`,
          );
        }
      });
    } catch (error) {
      if (this.isUnique(error)) {
        const current = await this.accountSubscription(userId);
        if (current) return current;
        throw new ConflictException('A adesão já foi processada.');
      }
      throw error;
    }
    return this.subscriptionDetail(subscriptionId, userId);
  }

  async cancel(userId: string, body: ClubCancelDto) {
    const current = await this.requireAccountSubscription(userId);
    if (current.status === 'CANCEL_AT_PERIOD_END')
      return this.subscriptionDetail(current.id, userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET
          "status" = 'CANCEL_AT_PERIOD_END', "cancelAtPeriodEnd" = true,
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${current.id}::uuid
      `;
      await this.event(
        tx,
        current.id,
        'CANCEL_SCHEDULED',
        current.status,
        'CANCEL_AT_PERIOD_END',
        userId,
        body.reason ?? 'Cancelamento agendado pelo cliente.',
      );
    });
    return this.subscriptionDetail(current.id, userId);
  }

  async resume(userId: string) {
    const current = await this.requireAccountSubscription(userId);
    if (current.status !== 'CANCEL_AT_PERIOD_END')
      throw new ConflictException(
        'A subscrição não tem cancelamento agendado.',
      );
    const nextStatus =
      current.trialEndsAt && current.trialEndsAt > new Date()
        ? 'TRIALING'
        : 'ACTIVE';
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET
          "status" = ${nextStatus}::"ClubSubscriptionStatus",
          "cancelAtPeriodEnd" = false, "cancelledAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${current.id}::uuid
      `;
      await this.event(
        tx,
        current.id,
        'RESUMED',
        current.status,
        nextStatus,
        userId,
        'Subscrição retomada.',
      );
    });
    return this.subscriptionDetail(current.id, userId);
  }

  async renew(subscriptionId: string, providerEventId?: string) {
    const current = await this.subscription(subscriptionId);
    if (providerEventId) {
      const duplicate = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ClubSubscriptionEvent"
        WHERE "providerEventId" = ${providerEventId} LIMIT 1
      `;
      if (duplicate[0]) return this.subscriptionDetail(subscriptionId);
    }
    if (
      current.cancelAtPeriodEnd ||
      current.status === 'CANCEL_AT_PERIOD_END'
    ) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "ClubSubscription" SET
            "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${subscriptionId}::uuid
        `;
        await this.event(
          tx,
          subscriptionId,
          'CANCELLED',
          current.status,
          'CANCELLED',
          null,
          'Cancelamento efetivo no fim do período.',
          providerEventId,
        );
      });
      return this.subscriptionDetail(subscriptionId);
    }
    if (!['ACTIVE', 'PAST_DUE', 'TRIALING'].includes(current.status))
      throw new ConflictException('Subscrição não renovável.');
    const start = current.currentPeriodEnd;
    const end = this.billing.nextPeriod(start, current.billingIntervalSnapshot);
    await this.prisma.$transaction(async (tx) => {
      await this.createPaidCharge(
        tx,
        subscriptionId,
        start,
        end,
        current.priceCentsSnapshot,
        current.currencySnapshot,
        `club:${subscriptionId}:${start.toISOString()}`,
      );
      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET
          "status" = 'ACTIVE', "currentPeriodStart" = ${start},
          "currentPeriodEnd" = ${end}, "trialEndsAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${subscriptionId}::uuid
      `;
      await this.event(
        tx,
        subscriptionId,
        'RENEWED',
        current.status,
        'ACTIVE',
        null,
        'Subscrição renovada.',
        providerEventId,
      );
    });
    return this.subscriptionDetail(subscriptionId);
  }

  async subscriptions() {
    try {
      return await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT s.*, u."email", u."firstName", u."lastName",
               p."name" AS "planName", p."code" AS "planCode"
        FROM "ClubSubscription" s
        JOIN "User" u ON u."id" = s."userId"
        JOIN "ClubPlan" p ON p."id" = s."planId"
        ORDER BY s."createdAt" DESC
      `;
    } catch (error) {
      if (isClubSchemaUnavailable(error)) return [];
      throw error;
    }
  }

  async subscriptionDetail(id: string, userId?: string) {
    const owner = userId
      ? Prisma.sql`AND s."userId" = ${userId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<SubscriptionRow & Record<string, unknown>>
    >(
      Prisma.sql`
        SELECT s.*, p."name" AS "planName", p."code" AS "planCode", p."benefits"
        FROM "ClubSubscription" s
        JOIN "ClubPlan" p ON p."id" = s."planId"
        WHERE s."id" = ${id}::uuid ${owner} LIMIT 1
      `,
    );
    if (!rows[0]) throw new NotFoundException('Subscrição não encontrada.');
    const [events, charges] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "ClubSubscriptionEvent"
        WHERE "subscriptionId" = ${id}::uuid ORDER BY "createdAt" ASC
      `,
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "ClubSubscriptionCharge"
        WHERE "subscriptionId" = ${id}::uuid ORDER BY "periodStart" DESC
      `,
    ]);
    return { ...rows[0], events, charges };
  }

  private async subscription(id: string) {
    const rows = await this.prisma.$queryRaw<SubscriptionRow[]>`
      SELECT * FROM "ClubSubscription" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Subscrição não encontrada.');
    return rows[0];
  }

  private async requireAccountSubscription(userId: string) {
    const current = await this.accountSubscription(userId);
    if (!current || typeof current.id !== 'string')
      throw new NotFoundException('Não existe subscrição ativa.');
    return current as unknown as SubscriptionRow;
  }

  private async createPaidCharge(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    start: Date,
    end: Date,
    amountCents: number,
    currency: string,
    idempotencyKey: string,
  ) {
    const payment = this.billing.charge(subscriptionId, idempotencyKey);
    await tx.$executeRaw`
      INSERT INTO "ClubSubscriptionCharge" (
        "id", "subscriptionId", "periodStart", "periodEnd", "amountCents", "currency",
        "status", "provider", "providerPaymentId", "idempotencyKey", "paidAt",
        "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${subscriptionId}::uuid, ${start}, ${end},
        ${amountCents}, ${currency}, ${payment.status}::"ClubChargeStatus",
        ${payment.provider}, ${payment.providerPaymentId}, ${idempotencyKey},
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT ("idempotencyKey") DO NOTHING
    `;
  }

  private async event(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    type: string,
    from: string | null,
    to: string | null,
    authorId: string | null,
    note: string,
    providerEventId?: string,
  ) {
    await tx.$executeRaw`
      INSERT INTO "ClubSubscriptionEvent" (
        "id", "subscriptionId", "type", "fromStatus", "toStatus",
        "providerEventId", "authorId", "note", "createdAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${subscriptionId}::uuid,
        ${type}::"ClubSubscriptionEventType", ${from}::"ClubSubscriptionStatus",
        ${to}::"ClubSubscriptionStatus", ${providerEventId ?? null},
        ${authorId}::uuid, ${note}, CURRENT_TIMESTAMP
      ) ON CONFLICT ("providerEventId")
        WHERE "providerEventId" IS NOT NULL DO NOTHING
    `;
  }

  private validatePlan(body: ClubPlanDto) {
    if (!body.name.trim() || !code(body.code))
      throw new BadRequestException('Nome e código do plano são obrigatórios.');
  }

  private isUnique(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    return text.includes('23505') || text.toLowerCase().includes('unique');
  }
}
