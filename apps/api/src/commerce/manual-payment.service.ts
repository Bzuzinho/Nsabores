import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { LoyaltyEarningService } from '../loyalty/loyalty-earning.service';
import type { ManualPaymentDto } from './dto';

@Injectable()
export class ManualPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly earning: LoyaltyEarningService,
  ) {}

  async markReceived(orderId: string, authorId: string, body: ManualPaymentDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
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
    await this.earning.accrueForPaidOrder(orderId);
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
