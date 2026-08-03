import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClubChargeStatus,
  FiscalDocumentStatus,
  FiscalDocumentType,
  FiscalEventType,
  FiscalSourceType,
  GiftCardPurchaseStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SourceFiscalService {
  constructor(private readonly prisma: PrismaService) {}

  async issueGiftCardPurchase(purchaseId: string, authorId?: string) {
    const purchase = await this.prisma.giftCardPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase)
      throw new NotFoundException('Pedido de vale-oferta não encontrado.');
    if (purchase.status !== GiftCardPurchaseStatus.PAID) {
      throw new ConflictException(
        'O documento só pode ser emitido após confirmação do pagamento.',
      );
    }

    const purchaser = purchase.purchaserUserId
      ? await this.prisma.user.findUnique({
          where: { id: purchase.purchaserUserId },
        })
      : null;

    return this.issueSingleLine({
      sourceType: FiscalSourceType.GIFT_CARD_PURCHASE,
      sourceId: purchase.id,
      customerUserId: purchase.purchaserUserId,
      customerSnapshot: {
        userId: purchase.purchaserUserId,
        name: purchaser
          ? `${purchaser.firstName} ${purchaser.lastName}`.trim()
          : null,
        email: purchase.purchaserEmail,
      },
      billingSnapshot: {},
      currency: purchase.currency,
      amountCents: purchase.amountCents,
      description: `Vale-oferta Nsabores para ${purchase.recipientName ?? purchase.recipientEmail}`,
      metadata: {
        recipientEmail: purchase.recipientEmail,
        recipientName: purchase.recipientName,
        giftCardId: purchase.giftCardId,
        paidAt: purchase.paidAt,
      },
      authorId,
    });
  }

  async issueClubCharge(chargeId: string, authorId?: string) {
    const charge = await this.prisma.clubSubscriptionCharge.findUnique({
      where: { id: chargeId },
    });
    if (!charge)
      throw new NotFoundException('Cobrança do Clube não encontrada.');
    if (charge.status !== ClubChargeStatus.PAID) {
      throw new ConflictException(
        'O documento só pode ser emitido após confirmação do pagamento.',
      );
    }

    const subscription = await this.prisma.clubSubscription.findUnique({
      where: { id: charge.subscriptionId },
    });
    if (!subscription)
      throw new NotFoundException('Subscrição do Clube não encontrada.');
    const user = await this.prisma.user.findUnique({
      where: { id: subscription.userId },
    });
    const planSnapshot = subscription.planSnapshot as Record<string, unknown>;
    const planName =
      typeof planSnapshot.name === 'string'
        ? planSnapshot.name
        : 'Clube Nsabores';

    return this.issueSingleLine({
      sourceType: FiscalSourceType.CLUB_CHARGE,
      sourceId: charge.id,
      customerUserId: subscription.userId,
      customerSnapshot: {
        userId: subscription.userId,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : null,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
      },
      billingSnapshot: {},
      currency: charge.currency,
      amountCents: charge.amountCents,
      description: `${planName} — ${charge.periodStart.toLocaleDateString('pt-PT')} a ${charge.periodEnd.toLocaleDateString('pt-PT')}`,
      metadata: {
        subscriptionId: subscription.id,
        periodStart: charge.periodStart,
        periodEnd: charge.periodEnd,
        paidAt: charge.paidAt,
      },
      authorId,
    });
  }

  private async issueSingleLine(input: {
    sourceType: FiscalSourceType;
    sourceId: string;
    customerUserId?: string | null;
    customerSnapshot: Prisma.InputJsonValue;
    billingSnapshot: Prisma.InputJsonValue;
    currency: string;
    amountCents: number;
    description: string;
    metadata: Prisma.InputJsonValue;
    authorId?: string;
  }) {
    const existing = await this.prisma.fiscalDocument.findFirst({
      where: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        type: FiscalDocumentType.INVOICE_RECEIPT,
      },
      include: { lines: true, events: true, series: true },
    });
    if (existing) return existing;

    const year = new Date().getUTCFullYear();
    return this.prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.fiscalDocument.findFirst({
          where: {
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            type: FiscalDocumentType.INVOICE_RECEIPT,
          },
          include: { lines: true, events: true, series: true },
        });
        if (duplicate) return duplicate;

        const series = await tx.fiscalSeries.upsert({
          where: {
            code_documentType_year: {
              code: `ONLINE-${year}`,
              documentType: FiscalDocumentType.INVOICE_RECEIPT,
              year,
            },
          },
          create: {
            code: `ONLINE-${year}`,
            documentType: FiscalDocumentType.INVOICE_RECEIPT,
            prefix: `FR ${year}/`,
            year,
            nextNumber: 1,
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
        if (!sequence)
          throw new ConflictException('A série fiscal não está ativa.');

        const documentId = randomUUID();
        const number = `${sequence.prefix}${String(sequence.sequentialNumber).padStart(6, '0')}`;
        await tx.fiscalDocument.create({
          data: {
            id: documentId,
            seriesId: series.id,
            type: FiscalDocumentType.INVOICE_RECEIPT,
            status: FiscalDocumentStatus.ISSUED,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            customerUserId: input.customerUserId,
            sequentialNumber: sequence.sequentialNumber,
            number,
            currency: input.currency,
            subtotalCents: input.amountCents,
            discountCents: 0,
            taxCents: 0,
            totalCents: input.amountCents,
            customerSnapshot: input.customerSnapshot,
            billingSnapshot: input.billingSnapshot,
            metadata: input.metadata,
            provider: 'manual',
            issuedAt: new Date(),
            createdById: input.authorId,
            lines: {
              create: {
                position: 1,
                description: input.description,
                quantity: 1,
                unitPriceCents: input.amountCents,
                totalCents: input.amountCents,
              },
            },
            events: {
              create: [
                {
                  type: FiscalEventType.CREATED,
                  authorId: input.authorId,
                  note: 'Documento criado a partir de pagamento confirmado.',
                },
                {
                  type: FiscalEventType.ISSUED,
                  authorId: input.authorId,
                  note: `Documento emitido com o número ${number}.`,
                },
              ],
            },
          },
        });

        return tx.fiscalDocument.findUniqueOrThrow({
          where: { id: documentId },
          include: { lines: true, events: true, series: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
