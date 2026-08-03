import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PaymentAgreementStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  ContactChannelDto,
  ContactTypeDto,
  type CreateContactEventDto,
  type UpdateAgreementDto,
} from './dto';

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAgreement(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    await this.prisma.$executeRaw`
      INSERT INTO "PaymentAgreement" (
        "id", "orderId", "status", "expectedAmountCents", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${orderId}::uuid, 'TO_AGREE'::"PaymentAgreementStatus",
        ${order.totalCents}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT ("orderId") DO NOTHING
    `;
    return this.detail(orderId);
  }

  async list(search?: string, status?: string, method?: string, due?: string) {
    await this.refreshOverdue();
    const q = search?.trim() || null;
    const s = status?.trim() || null;
    const m = method?.trim() || null;
    const d = due?.trim() || null;
    const now = new Date();
    const nextSevenDays = new Date(now.getTime() + 7 * 86_400_000);

    const dueFilter =
      d === 'WITHOUT_DUE_DATE'
        ? Prisma.sql`AND pa."dueAt" IS NULL`
        : d === 'OVERDUE'
          ? Prisma.sql`AND pa."status" = 'OVERDUE'::"PaymentAgreementStatus"`
          : d === 'NEXT_7_DAYS'
            ? Prisma.sql`AND pa."status" NOT IN ('PAID','CANCELLED','OVERDUE')
                AND pa."dueAt" >= ${now} AND pa."dueAt" <= ${nextSevenDays}`
            : d === 'FUTURE'
              ? Prisma.sql`AND pa."status" NOT IN ('PAID','CANCELLED','OVERDUE')
                  AND pa."dueAt" > ${nextSevenDays}`
              : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(
      Prisma.sql`
        SELECT pa.*, o."number", o."customerName", o."email", o."phone", o."paymentStatus",
               o."status" AS "orderStatus", o."createdAt" AS "orderCreatedAt"
        FROM "PaymentAgreement" pa
        JOIN "Order" o ON o."id" = pa."orderId"
        WHERE (${q}::text IS NULL OR o."number" ILIKE '%' || ${q} || '%'
          OR o."customerName" ILIKE '%' || ${q} || '%'
          OR o."email" ILIKE '%' || ${q} || '%')
          AND (${s}::text IS NULL OR pa."status"::text = ${s})
          AND (${m}::text IS NULL OR pa."method" = ${m})
          ${dueFilter}
        ORDER BY COALESCE(pa."dueAt", pa."createdAt") ASC
        LIMIT 250
      `,
    );

    const metrics = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        COALESCE(SUM(CASE WHEN pa."status" NOT IN ('PAID','CANCELLED') THEN pa."expectedAmountCents" ELSE 0 END),0)::int AS "outstandingCents",
        COALESCE(SUM(CASE WHEN pa."status" = 'OVERDUE' THEN pa."expectedAmountCents" ELSE 0 END),0)::int AS "overdueCents",
        COALESCE(SUM(CASE WHEN pa."status" NOT IN ('PAID','CANCELLED','OVERDUE')
          AND pa."dueAt" >= CURRENT_TIMESTAMP
          AND pa."dueAt" <= CURRENT_TIMESTAMP + INTERVAL '7 days'
          THEN pa."expectedAmountCents" ELSE 0 END),0)::int AS "upcomingCents",
        COUNT(*) FILTER (WHERE pa."status" = 'TO_AGREE')::int AS "toAgreeCount",
        COUNT(*) FILTER (WHERE pa."status" = 'OVERDUE')::int AS "overdueCount",
        COUNT(*) FILTER (WHERE pa."status" NOT IN ('PAID','CANCELLED','OVERDUE')
          AND pa."dueAt" >= CURRENT_TIMESTAMP
          AND pa."dueAt" <= CURRENT_TIMESTAMP + INTERVAL '7 days')::int AS "upcomingCount",
        COUNT(*) FILTER (WHERE pa."dueAt" IS NULL AND pa."status" NOT IN ('PAID','CANCELLED'))::int AS "withoutDueDateCount"
      FROM "PaymentAgreement" pa
    `;
    return { data: rows, metrics: metrics[0] ?? {} };
  }

  async detail(
    orderId: string,
  ): Promise<Record<string, unknown> & { events: Record<string, unknown>[] }> {
    await this.refreshOverdue();
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pa.*, o."number", o."customerName", o."email", o."phone", o."paymentStatus",
             o."status" AS "orderStatus", o."totalCents", o."createdAt" AS "orderCreatedAt"
      FROM "PaymentAgreement" pa
      JOIN "Order" o ON o."id" = pa."orderId"
      WHERE pa."orderId" = ${orderId}::uuid LIMIT 1
    `;
    const agreement = rows[0];
    if (!agreement)
      throw new NotFoundException('Acordo de pagamento não encontrado.');
    const events = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pce.*, u."firstName", u."lastName"
      FROM "PaymentContactEvent" pce
      LEFT JOIN "User" u ON u."id" = pce."authorId"
      WHERE pce."agreementId" = ${agreement.id as string}::uuid
      ORDER BY pce."createdAt" DESC
    `;
    return { ...agreement, events };
  }

  async update(orderId: string, body: UpdateAgreementDto, authorId: string) {
    const current = await this.ensureAgreement(orderId);
    const status = (body.status ??
      String(current.status)) as PaymentAgreementStatus;
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    const agreedAt = ['AGREED', 'AWAITING_PAYMENT'].includes(status)
      ? new Date()
      : null;
    await this.prisma.$executeRaw`
      UPDATE "PaymentAgreement" SET
        "status" = ${status}::"PaymentAgreementStatus",
        "method" = COALESCE(${body.method?.trim() ?? null}, "method"),
        "expectedAmountCents" = COALESCE(${body.expectedAmountCents ?? null}, "expectedAmountCents"),
        "dueAt" = COALESCE(${dueAt}, "dueAt"),
        "publicReference" = COALESCE(${body.publicReference?.trim() ?? null}, "publicReference"),
        "internalReference" = COALESCE(${body.internalReference?.trim() ?? null}, "internalReference"),
        "responsibleUserId" = COALESCE(${body.responsibleUserId ?? null}::uuid, "responsibleUserId"),
        "internalNotes" = COALESCE(${body.internalNotes?.trim() ?? null}, "internalNotes"),
        "agreedAt" = COALESCE(${agreedAt}, "agreedAt"),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "orderId" = ${orderId}::uuid
    `;
    await this.addEvent(
      orderId,
      {
        type:
          status === 'CANCELLED'
            ? ContactTypeDto.CANCELLED
            : ContactTypeDto.CONTACT_COMPLETED,
        channel: ContactChannelDto.OTHER,
        note: `Acordo atualizado para ${status}.`,
        idempotencyKey: `agreement:${orderId}:${status}:${Date.now()}`,
      },
      authorId,
    );
    return this.detail(orderId);
  }

  async addEvent(
    orderId: string,
    body: CreateContactEventDto,
    authorId?: string,
  ) {
    const agreement = await this.ensureAgreement(orderId);
    const key = body.idempotencyKey?.trim() || null;
    if (key) {
      const duplicate = await this.prisma.$queryRaw<
        Array<Record<string, unknown>>
      >`
        SELECT * FROM "PaymentContactEvent" WHERE "idempotencyKey" = ${key} LIMIT 1
      `;
      if (duplicate[0]) return duplicate[0];
    }
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "PaymentContactEvent" (
        "id", "agreementId", "type", "channel", "note", "authorId",
        "nextContactAt", "promisedPaymentAt", "idempotencyKey", "createdAt"
      ) VALUES (
        ${id}::uuid, ${agreement.id as string}::uuid, ${body.type}::"PaymentContactType",
        ${body.channel ?? null}::"PaymentContactChannel", ${body.note.trim()}, ${authorId ?? null}::uuid,
        ${body.nextContactAt ? new Date(body.nextContactAt) : null},
        ${body.promisedPaymentAt ? new Date(body.promisedPaymentAt) : null}, ${key}, CURRENT_TIMESTAMP
      )
    `;
    if (body.type === ContactTypeDto.PAYMENT_PROMISE) {
      await this.prisma.$executeRaw`
        UPDATE "PaymentAgreement" SET "status" = 'AWAITING_PAYMENT',
          "dueAt" = COALESCE(${body.promisedPaymentAt ? new Date(body.promisedPaymentAt) : null}, "dueAt"),
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${agreement.id as string}::uuid
      `;
    }
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "PaymentContactEvent" WHERE "id" = ${id}::uuid
    `;
    return rows[0];
  }

  async markPaid(
    orderId: string,
    authorId?: string,
    method?: string,
    reference?: string,
    note?: string,
  ) {
    await this.ensureAgreement(orderId);
    await this.prisma.$executeRaw`
      UPDATE "PaymentAgreement" SET "status" = 'PAID', "method" = COALESCE(${method ?? null}, "method"),
        "internalReference" = COALESCE(${reference ?? null}, "internalReference"), "paidAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP WHERE "orderId" = ${orderId}::uuid
    `;
    await this.addEvent(
      orderId,
      {
        type: ContactTypeDto.PAYMENT_CONFIRMED,
        channel: ContactChannelDto.OTHER,
        note: note?.trim() || 'Pagamento confirmado manualmente.',
        idempotencyKey: `agreement:${orderId}:paid`,
      },
      authorId,
    );
  }

  productionQueue() {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT o."id", o."number", o."customerName", o."email", o."status", o."paymentStatus",
             o."createdAt", o."customerNotes", pa."status" AS "agreementStatus", pa."dueAt",
             COUNT(oi."id")::int AS "itemCount", COALESCE(SUM(oi."quantity"),0)::int AS "unitCount"
      FROM "Order" o
      LEFT JOIN "PaymentAgreement" pa ON pa."orderId" = o."id"
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE o."status" IN ('PROCESSING','READY')
      GROUP BY o."id", pa."status", pa."dueAt"
      ORDER BY o."createdAt" ASC
    `;
  }

  private refreshOverdue() {
    return this.prisma.$executeRaw`
      UPDATE "PaymentAgreement" SET "status" = 'OVERDUE', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "status" IN ('AGREED','AWAITING_PAYMENT') AND "dueAt" < CURRENT_TIMESTAMP
    `;
  }
}
