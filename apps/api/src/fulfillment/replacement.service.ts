import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { OperationsService } from '../operations/operations.service';

interface ReturnReplacementRow {
  id: string;
  number: string;
  orderId: string;
  status: string;
  resolution: string;
}

interface ReturnReplacementItem {
  orderItemId: string;
  quantity: number;
  productId: string | null;
  productName: string;
  sku: string;
  imageUrl: string | null;
}

const replacementNumber = () =>
  `RPL-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;

@Injectable()
export class ReturnReplacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: OperationsService,
  ) {}

  async createReplacement(returnRequestId: string, authorId: string) {
    const requests = await this.prisma.$queryRaw<ReturnReplacementRow[]>`
      SELECT "id", "number", "orderId", "status", "resolution"
      FROM "ReturnRequest"
      WHERE "id" = ${returnRequestId}::uuid
      LIMIT 1
    `;
    const request = requests[0];
    if (!request) throw new NotFoundException('Devolução não encontrada.');
    if (request.resolution !== 'REPLACEMENT') {
      throw new ConflictException(
        'Esta devolução não está configurada para substituição.',
      );
    }
    if (!['INSPECTED', 'APPROVED'].includes(request.status)) {
      throw new ConflictException(
        'A devolução tem de estar aprovada ou inspecionada antes da substituição.',
      );
    }

    const idempotencyKey = `return:${returnRequestId}:replacement`;
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: { items: true, statusHistory: true },
    });
    if (existing) return existing;

    const original = await this.prisma.order.findUnique({
      where: { id: request.orderId },
    });
    if (!original)
      throw new NotFoundException('Encomenda original não encontrada.');

    const items = await this.prisma.$queryRaw<ReturnReplacementItem[]>`
      SELECT ri."orderItemId", ri."quantity", oi."productId", oi."productName", oi."sku", oi."imageUrl"
      FROM "ReturnItem" ri
      JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
      WHERE ri."returnRequestId" = ${returnRequestId}::uuid
      ORDER BY ri."createdAt" ASC
    `;
    if (!items.length)
      throw new ConflictException(
        'A devolução não tem artigos para substituir.',
      );
    if (items.some((item) => !item.productId)) {
      throw new ConflictException('Um dos produtos já não existe no catálogo.');
    }

    const replacementId = randomUUID();
    try {
      await this.prisma.order.create({
        data: {
          id: replacementId,
          number: replacementNumber(),
          userId: original.userId,
          email: original.email,
          customerName: original.customerName,
          phone: original.phone,
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
          subtotalCents: 0,
          shippingCents: 0,
          discountCents: 0,
          taxCents: 0,
          totalCents: 0,
          currency: original.currency,
          billingAddress:
            original.billingAddress === null
              ? Prisma.JsonNull
              : original.billingAddress,
          shippingAddress:
            original.shippingAddress === null
              ? Prisma.JsonNull
              : original.shippingAddress,
          customerNotes: undefined,
          internalNotes: `Encomenda de substituição criada a partir da devolução ${request.number} e da encomenda ${original.number}.`,
          source: 'RETURN_REPLACEMENT',
          deliveryMethodId: original.deliveryMethodId,
          idempotencyKey,
          salesChannel: original.salesChannel,
          businessAccountId: original.businessAccountId,
          priceListId: original.priceListId,
          paymentTermsSnapshot: original.paymentTermsSnapshot ?? undefined,
          customerReference: request.number,
          requiresApproval: false,
          approvedBy: authorId,
          approvedAt: new Date(),
          items: {
            create: items.map((item) => ({
              productId: item.productId!,
              productName: item.productName,
              sku: item.sku,
              unitPriceCents: 0,
              quantity: item.quantity,
              totalCents: 0,
              imageUrl: item.imageUrl,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.PAID,
              authorId,
              note: `Substituição autorizada na devolução ${request.number}.`,
            },
          },
        },
      });

      await this.operations.reserveOrder(replacementId);
    } catch (error) {
      await this.prisma.order.deleteMany({ where: { id: replacementId } });
      throw error;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ReturnRequest"
        SET "status" = 'CLOSED'::"ReturnRequestStatus",
            "closedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${returnRequestId}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO "ReturnEvent" (
          "id", "returnRequestId", "fromStatus", "toStatus", "authorId", "note", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${returnRequestId}::uuid,
          ${request.status}::"ReturnRequestStatus", 'CLOSED'::"ReturnRequestStatus",
          ${authorId}::uuid,
          ${`Encomenda de substituição ${replacementId} criada e stock reservado.`},
          CURRENT_TIMESTAMP
        )
      `;
    });

    return this.prisma.order.findUniqueOrThrow({
      where: { id: replacementId },
      include: { items: true, statusHistory: true, stockReservations: true },
    });
  }
}
