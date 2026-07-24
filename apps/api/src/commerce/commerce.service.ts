import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type {
  CheckoutDto,
  DeliveryMethodDto,
  MockWebhookDto,
  OrderQueryDto,
} from './dto';
import { CommerceMailProvider } from './mail.provider';
import { PaymentProvider } from './payment.provider';
import { OperationsService } from '../operations/operations.service';

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

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
  PROCESSING: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELLED: [OrderStatus.REFUNDED],
  REFUNDED: [],
};

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentProvider,
    private readonly mail: CommerceMailProvider,
    private readonly operations: OperationsService,
  ) {}

  async cart(identity: { userId?: string; sessionId?: string }) {
    const cart = await this.getOrCreateCart(identity);
    return this.presentCart(cart.id);
  }

  async addItem(
    identity: { userId?: string; sessionId?: string },
    productId: string,
    quantity: number,
  ) {
    const product = await this.availableProduct(productId);
    const cart = await this.getOrCreateCart(identity);
    const current = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const next = (current?.quantity ?? 0) + quantity;
    if (next > 99) throw new BadRequestException('Quantidade máxima: 99.');
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: next, unitPriceCents: product.priceCents },
      create: {
        cartId: cart.id,
        productId,
        quantity,
        unitPriceCents: product.priceCents,
      },
    });
    return this.presentCart(cart.id);
  }

  async updateItem(
    identity: { userId?: string; sessionId?: string },
    itemId: string,
    quantity: number,
  ) {
    const cart = await this.getOrCreateCart(identity);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: true },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');
    await this.availableProduct(item.productId);
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity, unitPriceCents: item.product.priceCents },
    });
    return this.presentCart(cart.id);
  }

  async removeItem(
    identity: { userId?: string; sessionId?: string },
    itemId: string,
  ) {
    const cart = await this.getOrCreateCart(identity);
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    if (!deleted.count) throw new NotFoundException('Item não encontrado.');
    return this.presentCart(cart.id);
  }

  async clearCart(identity: { userId?: string; sessionId?: string }) {
    const cart = await this.getOrCreateCart(identity);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  async merge(userId: string, sessionId?: string) {
    const account = await this.getOrCreateCart({ userId });
    if (!sessionId) return this.presentCart(account.id);
    const guest = await this.prisma.cart.findFirst({
      where: { sessionId, status: CartStatus.ACTIVE },
      include: { items: true },
    });
    if (!guest || guest.id === account.id) return this.presentCart(account.id);
    await this.prisma.$transaction(async (tx) => {
      for (const item of guest.items) {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: account.id,
              productId: item.productId,
            },
          },
        });
        await tx.cartItem.upsert({
          where: {
            cartId_productId: {
              cartId: account.id,
              productId: item.productId,
            },
          },
          create: { ...item, id: undefined, cartId: account.id },
          update: {
            quantity: Math.min(99, (existing?.quantity ?? 0) + item.quantity),
          },
        });
      }
      await tx.cart.update({
        where: { id: guest.id },
        data: { status: CartStatus.CONVERTED, sessionId: null },
      });
    });
    return this.presentCart(account.id);
  }

  deliveryMethods(admin = false) {
    return this.prisma.deliveryMethod.findMany({
      where: admin ? {} : { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  updateDeliveryMethod(id: string, body: DeliveryMethodDto) {
    return this.prisma.deliveryMethod.update({ where: { id }, data: body });
  }

  async checkout(
    identity: { userId?: string; sessionId?: string },
    body: CheckoutDto,
  ) {
    if (!body.termsAccepted || !body.privacyAccepted) {
      throw new BadRequestException(
        'É obrigatório aceitar os termos e a política de privacidade.',
      );
    }
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: orderInclude,
    });
    if (existing) {
      if (existing.userId !== (identity.userId ?? null)) {
        throw new ConflictException('Chave de idempotência já utilizada.');
      }
      return existing;
    }
    const cart = await this.getOrCreateCart(identity);
    const order = await this.prisma.$transaction(async (tx) => {
      const freshCart = await tx.cart.findUnique({
        where: { id: cart.id },
        include: { items: { include: { product: true } } },
      });
      if (!freshCart?.items.length)
        throw new BadRequestException('O carrinho está vazio.');
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
      if (!delivery)
        throw new BadRequestException('Método de entrega indisponível.');
      const subtotalCents = freshCart.items.reduce(
        (sum, item) => sum + item.product.priceCents * item.quantity,
        0,
      );
      const shippingCents =
        delivery.freeShippingAboveCents !== null &&
        subtotalCents >= delivery.freeShippingAboveCents
          ? 0
          : delivery.priceCents;
      const number = `NS-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const created = await tx.order.create({
        data: {
          number,
          userId: identity.userId,
          email: body.email.toLowerCase(),
          customerName: body.customerName,
          phone: body.phone,
          subtotalCents,
          shippingCents,
          totalCents: subtotalCents + shippingCents,
          billingAddress:
            body.billingAddress as unknown as Prisma.InputJsonValue,
          shippingAddress:
            body.shippingAddress as unknown as Prisma.InputJsonValue,
          customerNotes: body.customerNotes,
          deliveryMethodId: delivery.id,
          idempotencyKey: body.idempotencyKey,
          items: {
            create: freshCart.items.map(({ product, quantity }) => ({
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              unitPriceCents: product.priceCents,
              quantity,
              totalCents: product.priceCents * quantity,
              imageUrl: product.imageUrl,
            })),
          },
          statusHistory: {
            create: { toStatus: OrderStatus.PENDING_PAYMENT },
          },
        },
        include: orderInclude,
      });
      await tx.cart.update({
        where: { id: freshCart.id },
        data: {
          status: CartStatus.CONVERTED,
          userId: null,
          sessionId: null,
        },
      });
      return created;
    });
    try {
      await this.operations.reserveOrder(order.id);
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.order.delete({ where: { id: order.id } }),
        this.prisma.cart.update({
          where: { id: cart.id },
          data: {
            status: CartStatus.ACTIVE,
            userId: identity.userId,
            sessionId: identity.userId ? null : identity.sessionId,
          },
        }),
      ]);
      throw error;
    }
    this.mail.send('ORDER_RECEIVED', order.email, order.number);
    return order;
  }

  async startPayment(orderId: string, userId: string | undefined, key: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order || (order.userId && order.userId !== userId))
      throw new NotFoundException('Encomenda não encontrada.');
    if (order.status !== OrderStatus.PENDING_PAYMENT)
      throw new ConflictException('A encomenda já não aguarda pagamento.');
    if (
      order.items.some(
        ({ product }) =>
          !product ||
          !product.isActive ||
          product.stockStatus === 'OUT_OF_STOCK',
      )
    ) {
      throw new ConflictException(
        'Um ou mais produtos deixaram de estar disponíveis.',
      );
    }
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      if (existing.orderId !== orderId)
        throw new ConflictException('Chave de idempotência já utilizada.');
      return {
        paymentId: existing.id,
        providerPaymentId: existing.providerPaymentId,
        redirectUrl: this.paymentRedirect(orderId, existing.providerPaymentId),
      };
    }
    const session = this.payments.create(orderId);
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: session.provider,
        providerPaymentId: session.providerPaymentId,
        method: 'checkout',
        amountCents: order.totalCents,
        currency: order.currency,
        idempotencyKey: key,
      },
    });
    return {
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId,
      redirectUrl: session.redirectUrl,
    };
  }

  async webhook(
    rawPayload: string,
    signature: string | undefined,
    body: MockWebhookDto,
  ) {
    if (!this.payments.verify(rawPayload, signature))
      throw new ForbiddenException('Assinatura de webhook inválida.');
    return this.applyPaymentEvent(body);
  }

  async confirmMock(providerPaymentId: string) {
    if (!this.payments.isMock())
      throw new NotFoundException('Confirmação mock indisponível.');
    return this.applyPaymentEvent({
      eventId: `confirm_${providerPaymentId}`,
      providerPaymentId,
      status: PaymentStatus.PAID,
    });
  }

  customerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async customerOrder(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    return order;
  }

  async repeatOrder(userId: string, id: string) {
    const order = await this.customerOrder(userId, id);
    const cart = await this.getOrCreateCart({ userId });
    let skipped = 0;
    for (const item of order.items) {
      if (!item.productId) {
        skipped++;
        continue;
      }
      const product = await this.prisma.product.findFirst({
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
      await this.prisma.cartItem.upsert({
        where: {
          cartId_productId: { cartId: cart.id, productId: product.id },
        },
        create: {
          cartId: cart.id,
          productId: product.id,
          quantity: Math.min(99, item.quantity),
          unitPriceCents: product.priceCents,
        },
        update: {
          quantity: Math.min(99, item.quantity),
          unitPriceCents: product.priceCents,
        },
      });
    }
    return { cart: await this.presentCart(cart.id), skipped };
  }

  async adminOrders(query: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { customerName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from
                ? { gte: new Date(`${query.from}T00:00:00Z`) }
                : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async adminOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    return order;
  }

  async changeStatus(
    id: string,
    status: OrderStatus,
    authorId: string,
    note?: string,
  ) {
    const order = await this.adminOrder(id);
    if (!transitions[order.status].includes(status))
      throw new ConflictException(
        `Transição inválida: ${order.status} → ${status}.`,
      );
    if (status === OrderStatus.SHIPPED) {
      await this.operations.fulfillOrder(id);
    } else if (status === OrderStatus.CANCELLED) {
      await this.operations.releaseOrder(id);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status,
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus: status,
            authorId,
            note,
          },
        },
      },
      include: orderInclude,
    });
    const template =
      status === OrderStatus.PROCESSING
        ? 'ORDER_PROCESSING'
        : status === OrderStatus.SHIPPED
          ? 'ORDER_SHIPPED'
          : status === OrderStatus.CANCELLED
            ? 'ORDER_CANCELLED'
            : undefined;
    if (template) this.mail.send(template, order.email, order.number);
    return updated;
  }

  updateInternalNote(id: string, note: string) {
    return this.prisma.order.update({
      where: { id },
      data: { internalNotes: note },
      include: orderInclude,
    });
  }

  async refund(id: string, authorId: string) {
    if (!this.payments.supportsRefund())
      throw new ConflictException('O provider não suporta reembolso.');
    const order = await this.adminOrder(id);
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: id, status: PaymentStatus.PAID },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment)
      throw new ConflictException('Não existe pagamento liquidado.');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: this.payments.refundStatus() },
      });
      return tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.REFUNDED,
          paymentStatus: PaymentStatus.REFUNDED,
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: OrderStatus.REFUNDED,
              authorId,
              note: 'Reembolso confirmado pelo provider.',
            },
          },
        },
        include: orderInclude,
      });
    });
    this.mail.send('ORDER_REFUNDED', order.email, order.number);
    return updated;
  }

  private async applyPaymentEvent(body: MockWebhookDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId: body.providerPaymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    const processed = await this.prisma.processedWebhook.findUnique({
      where: {
        provider_providerEventId: {
          provider: payment.provider,
          providerEventId: body.eventId,
        },
      },
    });
    if (processed) return { processed: false, duplicate: true };
    const paid = body.status === PaymentStatus.PAID;
    await this.prisma.$transaction(async (tx) => {
      await tx.processedWebhook.create({
        data: { provider: payment.provider, providerEventId: body.eventId },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: body.status },
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: body.status,
          ...(paid
            ? {
                status: OrderStatus.PAID,
                statusHistory: {
                  create: {
                    fromStatus: payment.order.status,
                    toStatus: OrderStatus.PAID,
                    note: 'Pagamento confirmado pelo provider.',
                  },
                },
              }
            : {}),
        },
      });
    });
    if (
      body.status === PaymentStatus.FAILED ||
      body.status === PaymentStatus.CANCELLED
    ) {
      await this.operations.releaseOrder(
        payment.orderId,
        'Pagamento falhado ou cancelado.',
      );
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.CANCELLED,
          statusHistory: {
            create: {
              fromStatus: payment.order.status,
              toStatus: OrderStatus.CANCELLED,
              note: 'Reserva libertada após falha/cancelamento de pagamento.',
            },
          },
        },
      });
    }
    if (paid)
      this.mail.send(
        'PAYMENT_CONFIRMED',
        payment.order.email,
        payment.order.number,
      );
    return { processed: true, duplicate: false };
  }

  private paymentRedirect(orderId: string, paymentId: string) {
    return `/checkout/sucesso?orderId=${orderId}&paymentId=${paymentId}`;
  }

  private async availableProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true, stockStatus: { not: 'OUT_OF_STOCK' } },
    });
    if (!product) throw new ConflictException('Produto indisponível.');
    return product;
  }

  private async getOrCreateCart(identity: {
    userId?: string;
    sessionId?: string;
  }) {
    if (!identity.userId && !identity.sessionId)
      throw new BadRequestException('Identidade de carrinho em falta.');
    const where = identity.userId
      ? { userId: identity.userId, status: CartStatus.ACTIVE }
      : { sessionId: identity.sessionId, status: CartStatus.ACTIVE };
    const existing = await this.prisma.cart.findFirst({ where });
    if (existing) return existing;
    return this.prisma.cart.create({
      data: {
        userId: identity.userId,
        sessionId: identity.userId ? undefined : identity.sessionId,
      },
    });
  }

  private async presentCart(id: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id },
      include: {
        items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!cart) throw new NotFoundException('Carrinho não encontrado.');
    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: item.product.priceCents,
      totalCents: item.product.priceCents * item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        imageUrl: item.product.imageUrl,
        stockStatus: item.product.stockStatus,
      },
    }));
    return {
      id: cart.id,
      status: cart.status,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    };
  }
}
