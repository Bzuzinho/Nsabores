import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, OrderStatus, Prisma } from '@prisma/client';
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

interface ConfiguredCartRow {
  id: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  configurationKey: string;
}

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
    try {
      const base = await super.cart(identity);
      const product = await this.promotionalPrisma.product.findFirst({
        where: {
          id: productId,
          isActive: true,
          stockStatus: { not: 'OUT_OF_STOCK' },
        },
      });
      if (!product) throw new ConflictException('Produto indisponível.');
      const current = await this.promotionalPrisma.$queryRaw<
        Array<{ quantity: number }>
      >`
        SELECT "quantity"
        FROM "CartItem"
        WHERE "cartId" = ${base.id}::uuid
          AND "productId" = ${productId}::uuid
          AND "configurationKey" = 'default'
        LIMIT 1
      `;
      const next = (current[0]?.quantity ?? 0) + quantity;
      if (next > 99) throw new BadRequestException('Quantidade máxima: 99.');
      await this.promotionalPrisma.$executeRaw`
        INSERT INTO "CartItem" (
          "id", "cartId", "productId", "quantity", "unitPriceCents",
          "configurationKey", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${base.id}::uuid, ${productId}::uuid, ${next},
          ${product.priceCents}, 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("cartId", "productId", "configurationKey") DO UPDATE SET
          "quantity" = EXCLUDED."quantity",
          "unitPriceCents" = EXCLUDED."unitPriceCents",
          "updatedAt" = CURRENT_TIMESTAMP
      `;
      return this.promotions.priceCart(base.id, identity.userId);
    } catch (error) {
      if (!this.isPreConfigurationSchema(error)) throw error;
      const base = await super.addItem(identity, productId, quantity);
      return this.promotions.priceCart(base.id, identity.userId);
    }
  }

  override async updateItem(
    identity: CartIdentity,
    itemId: string,
    quantity: number,
  ) {
    try {
      const base = await super.cart(identity);
      const rows = await this.promotionalPrisma.$queryRaw<
        Array<
          ConfiguredCartRow & {
            productPriceCents: number;
            isActive: boolean;
            stockStatus: string;
          }
        >
      >`
        SELECT ci."id", ci."productId", ci."quantity", ci."unitPriceCents", ci."configurationKey",
               p."priceCents" AS "productPriceCents", p."isActive", p."stockStatus"::text AS "stockStatus"
        FROM "CartItem" ci
        JOIN "Product" p ON p."id" = ci."productId"
        WHERE ci."id" = ${itemId}::uuid AND ci."cartId" = ${base.id}::uuid
        LIMIT 1
      `;
      const item = rows[0];
      if (!item) throw new NotFoundException('Item não encontrado.');
      if (!item.isActive || item.stockStatus === 'OUT_OF_STOCK')
        throw new ConflictException('Produto indisponível.');
      await this.promotionalPrisma.$executeRaw`
        UPDATE "CartItem"
        SET "quantity" = ${quantity},
            "unitPriceCents" = ${item.configurationKey === 'default' ? item.productPriceCents : item.unitPriceCents},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${itemId}::uuid AND "cartId" = ${base.id}::uuid
      `;
      return this.promotions.priceCart(base.id, identity.userId);
    } catch (error) {
      if (!this.isPreConfigurationSchema(error)) throw error;
      const base = await super.updateItem(identity, itemId, quantity);
      return this.promotions.priceCart(base.id, identity.userId);
    }
  }

  override async removeItem(identity: CartIdentity, itemId: string) {
    const base = await super.removeItem(identity, itemId);
    return this.promotions.priceCart(base.id, identity.userId);
  }

  override async merge(userId: string, sessionId?: string) {
    if (!sessionId) return this.cart({ userId });
    try {
      const account = await super.cart({ userId });
      const guests = await this.promotionalPrisma.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Cart"
        WHERE "sessionId" = ${sessionId}::uuid AND "status" = 'ACTIVE'::"CartStatus"
        LIMIT 1
      `;
      const guest = guests[0];
      if (!guest || guest.id === account.id)
        return this.promotions.priceCart(account.id, userId);
      const items = await this.promotionalPrisma.$queryRaw<ConfiguredCartRow[]>`
        SELECT "id", "productId", "quantity", "unitPriceCents", "configurationKey"
        FROM "CartItem"
        WHERE "cartId" = ${guest.id}::uuid
        ORDER BY "createdAt" ASC
      `;
      await this.promotionalPrisma.$transaction(async (tx) => {
        for (const item of items) {
          const destination = await tx.$queryRaw<Array<{ id: string }>>`
            INSERT INTO "CartItem" (
              "id", "cartId", "productId", "quantity", "unitPriceCents",
              "configurationKey", "createdAt", "updatedAt"
            ) VALUES (
              ${randomUUID()}::uuid, ${account.id}::uuid, ${item.productId}::uuid,
              ${item.quantity}, ${item.unitPriceCents}, ${item.configurationKey},
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT ("cartId", "productId", "configurationKey") DO UPDATE SET
              "quantity" = LEAST(99, "CartItem"."quantity" + EXCLUDED."quantity"),
              "unitPriceCents" = EXCLUDED."unitPriceCents",
              "updatedAt" = CURRENT_TIMESTAMP
            RETURNING "id"
          `;
          const destinationId = destination[0]?.id;
          if (!destinationId || item.configurationKey === 'default') continue;
          await tx.$executeRaw`
            DELETE FROM "CartItemBundleSelection" WHERE "cartItemId" = ${destinationId}::uuid
          `;
          await tx.$executeRaw`
            INSERT INTO "CartItemBundleSelection" (
              "id", "cartItemId", "componentProductId", "groupId", "quantity",
              "unitPriceDeltaCents", "createdAt"
            )
            SELECT gen_random_uuid(), ${destinationId}::uuid, "componentProductId", "groupId",
                   "quantity", "unitPriceDeltaCents", CURRENT_TIMESTAMP
            FROM "CartItemBundleSelection"
            WHERE "cartItemId" = ${item.id}::uuid
          `;
          await tx.$executeRaw`
            DELETE FROM "CartItemPersonalization" WHERE "cartItemId" = ${destinationId}::uuid
          `;
          await tx.$executeRaw`
            INSERT INTO "CartItemPersonalization" (
              "id", "cartItemId", "data", "extraPriceCents", "createdAt", "updatedAt"
            )
            SELECT gen_random_uuid(), ${destinationId}::uuid, "data", "extraPriceCents",
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM "CartItemPersonalization"
            WHERE "cartItemId" = ${item.id}::uuid
          `;
        }
        await tx.$executeRaw`
          INSERT INTO "CartPromotion" (
            "id", "cartId", "promotionId", "couponId", "code", "createdAt", "updatedAt"
          )
          SELECT gen_random_uuid(), ${account.id}::uuid, "promotionId", "couponId", "code",
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          FROM "CartPromotion"
          WHERE "cartId" = ${guest.id}::uuid
          ON CONFLICT ("cartId") DO NOTHING
        `;
        await tx.cart.update({
          where: { id: guest.id },
          data: { status: CartStatus.CONVERTED, sessionId: null },
        });
      });
      return this.promotions.priceCart(account.id, userId);
    } catch (error) {
      if (!this.isPreConfigurationSchema(error)) throw error;
      const base = await super.merge(userId, sessionId);
      return this.promotions.priceCart(base.id, userId);
    }
  }

  override async repeatOrder(userId: string, id: string) {
    try {
      const order = await super.customerOrder(userId, id);
      const cart = await super.cart({ userId });
      let skipped = 0;
      for (const item of order.items) {
        if (!item.productId) {
          skipped++;
          continue;
        }
        const product = await this.promotionalPrisma.product.findFirst({
          where: {
            id: item.productId,
            isActive: true,
            stockStatus: { not: 'OUT_OF_STOCK' },
          },
        });
        if (!product) {
          skipped++;
          continue;
        }
        await this.promotionalPrisma.$executeRaw`
          INSERT INTO "CartItem" (
            "id", "cartId", "productId", "quantity", "unitPriceCents",
            "configurationKey", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}::uuid, ${cart.id}::uuid, ${product.id}::uuid,
            ${Math.min(99, item.quantity)}, ${product.priceCents}, 'default',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("cartId", "productId", "configurationKey") DO UPDATE SET
            "quantity" = EXCLUDED."quantity",
            "unitPriceCents" = EXCLUDED."unitPriceCents",
            "updatedAt" = CURRENT_TIMESTAMP
        `;
      }
      return {
        cart: await this.promotions.priceCart(cart.id, userId),
        skipped,
      };
    } catch (error) {
      if (!this.isPreConfigurationSchema(error)) throw error;
      return super.repeatOrder(userId, id);
    }
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
            ? { terms: pricing.context.paymentTerms }
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

  private isPreConfigurationSchema(error: unknown) {
    if (typeof error !== 'object' || error === null || !('code' in error))
      return false;
    const code = (error as { code?: string }).code;
    return code === '42703' || code === '42P10';
  }
}
