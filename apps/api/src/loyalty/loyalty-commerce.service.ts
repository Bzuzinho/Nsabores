import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { BundleAwareCommerceService } from '../bundles/bundle-aware-commerce.service';
import { BundleInventoryService } from '../bundles/bundle-inventory.service';
import type { CheckoutDto, MockWebhookDto } from '../commerce/dto';
import { CommerceMailProvider } from '../commerce/mail.provider';
import { PaymentProvider } from '../commerce/payment.provider';
import { OperationsService } from '../operations/operations.service';
import { PrismaService } from '../prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { ReceivablesService } from '../receivables/receivables.service';
import { LoyaltyEarningService } from './loyalty-earning.service';
import { LoyaltyOrderService } from './loyalty-order.service';

type CartIdentity = { userId?: string; sessionId?: string };

@Injectable()
export class LoyaltyCommerceService extends BundleAwareCommerceService {
  constructor(
    private readonly loyaltyPrisma: PrismaService,
    payments: PaymentProvider,
    mail: CommerceMailProvider,
    private readonly loyaltyOperations: OperationsService,
    promotions: PromotionsService,
    bundleInventory: BundleInventoryService,
    private readonly loyaltyOrders: LoyaltyOrderService,
    private readonly loyaltyEarning: LoyaltyEarningService,
    private readonly config: ConfigService,
    private readonly receivables: ReceivablesService,
  ) {
    super(loyaltyPrisma, payments, mail, loyaltyOperations, promotions, bundleInventory);
  }

  private manualFlow() {
    return (this.config.get<string>('PAYMENT_FLOW_MODE') ?? 'manual') === 'manual';
  }

  override async checkout(identity: CartIdentity, body: CheckoutDto) {
    const cart = await super.cart(identity);
    const order = await super.checkout(identity, body);
    try {
      await this.loyaltyOrders.reserve(
        order.id,
        identity.userId,
        order.totalCents,
        body.loyaltyPoints,
        body.giftCardCode,
      );
      const refreshed = await this.loyaltyPrisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { totalCents: true, status: true },
      });

      if (this.manualFlow()) {
        await this.loyaltyOrders.consume(order.id);
        await this.loyaltyPrisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PROCESSING,
            paymentStatus:
              refreshed.totalCents === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
            statusHistory: {
              create: {
                fromStatus: OrderStatus.PENDING_PAYMENT,
                toStatus: OrderStatus.PROCESSING,
                note:
                  refreshed.totalCents === 0
                    ? 'Encomenda aceite para produção e liquidada com benefícios internos.'
                    : 'Encomenda aceite para produção. Pagamento a combinar e confirmar manualmente.',
              },
            },
          },
        });
        await this.receivables.ensureAgreement(order.id);
        if (refreshed.totalCents === 0) {
          await this.receivables.markPaid(
            order.id,
            identity.userId,
            'beneficios-internos',
            undefined,
            'Encomenda integralmente liquidada com pontos e/ou vale-oferta.',
          );
          await this.loyaltyEarning.accrueForPaidOrder(order.id);
        }
      } else if (
        refreshed.totalCents === 0 &&
        refreshed.status === OrderStatus.PENDING_PAYMENT
      ) {
        await this.loyaltyOrders.consume(order.id);
        await this.loyaltyPrisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            paymentStatus: PaymentStatus.PAID,
            statusHistory: {
              create: {
                fromStatus: OrderStatus.PENDING_PAYMENT,
                toStatus: OrderStatus.PAID,
                note: 'Encomenda liquidada integralmente com pontos e/ou vale-oferta.',
              },
            },
          },
        });
        await this.loyaltyEarning.accrueForPaidOrder(order.id);
      }
    } catch (error) {
      await this.loyaltyOperations
        .releaseOrder(order.id, 'Reserva de fidelização/vale falhou.')
        .catch(() => undefined);
      await this.loyaltyOrders.release(order.id).catch(() => undefined);
      await this.loyaltyPrisma.$transaction(async (tx) => {
        await tx.order.deleteMany({ where: { id: order.id } });
        await tx.cart.updateMany({
          where: { id: cart.id },
          data: {
            status: 'ACTIVE',
            userId: identity.userId,
            sessionId: identity.userId ? null : identity.sessionId,
          },
        });
      });
      throw error;
    }
    return this.orderWithBenefits(order.id);
  }

  override async startPayment(orderId: string, userId: string | undefined, key: string) {
    if (this.manualFlow()) {
      throw new ConflictException(
        'O pagamento desta encomenda é combinado diretamente com a empresa e confirmado manualmente.',
      );
    }
    return super.startPayment(orderId, userId, key);
  }

  override async webhook(rawPayload: string, signature: string | undefined, body: MockWebhookDto) {
    const result = await super.webhook(rawPayload, signature, body);
    const payment = await this.loyaltyPrisma.payment.findUnique({
      where: { providerPaymentId: body.providerPaymentId },
      select: { orderId: true },
    });
    if (payment) {
      if (body.status === PaymentStatus.PAID) {
        await this.loyaltyOrders.consume(payment.orderId);
        await this.loyaltyEarning.accrueForPaidOrder(payment.orderId);
      } else if (
        body.status === PaymentStatus.FAILED ||
        body.status === PaymentStatus.CANCELLED
      ) {
        await this.loyaltyOrders.release(payment.orderId);
      }
    }
    return result;
  }

  override async confirmMock(providerPaymentId: string) {
    const result = await super.confirmMock(providerPaymentId);
    const payment = await this.loyaltyPrisma.payment.findUnique({
      where: { providerPaymentId },
      select: { orderId: true },
    });
    if (payment) {
      await this.loyaltyOrders.consume(payment.orderId);
      await this.loyaltyEarning.accrueForPaidOrder(payment.orderId);
    }
    return result;
  }

  override async changeStatus(id: string, status: OrderStatus, authorId: string, note?: string) {
    const result = await super.changeStatus(id, status, authorId, note);
    if (status === OrderStatus.CANCELLED) {
      if (this.manualFlow()) await this.loyaltyOrders.refund(id);
      else await this.loyaltyOrders.release(id);
    }
    return result;
  }

  override async refund(id: string, authorId: string) {
    const order = await this.loyaltyPrisma.order.findUnique({
      where: { id },
      select: { id: true, totalCents: true, status: true, paymentStatus: true },
    });
    if (!order) throw new ConflictException('Encomenda não encontrada.');

    let result;
    if (order.totalCents === 0 && order.paymentStatus === PaymentStatus.PAID) {
      result = await this.loyaltyPrisma.order.update({
        where: { id },
        data: {
          status: OrderStatus.REFUNDED,
          paymentStatus: PaymentStatus.REFUNDED,
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: OrderStatus.REFUNDED,
              authorId,
              note: 'Benefícios internos devolvidos; não existia pagamento externo.',
            },
          },
        },
      });
    } else {
      result = await super.refund(id, authorId);
    }
    await this.loyaltyOrders.refund(id);
    await this.loyaltyEarning.reverseForRefundedOrder(id);
    return result;
  }

  private async orderWithBenefits(orderId: string) {
    const [order, benefits] = await Promise.all([
      this.loyaltyPrisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          payments: true,
          deliveryMethod: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.loyaltyOrders.applications(orderId),
    ]);
    return { ...order, benefits, paymentFlowMode: this.manualFlow() ? 'manual' : 'automatic' };
  }
}
