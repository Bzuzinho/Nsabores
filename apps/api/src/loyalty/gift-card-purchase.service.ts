import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from '../commerce/payment.provider';
import { PrismaService } from '../prisma.service';
import type {
  ConfirmGiftCardPurchaseDto,
  CreateGiftCardPurchaseDto,
} from './gift-card-purchase.dto';
import { LoyaltyService } from './loyalty.service';

@Injectable()
export class GiftCardPurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentProvider,
    private readonly loyalty: LoyaltyService,
  ) {}

  async create(body: CreateGiftCardPurchaseDto, purchaserUserId?: string) {
    const existing = await this.prisma.giftCardPurchase.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (existing) return this.present(existing);

    const purchase = await this.prisma.giftCardPurchase.create({
      data: {
        purchaserUserId,
        purchaserEmail: body.purchaserEmail.toLowerCase(),
        recipientEmail: body.recipientEmail.toLowerCase(),
        recipientName: body.recipientName,
        message: body.message,
        amountCents: body.amountCents,
        idempotencyKey: body.idempotencyKey,
      },
    });
    const session = this.payments.create(purchase.id);
    const updated = await this.prisma.giftCardPurchase.update({
      where: { id: purchase.id },
      data: {
        provider: session.provider,
        providerPaymentId: session.providerPaymentId,
      },
    });
    return {
      ...this.present(updated),
      redirectUrl: `/vales-oferta/sucesso?purchaseId=${updated.id}&paymentId=${session.providerPaymentId}`,
    };
  }

  async confirmMock(id: string, body: ConfirmGiftCardPurchaseDto) {
    if (!this.payments.isMock()) {
      throw new NotFoundException('Confirmação mock indisponível.');
    }
    const purchase = await this.prisma.giftCardPurchase.findUnique({
      where: { id },
    });
    if (!purchase || purchase.providerPaymentId !== body.providerPaymentId) {
      throw new NotFoundException('Compra de vale-oferta não encontrada.');
    }
    if (purchase.status === 'CANCELLED') {
      throw new ConflictException('A compra foi cancelada.');
    }
    if (purchase.status === 'PAID') {
      return { ...this.present(purchase), codeAvailable: false };
    }

    const issued = (await this.loyalty.issueGiftCard(
      {
        initialAmountCents: purchase.amountCents,
        recipientEmail: purchase.recipientEmail,
        recipientName: purchase.recipientName ?? undefined,
        message: purchase.message ?? undefined,
        idempotencyKey: `gift-card-purchase:${purchase.id}:issue`,
      },
      purchase.purchaserUserId ?? undefined,
    )) as Record<string, unknown>;

    const updated = await this.prisma.giftCardPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'PAID',
        giftCardId: String(issued.id),
        paidAt: new Date(),
      },
    });
    return {
      ...this.present(updated),
      code: String(issued.code),
      codeAvailable: true,
    };
  }

  async status(id: string) {
    const purchase = await this.prisma.giftCardPurchase.findUnique({
      where: { id },
    });
    if (!purchase) throw new NotFoundException('Compra de vale-oferta não encontrada.');
    return this.present(purchase);
  }

  private present(purchase: {
    id: string;
    purchaserEmail: string;
    recipientEmail: string;
    recipientName: string | null;
    message: string | null;
    amountCents: number;
    currency: string;
    status: string;
    providerPaymentId: string | null;
    giftCardId: string | null;
    paidAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: purchase.id,
      purchaserEmail: purchase.purchaserEmail,
      recipientEmail: purchase.recipientEmail,
      recipientName: purchase.recipientName,
      message: purchase.message,
      amountCents: purchase.amountCents,
      currency: purchase.currency,
      status: purchase.status,
      providerPaymentId: purchase.providerPaymentId,
      giftCardId: purchase.giftCardId,
      paidAt: purchase.paidAt,
      createdAt: purchase.createdAt,
    };
  }
}
