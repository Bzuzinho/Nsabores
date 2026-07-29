import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ClubBillingProvider, type ClubInterval } from './billing.provider';
import { ClubService } from './club.service';
import type { ClubWebhookDto } from './operations.dto';

type CurrentSubscription = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  billingIntervalSnapshot: ClubInterval;
};

type PlanRow = {
  id: string;
  name: string;
  code: string;
  priceCents: number;
  currency: string;
  billingInterval: ClubInterval;
  benefits: Record<string, unknown>;
};

@Injectable()
export class ClubOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ClubBillingProvider,
    private readonly club: ClubService,
  ) {}

  async changePlan(userId: string, planCode: string) {
    const current = await this.currentForUser(userId);
    const plans = await this.prisma.$queryRaw<PlanRow[]>`
      SELECT "id", "name", "code", "priceCents", "currency", "billingInterval", "benefits"
      FROM "ClubPlan"
      WHERE "code" = ${planCode.trim().toUpperCase()} AND "status" = 'ACTIVE'::"ClubPlanStatus"
      LIMIT 1
    `;
    const plan = plans[0];
    if (!plan) throw new BadRequestException('Novo plano indisponível.');
    if (plan.id === current.planId)
      return this.club.subscriptionDetail(current.id, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET
          "planId" = ${plan.id}::uuid,
          "priceCentsSnapshot" = ${plan.priceCents},
          "currencySnapshot" = ${plan.currency},
          "billingIntervalSnapshot" = ${plan.billingInterval}::"ClubBillingInterval",
          "planSnapshot" = ${JSON.stringify({ id: plan.id, name: plan.name, code: plan.code, benefits: plan.benefits })}::jsonb,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${current.id}::uuid
      `;
      await this.event(
        tx,
        current.id,
        'PLAN_CHANGED',
        current.status,
        current.status,
        userId,
        `Plano alterado para ${plan.code}. O provider mock não aplica prorrata.`,
      );
    });
    return this.club.subscriptionDetail(current.id, userId);
  }

  async scheduleCancel(
    subscriptionId: string,
    authorId: string,
    reason?: string,
  ) {
    const current = await this.subscription(subscriptionId);
    if (['CANCELLED', 'EXPIRED'].includes(current.status))
      throw new ConflictException('A subscrição já terminou.');
    if (current.status === 'CANCEL_AT_PERIOD_END')
      return this.club.subscriptionDetail(subscriptionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET "status" = 'CANCEL_AT_PERIOD_END', "cancelAtPeriodEnd" = true,
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${subscriptionId}::uuid
      `;
      await this.event(
        tx,
        subscriptionId,
        'CANCEL_SCHEDULED',
        current.status,
        'CANCEL_AT_PERIOD_END',
        authorId,
        reason ?? 'Cancelamento agendado administrativamente.',
      );
    });
    return this.club.subscriptionDetail(subscriptionId);
  }

  async resume(subscriptionId: string, authorId: string, reason?: string) {
    const current = await this.subscription(subscriptionId);
    if (current.status !== 'CANCEL_AT_PERIOD_END')
      throw new ConflictException(
        'A subscrição não tem cancelamento agendado.',
      );
    const next = current.currentPeriodEnd > new Date() ? 'ACTIVE' : 'EXPIRED';
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET "status" = ${next}::"ClubSubscriptionStatus",
          "cancelAtPeriodEnd" = false, "cancelledAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${subscriptionId}::uuid
      `;
      await this.event(
        tx,
        subscriptionId,
        'RESUMED',
        current.status,
        next,
        authorId,
        reason ?? 'Cancelamento removido administrativamente.',
      );
    });
    return this.club.subscriptionDetail(subscriptionId);
  }

  async handleWebhook(body: ClubWebhookDto, signature?: string) {
    if (!this.billing.verifyWebhook(JSON.stringify(body), signature)) {
      throw new UnauthorizedException('Assinatura de webhook inválida.');
    }
    const duplicate = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ClubSubscriptionEvent" WHERE "providerEventId" = ${body.eventId} LIMIT 1
    `;
    if (duplicate[0]) return { received: true, duplicate: true };

    if (body.type === 'renewal.succeeded') {
      await this.club.renew(body.subscriptionId, body.eventId);
      return { received: true };
    }

    const current = await this.subscription(body.subscriptionId);
    if (body.type === 'payment.failed') {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "ClubSubscription" SET "status" = 'PAST_DUE', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${body.subscriptionId}::uuid
        `;
        await this.event(
          tx,
          body.subscriptionId,
          'PAYMENT_FAILED',
          current.status,
          'PAST_DUE',
          null,
          'Pagamento recorrente falhou.',
          body.eventId,
        );
      });
      return { received: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ClubSubscription" SET "status" = 'CANCELLED', "cancelAtPeriodEnd" = false,
          "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${body.subscriptionId}::uuid
      `;
      await this.event(
        tx,
        body.subscriptionId,
        'CANCELLED',
        current.status,
        'CANCELLED',
        null,
        'Cancelamento confirmado pelo provider.',
        body.eventId,
      );
    });
    return { received: true };
  }

  private async currentForUser(userId: string) {
    const rows = await this.prisma.$queryRaw<CurrentSubscription[]>`
      SELECT "id", "userId", "planId", "status", "currentPeriodStart", "currentPeriodEnd",
             "cancelAtPeriodEnd", "billingIntervalSnapshot"
      FROM "ClubSubscription"
      WHERE "userId" = ${userId}::uuid
        AND "status" IN ('TRIALING','ACTIVE','PAST_DUE','PAUSED','CANCEL_AT_PERIOD_END')
      ORDER BY "createdAt" DESC LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Não existe subscrição ativa.');
    return rows[0];
  }

  private async subscription(id: string) {
    const rows = await this.prisma.$queryRaw<CurrentSubscription[]>`
      SELECT "id", "userId", "planId", "status", "currentPeriodStart", "currentPeriodEnd",
             "cancelAtPeriodEnd", "billingIntervalSnapshot"
      FROM "ClubSubscription" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Subscrição não encontrada.');
    return rows[0];
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
        "id", "subscriptionId", "type", "fromStatus", "toStatus", "providerEventId", "authorId", "note", "createdAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${subscriptionId}::uuid, ${type}::"ClubSubscriptionEventType",
        ${from}::"ClubSubscriptionStatus", ${to}::"ClubSubscriptionStatus", ${providerEventId ?? null},
        ${authorId}::uuid, ${note}, CURRENT_TIMESTAMP
      ) ON CONFLICT ("providerEventId") WHERE "providerEventId" IS NOT NULL DO NOTHING
    `;
  }
}
