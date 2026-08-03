import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FiscalDocumentStatus,
  FiscalDocumentType,
  FiscalEventType,
  FiscalSourceType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FiscalService {
  constructor(private readonly prisma: PrismaService) {}

  async issueOrder(
    orderId: string,
    authorId?: string,
    type: FiscalDocumentType = FiscalDocumentType.INVOICE_RECEIPT,
  ) {
    const existing = await this.prisma.fiscalDocument.findFirst({
      where: {
        sourceType: FiscalSourceType.ORDER,
        sourceId: orderId,
        type,
      },
      include: { lines: { orderBy: { position: 'asc' } }, events: true },
    });
    if (existing) return existing;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new ConflictException(
        'O documento só pode ser emitido após confirmação do pagamento.',
      );
    }

    const year = new Date().getUTCFullYear();
    const seriesCode = `ONLINE-${year}`;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.fiscalDocument.findFirst({
            where: {
              sourceType: FiscalSourceType.ORDER,
              sourceId: orderId,
              type,
            },
            include: {
              lines: { orderBy: { position: 'asc' } },
              events: true,
            },
          });
          if (duplicate) return duplicate;

          const series = await tx.fiscalSeries.upsert({
            where: {
              code_documentType_year: {
                code: seriesCode,
                documentType: type,
                year,
              },
            },
            create: {
              code: seriesCode,
              documentType: type,
              prefix: `${this.typePrefix(type)} ${year}/`,
              year,
              nextNumber: 1,
              isActive: true,
            },
            update: {},
          });

          const allocated = await tx.$queryRaw<
            Array<{ sequentialNumber: number; prefix: string }>
          >(Prisma.sql`
            UPDATE "FiscalSeries"
            SET "nextNumber" = "nextNumber" + 1,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${series.id}::uuid AND "isActive" = true
            RETURNING "nextNumber" - 1 AS "sequentialNumber", "prefix"
          `);
          const sequence = allocated[0];
          if (!sequence) {
            throw new ConflictException('A série fiscal não está ativa.');
          }

          const documentId = randomUUID();
          const number = `${sequence.prefix}${String(sequence.sequentialNumber).padStart(6, '0')}`;
          const customerSnapshot: Prisma.InputJsonObject = {
            userId: order.userId,
            name: order.customerName,
            email: order.email,
            phone: order.phone,
          };
          const billingSnapshot = order.billingAddress as Prisma.InputJsonValue;

          await tx.fiscalDocument.create({
            data: {
              id: documentId,
              seriesId: series.id,
              type,
              status: FiscalDocumentStatus.ISSUED,
              sourceType: FiscalSourceType.ORDER,
              sourceId: order.id,
              customerUserId: order.userId,
              sequentialNumber: sequence.sequentialNumber,
              number,
              currency: order.currency,
              subtotalCents: order.subtotalCents,
              discountCents: order.discountCents,
              taxCents: order.taxCents,
              totalCents: order.totalCents,
              customerSnapshot,
              billingSnapshot,
              metadata: {
                orderNumber: order.number,
                paymentStatus: order.paymentStatus,
              },
              provider: 'manual',
              issuedAt: new Date(),
              createdById: authorId,
              lines: {
                create: order.items.map((item, index) => ({
                  position: index + 1,
                  description: item.productName,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPriceCents: item.unitPriceCents,
                  discountCents: 0,
                  taxRateBasisPoints: 0,
                  taxCents: 0,
                  totalCents: item.totalCents,
                  sourceLineId: item.id,
                  snapshot: {
                    imageUrl: item.imageUrl,
                  },
                })),
              },
              events: {
                create: [
                  {
                    type: FiscalEventType.CREATED,
                    authorId,
                    note: 'Documento criado a partir de encomenda paga.',
                  },
                  {
                    type: FiscalEventType.ISSUED,
                    authorId,
                    note: `Documento emitido com o número ${number}.`,
                  },
                ],
              },
            },
          });

          return tx.fiscalDocument.findUniqueOrThrow({
            where: { id: documentId },
            include: {
              lines: { orderBy: { position: 'asc' } },
              events: { orderBy: { createdAt: 'asc' } },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.prisma.fiscalDocument.findFirst({
          where: {
            sourceType: FiscalSourceType.ORDER,
            sourceId: orderId,
            type,
          },
          include: {
            lines: { orderBy: { position: 'asc' } },
            events: true,
          },
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async list() {
    return this.prisma.fiscalDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: { series: true },
      take: 250,
    });
  }

  async detail(id: string) {
    const document = await this.prisma.fiscalDocument.findUnique({
      where: { id },
      include: {
        series: true,
        lines: { orderBy: { position: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');
    return document;
  }

  private typePrefix(type: FiscalDocumentType) {
    const prefixes: Record<FiscalDocumentType, string> = {
      INVOICE: 'FT',
      INVOICE_RECEIPT: 'FR',
      RECEIPT: 'RC',
      CREDIT_NOTE: 'NC',
      PROFORMA: 'PF',
    };
    return prefixes[type];
  }

  private isUniqueViolation(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    return text.includes('P2002') || text.includes('23505');
  }
}
