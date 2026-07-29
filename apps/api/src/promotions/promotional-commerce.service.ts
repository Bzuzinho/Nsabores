import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  CartStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { CommerceService } from '../commerce/commerce.service';
import type { CheckoutDto } from '../commerce/dto';
import { CommerceMailProvider } from '../commerce/mail.provider';
import { PaymentProvider } from '../commerce/payment.provider';
import { OperationsService } from '../operations/operations.service';
import { PrismaService } from '../prisma.service';
import { PromotionsService } from './promotions.service';

const promotionalOrderInclude = {
  items: true,
  payments: {
    select: {
      id: true,
      provider: true,
      method: true,
      status: true,
      amountCents: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  deliveryMethod: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
} as const;

type CartIdentity = { userId?: string; sessionId?: string };

@Injectable()
export class PromotionalCommerceService extends CommerceService {
  constructor(
    private readonly promotionalPrisma: PrismaService,
    payments: PaymentProvider,
    private readonly promotionalMail: CommerceMailProvider,
    private readonly promotionalOperations: OperationsService,
    private readonly promotions: PromotionsService,
  ) {
    super(promotionalPrisma, payments, promotionalMail, promotionalOperations);
  }

  override async cart(identity: CartIdentity) {
    const base = await super.cart(identity);
    return this.promotions.priceCart(base.id, identity.userId);
  }

  override async addItem(
    identity: CartIdentity,
    productId: string,
    quantity: number,
  ) {
    const base = await super.addItem(identity, productId, quantity);
    return this.promotions.priceCart(base.id, identity.userId);
  }

  override async updateItem(
    identity: CartIdentity,
    itemId: string,
    quantity: number,
  ) {
    const base = await super.updateItem(identity, itemId, quantity);
    return this.promotions.priceCart(base.id, identity.userId);
  }

  override async removeItem(identity: CartIdentity, itemId: string) {
    const base = await super.removeItem(identity, itemId);
    return this.promotions.priceCart(base.id, identity.userId);
  }

  override async merge(userId: string, sessionId?: string) {
    const base = await super.merge(userId, sessionId);
    return this.promotions.priceCart(base.id, userId);
  }

  async applyCoupon(identity: CartIdentity, code: string) {
    const base = await super.cart(identity);
    return this.promotions.applyCoupon(base.id, code, identity.userId);
  }

  async removeCoupon(identity: CartIdentity) {
    const base = await super.cart(identity);
    return this.promotions.removeCoupon(base.id, identity.userId);
  }

  override async checkout(identity: CartIdentity, body: CheckoutDto) {
    if (!body.termsAccepted || !body.privacyAccepted) {
      throw new BadRequestException(
        'É obrigatório aceitar os termos e a política de privacidade.',
      );
    }
    const existing = await this.promotionalPrisma.order.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: promotionalOrderInclude,
    });
    if (existing) {
      if (existing.userId !== (identity.userId ?? null)) {
        throw new ConflictException('Chave de idempotência já utilizada.');
      }
      return {
        ...existing,
        discounts: await this.promotions.orderDiscounts(existing.id),
      };
    }

    const baseCart = await super.cart(identity);
    const order = await this.promotionalPrisma.$transaction(async (tx) => {
      const freshCart = await tx.cart.findUnique({
        where: { id: baseCart.id },
        include: { items: { include: { product: true } } },
      });
      if (!freshCart?.items.length) {
        throw new BadRequestException('O carrinho está vazio.');
      }
      if (
        freshCart.items.some(
          ({ product }) =>
            !product.isActive || product.stockStatus === 'OUT_OF_STOCK',
        )
      ) {
        throw new ConflictException(
          'Um ou mais produtos deixaram de estar disponíveis.',
        );
      }
      const delivery = await tx.deliveryMethod.findFirst({
        where: { id: body.deliveryMethodId, isActive: true },
      });
      if (!delivery) {
        throw new BadRequestException('Método de entrega indisponível.');
      }

      const beforeShipping = await this.promotions.priceCartInTransaction(
        tx,
        freshCart.id,
        identity.userId,
      );
      const baseShippingCents =
        delivery.freeShippingAboveCents !== null &&
        beforeShipping.subtotalCents >= delivery.freeShippingAboveCents
          ? 0
          : delivery.priceCents;
      const pricing = await this.promotions.priceCartInTransaction(
        tx,
        freshCart.id,
        identity.userId,
        baseShippingCents,
      );
      const number = `NS-${new Date().getUTCFullYear()}-${randomBytes(4)
        .toString('hex')
        .toUpperCase()}`;
      const created = await tx.order.create({
        data: {
          number,
          userId: identity.userId,
          email: body.email.toLowerCase(),
          customerName: body.customerName,
          phone: body.phone,
          subtotalCents: pricing.subtotalCents,
          shippingCents: baseShippingCents,
          discountCents: pricing.discountCents,
          totalCents: pricing.totalCents,
          billingAddress:
            body.billingAddress as unknown as Prisma.InputJsonValue,
          shippingAddress:
            body.shippingAddress as unknown as Prisma.InputJsonValue,
          customerNotes: body.customerNotes,
          deliveryMethodId: delivery.id,
          idempotencyKey: body.idempotencyKey,
          salesChannel: pricing.context.channel,
          businessAccountId: pricing.context.businessAccountId,
          priceListId: pricing.context.priceListId,
          paymentTermsSnapshot: pricing.context.paymentTerms
            ? ({ terms: pricing.context.paymentTerms } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          requiresApproval: pricing.context.requiresApproval,
          items: {
            create: pricing.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              sku: item.product.sku,
              unitPriceCents: item.unitPriceCents,
              quantity: item.quantity,
              totalCents: item.totalCents,
              imageUrl: item.product.imageUrl,
            })),
          },
          statusHistory: {
            create: { toStatus: OrderStatus.PENDING_PAYMENT },
          },
        },
        include: promotionalOrderInclude,
      });
      await this.promotions.snapshotOrderDiscounts(
        tx,
        created.id,
        pricing.discounts,
      );
      await tx.cart.update({
        where: { id: freshCart.id },
        data: {
          status: CartStatus.CONVERTED,
          userId: null,
          sessionId: null,
        },
      });
      return { created, discounts: pricing.discounts };
    });

    try {
      await this.promotionalOperations.reserveOrder(order.created.id);
    } catch (error) {
      await this.promotionalPrisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM "CouponRedemption" WHERE "orderId" = ${order.created.id}::uuid
        `;
        await tx.order.delete({ where: { id: order.created.id } });
        await tx.cart.update({
          where: { id: baseCart.id },
          data: {
            status: CartStatus.ACTIVE,
            userId: identity.userId,
            sessionId: identity.userId ? null : identity.sessionId,
          },
        });
      });
      throw error;
    }

    this.promotionalMail.send(
      'ORDER_RECEIVED',
      order.created.email,
      order.created.number,
    );
    return { ...order.created, discounts: order.discounts };
  }
}
