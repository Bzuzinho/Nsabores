import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { LoyaltyEarningService } from '../loyalty/loyalty-earning.service';
import { PrismaService } from '../prisma.service';
import { ReceivablesService } from '../receivables/receivables.service';
import type { ManualPaymentDto, ShippingQuoteDto } from './dto';

@Injectable()
export class ManualPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly earning: LoyaltyEarningService,
    private readonly receivables: ReceivablesService,
  ) {}

  async setShippingQuote(
    orderId: string,
    authorId: string,
    body: ShippingQuoteDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException(
        'O custo de transporte não pode ser alterado depois de o pagamento estar confirmado.',
      );
    }

    const terms =
      order.paymentTermsSnapshot &&
      typeof order.paymentTermsSnapshot === 'object' &&
      !Array.isArray(order.paymentTermsSnapshot)
        ? order.paymentTermsSnapshot
        : {};
    const totalCents = Math.max(
      0,
      order.totalCents - order.shippingCents + body.amountCents,
    );
    const note = body.note?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          shippingCents: body.amountCents,
          totalCents,
          paymentTermsSnapshot: {
            ...terms,
            shippingQuoteStatus: 'CONFIRMED',
            shippingQuoteCents: body.amountCents,
            shippingQuoteNote: note,
            shippingQuoteConfirmedBy: authorId,
            shippingQuoteConfirmedAt: new Date().toISOString(),
          },
          internalNotes: [
            order.internalNotes,
            `Transporte confirmado: ${(body.amountCents / 100).toFixed(2)} EUR${
              note ? ` — ${note}` : ''
            }`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });
      await tx.$executeRaw`
        UPDATE "PaymentAgreement"
        SET "expectedAmountCents" = ${totalCents}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "orderId" = ${orderId}::uuid
      `;
    });

    return this.order(orderId);
  }

  async markReceived(
    orderId: string,
    authorId: string,
    body: ManualPaymentDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      throw new ConflictException('A encomenda já foi reembolsada.');
    }
    if (order.paymentStatus !== PaymentStatus.PAID) {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.upsert({
          where: { idempotencyKey: `manual-payment:${orderId}` },
          update: {
            status: PaymentStatus.PAID,
            method: body.method?.trim() || 'manual',
            metadata: {
              reference: body.reference?.trim() || null,
              note: body.note?.trim() || null,
              authorId,
            },
          },
          create: {
            orderId,
            provider: 'manual',
            providerPaymentId: `manual_${orderId}`,
            method: body.method?.trim() || 'manual',
            status: PaymentStatus.PAID,
            amountCents: order.totalCents,
            currency: order.currency,
            idempotencyKey: `manual-payment:${orderId}`,
            metadata: {
              reference: body.reference?.trim() || null,
              note: body.note?.trim() || null,
              authorId,
            },
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.PAID,
            internalNotes: body.note?.trim()
              ? [order.internalNotes, `Pagamento manual: ${body.note.trim()}`]
                  .filter(Boolean)
                  .join('\n')
              : order.internalNotes,
          },
        });
      });
    }
    await this.receivables.markPaid(
      orderId,
      authorId,
      body.method?.trim() || 'manual',
      body.reference?.trim(),
      body.note?.trim(),
    );
    await this.earning.accrueForPaidOrder(orderId);
    return this.order(orderId);
  }

  private order(orderId: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
        deliveryMethod: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
  }
}
