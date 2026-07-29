import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PaymentProvider } from '../commerce/payment.provider';
import { CommerceMailProvider } from '../commerce/mail.provider';

interface ReturnRefundRow {
  id: string;
  number: string;
  orderId: string;
  status: string;
  resolution: string;
}

interface RefundMetadata {
  refundedCents?: number;
  refunds?: Array<{
    idempotencyKey: string;
    providerRefundId: string;
    amountCents: number;
    returnRequestId: string;
    createdAt: string;
  }>;
  [key: string]: unknown;
}

@Injectable()
export class ReturnRefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly mail: CommerceMailProvider,
  ) {}

  async refundReturn(returnRequestId: string, authorId: string) {
    if (!this.provider.supportsRefund()) {
      throw new ConflictException(
        'O provider de pagamentos não suporta reembolso.',
      );
    }

    const requests = await this.prisma.$queryRaw<ReturnRefundRow[]>`
      SELECT "id", "number", "orderId", "status", "resolution"
      FROM "ReturnRequest"
      WHERE "id" = ${returnRequestId}::uuid
      LIMIT 1
    `;
    const request = requests[0];
    if (!request) throw new NotFoundException('Devolução não encontrada.');
    if (request.resolution !== 'REFUND') {
      throw new ConflictException(
        'Esta devolução não está configurada para reembolso.',
      );
    }
    if (request.status === 'REFUNDED') {
      return this.refundSummary(returnRequestId);
    }
    if (!['INSPECTED', 'REFUND_PENDING'].includes(request.status)) {
      throw new ConflictException(
        'A devolução tem de estar inspecionada antes de emitir o reembolso.',
      );
    }

    const totals = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COALESCE(SUM("eligibleRefundCents"), 0)::bigint AS total
      FROM "ReturnItem"
      WHERE "returnRequestId" = ${returnRequestId}::uuid
    `;
    const amountCents = Number(totals[0]?.total ?? 0);
    if (amountCents <= 0) {
      throw new ConflictException(
        'A devolução não tem montante elegível para reembolso.',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId: request.orderId,
        status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment)
      throw new ConflictException(
        'Não existe pagamento elegível para reembolso.',
      );

    const metadata = this.paymentMetadata(payment.metadata);
    const idempotencyKey = `return:${returnRequestId}:refund`;
    const previous = metadata.refunds?.find(
      (refund) => refund.idempotencyKey === idempotencyKey,
    );
    if (previous) return this.refundSummary(returnRequestId);

    const alreadyRefunded = Number(metadata.refundedCents ?? 0);
    if (alreadyRefunded + amountCents > payment.amountCents) {
      throw new ConflictException(
        'O reembolso excede o montante do pagamento original.',
      );
    }

    const providerRefund = this.provider.refund(
      payment.providerPaymentId,
      amountCents,
      idempotencyKey,
    );
    const refundedCents = alreadyRefunded + amountCents;
    const fullRefund = refundedCents >= payment.amountCents;

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: request.orderId },
      });
      const nextPaymentStatus = fullRefund
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextPaymentStatus,
          metadata: {
            ...metadata,
            refundedCents,
            refunds: [
              ...(metadata.refunds ?? []),
              {
                idempotencyKey,
                providerRefundId: providerRefund.providerRefundId,
                amountCents,
                returnRequestId,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        },
      });

      await tx.order.update({
        where: { id: request.orderId },
        data: {
          paymentStatus: nextPaymentStatus,
          ...(fullRefund && order.status !== OrderStatus.REFUNDED
            ? {
                status: OrderStatus.REFUNDED,
                statusHistory: {
                  create: {
                    fromStatus: order.status,
                    toStatus: OrderStatus.REFUNDED,
                    authorId,
                    note: `Reembolso integral associado à devolução ${request.number}.`,
                  },
                },
              }
            : {}),
        },
      });

      await tx.$executeRaw`
        UPDATE "ReturnRequest"
        SET "status" = 'REFUNDED'::"ReturnRequestStatus",
            "closedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${returnRequestId}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO "ReturnEvent" (
          "id", "returnRequestId", "fromStatus", "toStatus", "authorId", "note", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${returnRequestId}::uuid,
          ${request.status}::"ReturnRequestStatus", 'REFUNDED'::"ReturnRequestStatus",
          ${authorId}::uuid,
          ${`Reembolso ${providerRefund.providerRefundId} emitido no valor de ${amountCents} cêntimos.`},
          CURRENT_TIMESTAMP
        )
      `;
    });

    const order = await this.prisma.order.findUnique({
      where: { id: request.orderId },
      select: { email: true, number: true },
    });
    if (order) this.mail.send('ORDER_REFUNDED', order.email, order.number);

    return this.refundSummary(returnRequestId);
  }

  private async refundSummary(returnRequestId: string) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT rr."id", rr."number", rr."orderId", rr."status", rr."resolution",
             COALESCE(SUM(ri."eligibleRefundCents"), 0)::int AS "refundedCents"
      FROM "ReturnRequest" rr
      LEFT JOIN "ReturnItem" ri ON ri."returnRequestId" = rr."id"
      WHERE rr."id" = ${returnRequestId}::uuid
      GROUP BY rr."id", rr."number", rr."orderId", rr."status", rr."resolution"
    `;
    return rows[0];
  }

  private paymentMetadata(value: Prisma.JsonValue | null): RefundMetadata {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value;
  }
}
