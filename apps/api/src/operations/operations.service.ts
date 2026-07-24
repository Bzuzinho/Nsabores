import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessAccountStatus,
  InventoryCountStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  PurchaseOrderStatus,
  ResellerApplicationStatus,
  SalesChannel,
  StockMovementType,
  StockReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type {
  ApplicationDecisionDto,
  InventoryDto,
  PriceListDto,
  PurchaseOrderDto,
  PurchaseReceiptDto,
  ResellerApplicationDto,
  SupplierDto,
} from './dto';

const serializable = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};
const code = (prefix: string) =>
  `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  dashboard() {
    return this.prisma.$transaction(async (tx) => {
      const [stock, purchases, applications, resellers, sales] =
        await Promise.all([
          tx.stockItem.findMany({
            include: { product: { select: { priceCents: true } } },
          }),
          tx.purchaseOrder.count({
            where: {
              status: {
                in: [
                  PurchaseOrderStatus.SUBMITTED,
                  PurchaseOrderStatus.CONFIRMED,
                  PurchaseOrderStatus.PARTIALLY_RECEIVED,
                ],
              },
            },
          }),
          tx.resellerApplication.count({
            where: { status: ResellerApplicationStatus.PENDING },
          }),
          tx.businessAccount.count({
            where: { status: BusinessAccountStatus.APPROVED },
          }),
          tx.order.groupBy({
            by: ['salesChannel'],
            _sum: { totalCents: true },
            _count: true,
          }),
        ]);
      return {
        outOfStock: stock.filter(
          (item) => item.onHandQuantity <= item.reservedQuantity,
        ).length,
        belowReorderPoint: stock.filter(
          (item) =>
            item.reorderPoint !== null &&
            item.onHandQuantity - item.reservedQuantity <= item.reorderPoint,
        ).length,
        reservedQuantity: stock.reduce(
          (sum, item) => sum + item.reservedQuantity,
          0,
        ),
        estimatedStockValueCents: stock.reduce(
          (sum, item) => sum + item.onHandQuantity * item.product.priceCents,
          0,
        ),
        pendingPurchases: purchases,
        pendingApplications: applications,
        activeResellers: resellers,
        sales,
      };
    }, serializable);
  }

  stock() {
    return this.prisma.stockItem.findMany({
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });
  }

  movements() {
    return this.prisma.stockMovement.findMany({
      include: {
        product: true,
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  suppliers() {
    return this.prisma.supplier.findMany({ orderBy: { tradeName: 'asc' } });
  }

  supplier(id: string) {
    return this.prisma.supplier.findUniqueOrThrow({
      where: { id },
      include: {
        products: { include: { product: true } },
        purchaseOrders: true,
      },
    });
  }

  createSupplier(body: SupplierDto) {
    return this.prisma.supplier.create({
      data: { ...body, address: body.address as Prisma.InputJsonValue },
    });
  }

  updateSupplier(id: string, body: SupplierDto) {
    return this.prisma.supplier.update({
      where: { id },
      data: { ...body, address: body.address as Prisma.InputJsonValue },
    });
  }

  purchases() {
    return this.prisma.purchaseOrder.findMany({
      include: { supplier: true, items: true, receipts: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  purchase(id: string) {
    return this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true, receiptItems: true } },
        receipts: { include: { items: true } },
      },
    });
  }

  createPurchase(body: PurchaseOrderDto, authorId: string) {
    if (!body.items.length)
      throw new BadRequestException('A compra não tem artigos.');
    const subtotalCents = body.items.reduce(
      (sum, item) => sum + item.unitCostCents * item.orderedQuantity,
      0,
    );
    const taxCents = body.items.reduce(
      (sum, item) =>
        sum +
        Math.round(
          (item.unitCostCents *
            item.orderedQuantity *
            (item.taxRateBasisPoints ?? 0)) /
            10_000,
        ),
      0,
    );
    return this.prisma.purchaseOrder.create({
      data: {
        number: code('PO'),
        supplierId: body.supplierId,
        subtotalCents,
        taxCents,
        totalCents: subtotalCents + taxCents,
        expectedAt: body.expectedAt ? new Date(body.expectedAt) : undefined,
        paymentTermsSnapshot: body.paymentTermsSnapshot,
        notes: body.notes,
        authorId,
        items: {
          create: body.items.map((item) => ({
            ...item,
            totalCents: item.unitCostCents * item.orderedQuantity,
          })),
        },
      },
      include: { items: true, supplier: true },
    });
  }

  async receivePurchase(
    purchaseOrderId: string,
    body: PurchaseReceiptDto,
    authorId: string,
  ) {
    const duplicate = await this.prisma.purchaseReceipt.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: { items: true },
    });
    if (duplicate) return duplicate;
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: true },
      });
      if (!order)
        throw new NotFoundException('Ordem de compra não encontrada.');
      if (
        order.status === PurchaseOrderStatus.CANCELLED ||
        order.status === PurchaseOrderStatus.RECEIVED
      )
        throw new ConflictException('A ordem de compra não admite receções.');
      const receipt = await tx.purchaseReceipt.create({
        data: {
          purchaseOrderId,
          number: code('REC'),
          authorId,
          note: body.note,
          idempotencyKey: body.idempotencyKey,
        },
      });
      for (const line of body.items) {
        const item = order.items.find(
          (candidate) => candidate.id === line.purchaseOrderItemId,
        );
        if (!item) throw new BadRequestException('Artigo de compra inválido.');
        const pending = item.orderedQuantity - item.receivedQuantity;
        if (line.quantity > pending && !body.allowOverReceipt)
          throw new ConflictException(
            'Quantidade recebida superior ao pendente.',
          );
        const movement = await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.PURCHASE_RECEIPT,
            quantity: line.quantity,
            referenceType: 'PurchaseReceipt',
            referenceId: receipt.id,
            idempotencyKey: `${body.idempotencyKey}:${item.id}`,
            authorId,
          },
        });
        await tx.stockItem.upsert({
          where: { productId: item.productId },
          create: { productId: item.productId, onHandQuantity: line.quantity },
          update: { onHandQuantity: { increment: line.quantity } },
        });
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: { increment: line.quantity } },
        });
        await tx.purchaseReceiptItem.create({
          data: {
            purchaseReceiptId: receipt.id,
            purchaseOrderItemId: item.id,
            quantity: line.quantity,
            stockMovementId: movement.id,
          },
        });
      }
      const refreshed = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId },
      });
      const complete = refreshed.every(
        (item) => item.receivedQuantity >= item.orderedQuantity,
      );
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: complete
            ? PurchaseOrderStatus.RECEIVED
            : PurchaseOrderStatus.PARTIALLY_RECEIVED,
          receivedAt: complete ? new Date() : undefined,
        },
      });
      return tx.purchaseReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        include: { items: { include: { stockMovement: true } } },
      });
    }, serializable);
  }

  async reserveOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockReservation.findMany({
        where: { orderId, status: StockReservationStatus.ACTIVE },
      });
      if (existing.length) return existing;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Encomenda não encontrada.');
      const reservations = [];
      for (const item of order.items) {
        if (!item.productId) throw new ConflictException('Produto removido.');
        const changed = await tx.$executeRaw`
          UPDATE "StockItem"
          SET "reservedQuantity" = "reservedQuantity" + ${item.quantity},
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "productId" = ${item.productId}::uuid
            AND ("trackStock" = false OR "onHandQuantity" - "reservedQuantity" >= ${item.quantity})
        `;
        if (changed !== 1)
          throw new ConflictException(
            `Stock insuficiente para ${item.productName}.`,
          );
        const reservation = await tx.stockReservation.create({
          data: {
            productId: item.productId,
            orderId,
            quantity: item.quantity,
            idempotencyKey: `order:${orderId}:reserve:${item.productId}`,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            orderId,
            type: StockMovementType.ORDER_RESERVATION,
            quantity: -item.quantity,
            referenceType: 'Order',
            referenceId: orderId,
            idempotencyKey: `order:${orderId}:movement:reserve:${item.productId}`,
          },
        });
        reservations.push(reservation);
      }
      return reservations;
    }, serializable);
  }

  releaseOrder(
    orderId: string,
    reason = 'Encomenda cancelada ou pagamento falhado.',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: StockReservationStatus.ACTIVE },
      });
      for (const reservation of reservations) {
        await tx.stockItem.update({
          where: { productId: reservation.productId },
          data: { reservedQuantity: { decrement: reservation.quantity } },
        });
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { status: StockReservationStatus.RELEASED },
        });
        await tx.stockMovement.upsert({
          where: {
            idempotencyKey: `order:${orderId}:movement:release:${reservation.productId}`,
          },
          create: {
            productId: reservation.productId,
            orderId,
            type: StockMovementType.ORDER_RELEASE,
            quantity: reservation.quantity,
            referenceType: 'Order',
            referenceId: orderId,
            idempotencyKey: `order:${orderId}:movement:release:${reservation.productId}`,
            note: reason,
          },
          update: {},
        });
      }
      return { released: reservations.length };
    }, serializable);
  }

  fulfillOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: StockReservationStatus.ACTIVE },
      });
      if (!reservations.length)
        throw new ConflictException('A encomenda não tem reserva ativa.');
      for (const reservation of reservations) {
        const changed = await tx.stockItem.updateMany({
          where: {
            productId: reservation.productId,
            onHandQuantity: { gte: reservation.quantity },
            reservedQuantity: { gte: reservation.quantity },
          },
          data: {
            onHandQuantity: { decrement: reservation.quantity },
            reservedQuantity: { decrement: reservation.quantity },
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('Stock inconsistente.');
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { status: StockReservationStatus.CONSUMED },
        });
        await tx.stockMovement.create({
          data: {
            productId: reservation.productId,
            orderId,
            type: StockMovementType.ORDER_FULFILLMENT,
            quantity: -reservation.quantity,
            referenceType: 'Order',
            referenceId: orderId,
            idempotencyKey: `order:${orderId}:movement:fulfill:${reservation.productId}`,
          },
        });
      }
      return { consumed: reservations.length };
    }, serializable);
  }

  inventories() {
    return this.prisma.inventoryCount.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  createInventory(body: InventoryDto, authorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.findMany({
        where: { productId: { in: body.items.map((item) => item.productId) } },
      });
      return tx.inventoryCount.create({
        data: {
          number: code('INV'),
          status: InventoryCountStatus.IN_PROGRESS,
          referenceAt: new Date(),
          authorId,
          notes: body.notes,
          items: {
            create: body.items.map((item) => ({
              productId: item.productId,
              expectedQuantity:
                stock.find(
                  (candidate) => candidate.productId === item.productId,
                )?.onHandQuantity ?? 0,
              countedQuantity: item.countedQuantity,
              reason: item.reason,
            })),
          },
        },
        include: { items: true },
      });
    }, serializable);
  }

  completeInventory(id: string, authorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!count || count.status !== InventoryCountStatus.IN_PROGRESS)
        throw new ConflictException('Inventário não está em curso.');
      for (const item of count.items) {
        if (item.countedQuantity === null)
          throw new ConflictException('Existem contagens em falta.');
        const difference = item.countedQuantity - item.expectedQuantity;
        if (!difference) continue;
        const movement = await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.INVENTORY_CORRECTION,
            quantity: difference,
            referenceType: 'InventoryCount',
            referenceId: id,
            idempotencyKey: `inventory:${id}:${item.productId}`,
            note: item.reason,
            authorId,
          },
        });
        await tx.stockItem.upsert({
          where: { productId: item.productId },
          create: {
            productId: item.productId,
            onHandQuantity: item.countedQuantity,
          },
          update: { onHandQuantity: item.countedQuantity },
        });
        await tx.inventoryCountItem.update({
          where: { id: item.id },
          data: { stockMovementId: movement.id },
        });
      }
      return tx.inventoryCount.update({
        where: { id },
        data: { status: InventoryCountStatus.COMPLETED },
        include: { items: true },
      });
    }, serializable);
  }

  apply(body: ResellerApplicationDto) {
    return this.prisma.resellerApplication.create({
      data: {
        ...body,
        email: body.email.toLowerCase(),
        address: body.address as Prisma.InputJsonValue,
      },
    });
  }

  applications() {
    return this.prisma.resellerApplication.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async decideApplication(
    id: string,
    body: ApplicationDecisionDto,
    authorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.resellerApplication.findUnique({
        where: { id },
      });
      if (
        !application ||
        application.status !== ResellerApplicationStatus.PENDING
      )
        throw new ConflictException('Candidatura já decidida ou inexistente.');
      if (!body.approved) {
        return tx.resellerApplication.update({
          where: { id },
          data: {
            status: ResellerApplicationStatus.REJECTED,
            decidedAt: new Date(),
            decidedBy: authorId,
            internalReason: body.internalReason,
          },
        });
      }
      if (!body.priceListId)
        throw new BadRequestException('Tabela de preços obrigatória.');
      const account = await tx.businessAccount.create({
        data: {
          tradeName: application.tradeName,
          legalName: application.legalName,
          taxNumber: application.taxNumber,
          businessEmail: application.email,
          phone: application.phone,
          billingAddress: application.address as Prisma.InputJsonValue,
          status: BusinessAccountStatus.APPROVED,
          priceListId: body.priceListId,
          paymentTerms: body.paymentTerms,
          managerId: authorId,
        },
      });
      const existingUser = await tx.user.findUnique({
        where: { email: application.email.toLowerCase() },
      });
      if (existingUser) {
        await tx.businessAccountUser.create({
          data: {
            businessAccountId: account.id,
            userId: existingUser.id,
            role: 'OWNER',
          },
        });
      }
      await tx.resellerApplication.update({
        where: { id },
        data: {
          status: ResellerApplicationStatus.APPROVED,
          decidedAt: new Date(),
          decidedBy: authorId,
          internalReason: body.internalReason,
          businessAccountId: account.id,
        },
      });
      return account;
    }, serializable);
  }

  businessAccounts() {
    return this.prisma.businessAccount.findMany({
      include: { priceList: true, users: true },
      orderBy: { tradeName: 'asc' },
    });
  }

  businessAccount(id: string) {
    return this.prisma.businessAccount.findUniqueOrThrow({
      where: { id },
      include: {
        priceList: { include: { items: { include: { product: true } } } },
        users: true,
        orders: true,
      },
    });
  }

  setBusinessStatus(id: string, status: BusinessAccountStatus) {
    if (
      status !== BusinessAccountStatus.APPROVED &&
      status !== BusinessAccountStatus.SUSPENDED
    )
      throw new BadRequestException('Estado empresarial inválido.');
    return this.prisma.businessAccount.update({
      where: { id },
      data: { status },
    });
  }

  priceLists() {
    return this.prisma.priceList.findMany({
      include: { items: { include: { product: true } } },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  createPriceList(body: PriceListDto) {
    return this.prisma.priceList.create({
      data: {
        name: body.name,
        code: body.code,
        type: body.type,
        includesTax: body.includesTax,
        priority: body.priority,
        items: { create: body.items },
      },
      include: { items: true },
    });
  }

  async accountForUser(userId: string) {
    const membership = await this.prisma.businessAccountUser.findFirst({
      where: { userId, isActive: true },
      include: {
        businessAccount: {
          include: { priceList: { include: { items: true } } },
        },
      },
    });
    if (
      !membership ||
      membership.businessAccount.status !== BusinessAccountStatus.APPROVED
    )
      throw new NotFoundException('Conta empresarial aprovada não encontrada.');
    return membership.businessAccount;
  }

  async resolvedCatalog(userId?: string) {
    let account:
      Awaited<ReturnType<OperationsService['accountForUser']>> | undefined;
    if (userId) {
      try {
        account = await this.accountForUser(userId);
      } catch {
        account = undefined;
      }
    }
    const b2b = Boolean(account);
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        channel: b2b
          ? { in: ['B2B_ONLY', 'BOTH'] }
          : { in: ['B2C_ONLY', 'BOTH'] },
      },
      include: { stockItem: true },
      orderBy: { name: 'asc' },
    });
    const prices = new Map(
      account?.priceList?.items.map((item) => [item.productId, item]),
    );
    return products.map((product) => {
      const price = prices.get(product.id);
      return {
        ...product,
        priceCents:
          price?.promotionalPriceCents ??
          price?.priceCents ??
          product.priceCents,
        minimumOrderQuantity:
          price?.minimumQuantity ?? product.minimumOrderQuantity,
        availableQuantity: product.stockItem
          ? product.stockItem.onHandQuantity -
            product.stockItem.reservedQuantity
          : null,
        salesChannel: b2b ? SalesChannel.B2B : SalesChannel.B2C,
      };
    });
  }

  async createB2BOrder(
    userId: string,
    productId: string,
    quantity: number,
    reference?: string,
  ) {
    const account = await this.accountForUser(userId);
    const catalog = await this.resolvedCatalog(userId);
    const product = catalog.find((item) => item.id === productId);
    if (!product) throw new NotFoundException('Produto B2B indisponível.');
    if (
      quantity < product.minimumOrderQuantity ||
      quantity % product.orderMultiple !== 0
    )
      throw new BadRequestException(
        'Quantidade não respeita mínimos e múltiplos.',
      );
    const delivery = await this.prisma.deliveryMethod.findFirstOrThrow({
      where: { isActive: true },
    });
    const subtotalCents = product.priceCents * quantity;
    if (account.minimumOrderCents && subtotalCents < account.minimumOrderCents)
      throw new BadRequestException('Encomenda inferior ao mínimo comercial.');
    const order = await this.prisma.order.create({
      data: {
        number: code('NSB2B'),
        userId,
        email: account.businessEmail,
        customerName: account.tradeName,
        phone: account.phone,
        status: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        subtotalCents,
        shippingCents: account.shippingCents ?? 0,
        totalCents: subtotalCents + (account.shippingCents ?? 0),
        billingAddress: account.billingAddress as Prisma.InputJsonValue,
        shippingAddress: account.billingAddress as Prisma.InputJsonValue,
        deliveryMethodId: delivery.id,
        idempotencyKey: code('B2B'),
        salesChannel: SalesChannel.B2B,
        businessAccountId: account.id,
        priceListId: account.priceListId,
        paymentTermsSnapshot: {
          terms: account.paymentTerms,
          allowedPaymentMethods: account.allowedPaymentMethods,
          creditLimitCents: account.creditLimitCents,
        },
        customerReference: reference,
        requiresApproval: account.requiresApproval,
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitPriceCents: product.priceCents,
            quantity,
            totalCents: subtotalCents,
            imageUrl: product.imageUrl,
          },
        },
        statusHistory: { create: { toStatus: OrderStatus.PENDING_PAYMENT } },
      },
    });
    await this.reserveOrder(order.id);
    return this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, stockReservations: true },
    });
  }
}
