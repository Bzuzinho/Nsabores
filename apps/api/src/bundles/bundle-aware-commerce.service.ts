import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CartStatus, OrderStatus, Prisma } from '@prisma/client';
import type { CheckoutDto } from '../commerce/dto';
import { CommerceMailProvider } from '../commerce/mail.provider';
import { PaymentProvider } from '../commerce/payment.provider';
import { OperationsService } from '../operations/operations.service';
import { PrismaService } from '../prisma.service';
import { PromotionalCommerceService } from '../promotions/promotional-commerce.service';
import {
  PromotionsService,
  type CartPricingResult,
  type PricingDiscount,
} from '../promotions/promotions.service';
import { BundleInventoryService } from './bundle-inventory.service';

type CartIdentity = { userId?: string; sessionId?: string };
type ConfiguredPriceRow = { id: string; unitPriceCents: number };
type BundleSnapshotRow = {
  componentProductId: string;
  componentName: string;
  componentSku: string;
  quantity: number;
  unitPriceDeltaCents: number;
};
type PersonalizationSnapshotRow = {
  data: Record<string, unknown>;
  extraPriceCents: number;
};

const orderInclude = {
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

@Injectable()
export class BundleAwareCommerceService extends PromotionalCommerceService {
  constructor(
    private readonly bundlePrisma: PrismaService,
    payments: PaymentProvider,
    mail: CommerceMailProvider,
    operations: OperationsService,
    private readonly bundlePromotions: PromotionsService,
    private readonly bundleInventory: BundleInventoryService,
  ) {
    super(bundlePrisma, payments, mail, operations, bundlePromotions);
  }

  override async cart(identity: CartIdentity) {
    return this.overlay(await super.cart(identity));
  }

  override async addItem(
    identity: CartIdentity,
    productId: string,
    quantity: number,
  ) {
    return this.overlay(await super.addItem(identity, productId, quantity));
  }

  override async updateItem(
    identity: CartIdentity,
    itemId: string,
    quantity: number,
  ) {
    return this.overlay(await super.updateItem(identity, itemId, quantity));
  }

  override async removeItem(identity: CartIdentity, itemId: string) {
    return this.overlay(await super.removeItem(identity, itemId));
  }

  override async merge(userId: string, sessionId?: string) {
    return this.overlay(await super.merge(userId, sessionId));
  }

  override async applyCoupon(identity: CartIdentity, code: string) {
    return this.overlay(await super.applyCoupon(identity, code));
  }

  override async removeCoupon(identity: CartIdentity) {
    return this.overlay(await super.removeCoupon(identity));
  }

  override async checkout(identity: CartIdentity, body: CheckoutDto) {
    if (!body.termsAccepted || !body.privacyAccepted) {
      throw new BadRequestException(
        'É obrigatório aceitar os termos e a política de privacidade.',
      );
    }
    const existing = await this.bundlePrisma.order.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: orderInclude,
    });
    if (existing) {
      if (existing.userId !== (identity.userId ?? null))
        throw new ConflictException('Chave de idempotência já utilizada.');
      return {
        ...existing,
        discounts: await this.bundlePromotions.orderDiscounts(existing.id),
      };
    }

    const base = await super.cart(identity);
    const order = await this.bundlePrisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: base.id },
        include: { items: { include: { product: true } } },
      });
      if (!cart?.items.length)
        throw new BadRequestException('O carrinho está vazio.');
      if (
        cart.items.some(
          ({ product }) =>
            !product.isActive || product.stockStatus === 'OUT_OF_STOCK',
        )
      )
        throw new ConflictException(
          'Um ou mais produtos deixaram de estar disponíveis.',
        );

      const delivery = await tx.deliveryMethod.findFirst({
        where: { id: body.deliveryMethodId, isActive: true },
      });
      if (!delivery)
        throw new BadRequestException('Método de entrega indisponível.');

      const withoutShipping = await this.overlay(
        await this.bundlePromotions.priceCartInTransaction(
          tx,
          cart.id,
          identity.userId,
        ),
        tx,
      );
      const shippingCents =
        delivery.freeShippingAboveCents !== null &&
        withoutShipping.subtotalCents >= delivery.freeShippingAboveCents
          ? 0
          : delivery.priceCents;
      const pricing = await this.overlay(
        await this.bundlePromotions.priceCartInTransaction(
          tx,
          cart.id,
          identity.userId,
          shippingCents,
        ),
        tx,
      );

      const header = await tx.order.create({
        data: {
          number: `NS-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
          userId: identity.userId,
          email: body.email.toLowerCase(),
          customerName: body.customerName,
          phone: body.phone,
          subtotalCents: pricing.subtotalCents,
          shippingCents,
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
            ? { terms: pricing.context.paymentTerms }
            : Prisma.JsonNull,
          requiresApproval: pricing.context.requiresApproval,
          statusHistory: { create: { toStatus: OrderStatus.PENDING_PAYMENT } },
        },
      });

      for (const item of pricing.items) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: header.id,
            productId: item.productId,
            productName: item.product.name,
            sku: item.product.sku,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
            totalCents: item.totalCents,
            imageUrl: item.product.imageUrl,
          },
        });
        await this.snapshotLine(tx, item.id, orderItem.id);
      }

      await this.bundlePromotions.snapshotOrderDiscounts(
        tx,
        header.id,
        pricing.discounts,
      );
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: CartStatus.CONVERTED, userId: null, sessionId: null },
      });
      const created = await tx.order.findUniqueOrThrow({
        where: { id: header.id },
        include: orderInclude,
      });
      return { created, discounts: pricing.discounts };
    });

    try {
      await this.bundleInventory.reserveOrder(order.created.id);
    } catch (error) {
      await this.bundlePrisma.$transaction(async (tx) => {
        await tx.order.delete({ where: { id: order.created.id } });
        await tx.cart.update({
          where: { id: base.id },
          data: {
            status: CartStatus.ACTIVE,
            userId: identity.userId,
            sessionId: identity.userId ? null : identity.sessionId,
          },
        });
      });
      throw error;
    }
    return { ...order.created, discounts: order.discounts };
  }

  private async overlay(
    pricing: CartPricingResult,
    client: Prisma.TransactionClient = this.bundlePrisma,
  ): Promise<CartPricingResult> {
    const rows = await client.$queryRaw<ConfiguredPriceRow[]>`
      SELECT "id", "unitPriceCents"
      FROM "CartItem"
      WHERE "cartId" = ${pricing.id}::uuid AND "configurationKey" <> 'default'
    `;
    if (!rows.length) return pricing;
    const configured = new Map(rows.map((row) => [row.id, row.unitPriceCents]));
    const items = pricing.items.map((item) => {
      const unitPriceCents = configured.get(item.id) ?? item.unitPriceCents;
      return {
        ...item,
        unitPriceCents,
        totalCents: unitPriceCents * item.quantity,
      };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
    const discounts = pricing.discounts.map((discount) =>
      this.repriceDiscount(discount, items),
    );
    const productDiscountCents = discounts
      .filter((line) => !line.freeShipping)
      .reduce((sum, line) => sum + line.amountCents, 0);
    const shippingDiscountCents = discounts
      .filter((line) => line.freeShipping)
      .reduce((maximum, line) => Math.max(maximum, line.amountCents), 0);
    const discountCents = Math.min(
      subtotalCents + pricing.shippingCents,
      productDiscountCents + shippingDiscountCents,
    );
    return {
      ...pricing,
      items,
      subtotalCents,
      productDiscountCents,
      shippingDiscountCents,
      discountCents,
      totalCents: Math.max(
        0,
        subtotalCents + pricing.shippingCents - discountCents,
      ),
      discounts,
    };
  }

  private repriceDiscount(
    discount: PricingDiscount,
    items: CartPricingResult['items'],
  ): PricingDiscount {
    if (discount.freeShipping) return discount;
    const ids = Array.isArray(discount.snapshot.eligibleProductIds)
      ? (discount.snapshot.eligibleProductIds as string[])
      : [];
    const eligible = ids.length
      ? items.filter((item) => ids.includes(item.productId))
      : items;
    const subtotal = eligible.reduce((sum, item) => sum + item.totalCents, 0);
    const benefitType = discount.snapshot.benefitType;
    const type = typeof benefitType === 'string' ? benefitType : '';
    const value = Number(discount.snapshot.benefitValue ?? 0);
    let calculated = discount.amountCents;
    if (type === 'PERCENTAGE')
      calculated = Math.round((subtotal * value) / 100);
    else if (type === 'FIXED_AMOUNT') calculated = Math.min(value, subtotal);
    else if (type === 'SPECIAL_PRICE') {
      calculated = eligible.reduce(
        (sum, item) =>
          sum + Math.max(0, item.unitPriceCents - value) * item.quantity,
        0,
      );
    }
    return {
      ...discount,
      amountCents: Math.min(discount.amountCents, Math.max(0, calculated)),
    };
  }

  private async snapshotLine(
    tx: Prisma.TransactionClient,
    cartItemId: string,
    orderItemId: string,
  ) {
    const selections = await tx.$queryRaw<BundleSnapshotRow[]>`
      SELECT s."componentProductId", p."name" AS "componentName", p."sku" AS "componentSku",
             s."quantity", s."unitPriceDeltaCents"
      FROM "CartItemBundleSelection" s
      JOIN "Product" p ON p."id" = s."componentProductId"
      WHERE s."cartItemId" = ${cartItemId}::uuid
      ORDER BY s."createdAt" ASC
    `;
    for (const selection of selections) {
      await tx.$executeRaw`
        INSERT INTO "OrderItemBundleSelection" (
          "id", "orderItemId", "componentProductId", "componentName", "componentSku",
          "quantity", "unitPriceDeltaCents", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${orderItemId}::uuid, ${selection.componentProductId}::uuid,
          ${selection.componentName}, ${selection.componentSku}, ${selection.quantity},
          ${selection.unitPriceDeltaCents}, CURRENT_TIMESTAMP
        )
      `;
    }
    const personalization = await tx.$queryRaw<PersonalizationSnapshotRow[]>`
      SELECT "data", "extraPriceCents"
      FROM "CartItemPersonalization"
      WHERE "cartItemId" = ${cartItemId}::uuid LIMIT 1
    `;
    if (personalization[0]) {
      await tx.$executeRaw`
        INSERT INTO "OrderItemPersonalization" (
          "id", "orderItemId", "data", "extraPriceCents", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${orderItemId}::uuid,
          ${JSON.stringify(personalization[0].data)}::jsonb,
          ${personalization[0].extraPriceCents}, CURRENT_TIMESTAMP
        )
      `;
    }
  }
}
