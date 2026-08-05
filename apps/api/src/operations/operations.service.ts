import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BusinessAccountUserRole,
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
import { ReceivablesService } from '../receivables/receivables.service';
import { sendTransactionalMail } from '../mail/outlook-mail';
import type {
  ApplicationDecisionDto,
  BusinessAccountDto,
  BusinessAccountUserDto,
  InventoryDto,
  InventoryUpdateDto,
  PriceListDto,
  PurchaseOrderDto,
  PurchaseReceiptDto,
  StockAdjustmentDto,
  StockConfigurationDto,
  ResellerApplicationDto,
  SupplierDto,
  UpdateBusinessAccountUserDto,
} from './dto';

const serializable = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};
const code = (prefix: string) =>
  `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;

const purchaseTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> =
  {
    DRAFT: [PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.CANCELLED],
    SUBMITTED: [PurchaseOrderStatus.CONFIRMED, PurchaseOrderStatus.CANCELLED],
    CONFIRMED: [PurchaseOrderStatus.CANCELLED],
    PARTIALLY_RECEIVED: [],
    RECEIVED: [],
    CANCELLED: [],
  };

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly receivables?: ReceivablesService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  dashboard() {
    return this.prisma.$transaction(async (tx) => {
      const [
        stock,
        purchases,
        applications,
        resellers,
        sales,
        ordersByStatus,
        purchasesByStatus,
        supportByStatus,
        usersByRole,
        blogByStatus,
        productCount,
        activeProductCount,
        featuredProductCount,
        categoryCount,
      ] = await Promise.all([
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
        tx.order.groupBy({
          by: ['status'],
          _sum: { totalCents: true },
          _count: true,
        }),
        tx.purchaseOrder.groupBy({ by: ['status'], _count: true }),
        tx.supportCase.groupBy({ by: ['status'], _count: true }),
        tx.user.groupBy({ by: ['role'], _count: true }),
        tx.blogPost.groupBy({ by: ['status'], _count: true }),
        tx.product.count(),
        tx.product.count({ where: { isActive: true } }),
        tx.product.count({ where: { isFeatured: true, isActive: true } }),
        tx.category.count({ where: { isActive: true } }),
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
        ordersByStatus,
        purchasesByStatus,
        supportByStatus,
        usersByRole,
        blogByStatus,
        catalog: {
          products: productCount,
          activeProducts: activeProductCount,
          featuredProducts: featuredProductCount,
          categories: categoryCount,
        },
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

  async configureStock(productId: string, body: StockConfigurationDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return this.prisma.stockItem.upsert({
      where: { productId },
      create: {
        productId,
        reorderPoint: body.reorderPoint,
        reorderQuantity: body.reorderQuantity,
        trackStock: body.trackStock,
      },
      update: body,
      include: { product: true },
    });
  }

  async adjustStock(body: StockAdjustmentDto, authorId: string) {
    const existing = await this.prisma.stockMovement.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: { product: true },
    });
    if (existing) return existing;
    const incoming = body.type === StockMovementType.ADJUSTMENT_IN;
    const signedQuantity = incoming ? body.quantity : -body.quantity;
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.findUnique({
        where: { productId: body.productId },
        include: { product: true },
      });
      if (!stock)
        throw new NotFoundException('Stock do produto não encontrado.');
      if (
        !incoming &&
        stock.onHandQuantity - body.quantity < stock.reservedQuantity
      ) {
        throw new ConflictException(
          'O acerto deixaria o stock físico abaixo da quantidade reservada.',
        );
      }
      await tx.stockItem.update({
        where: { productId: body.productId },
        data: { onHandQuantity: { increment: signedQuantity } },
      });
      return tx.stockMovement.create({
        data: {
          productId: body.productId,
          type: body.type,
          quantity: signedQuantity,
          referenceType: 'ManualAdjustment',
          referenceId: body.idempotencyKey,
          idempotencyKey: body.idempotencyKey,
          note: body.note,
          authorId,
        },
        include: { product: true },
      });
    }, serializable);
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

  async deleteSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, purchaseOrders: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
    if (supplier._count.products || supplier._count.purchaseOrders) {
      const updated = await this.prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
      return { action: 'DEACTIVATED', supplier: updated };
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { action: 'DELETED' };
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

  async updatePurchase(id: string, body: PurchaseOrderDto) {
    const current = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { receipts: true },
    });
    if (!current)
      throw new NotFoundException('Ordem de compra não encontrada.');
    if (
      current.status !== PurchaseOrderStatus.DRAFT ||
      current.receipts.length
    ) {
      throw new ConflictException(
        'Só é possível editar uma compra em rascunho e sem receções.',
      );
    }
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
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: body.supplierId,
        expectedAt: body.expectedAt ? new Date(body.expectedAt) : null,
        paymentTermsSnapshot: body.paymentTermsSnapshot,
        notes: body.notes,
        subtotalCents,
        taxCents,
        totalCents: subtotalCents + taxCents,
        items: {
          deleteMany: {},
          create: body.items.map((item) => ({
            ...item,
            totalCents: item.unitCostCents * item.orderedQuantity,
          })),
        },
      },
      include: { supplier: true, items: true, receipts: true },
    });
  }

  async setPurchaseStatus(id: string, status: PurchaseOrderStatus) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { receipts: { select: { id: true } } },
    });
    if (!order) throw new NotFoundException('Ordem de compra não encontrada.');
    if (!purchaseTransitions[order.status].includes(status)) {
      throw new ConflictException(
        `Não é possível passar a compra de ${order.status} para ${status}.`,
      );
    }
    if (status === PurchaseOrderStatus.CANCELLED && order.receipts.length) {
      throw new ConflictException(
        'Uma compra com receções já registadas não pode ser cancelada.',
      );
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status,
        issuedAt:
          status === PurchaseOrderStatus.SUBMITTED
            ? (order.issuedAt ?? new Date())
            : undefined,
      },
      include: { supplier: true, items: true, receipts: true },
    });
  }

  async receivePurchase(
    purchaseOrderId: string,
    body: PurchaseReceiptDto,
    authorId: string,
  ) {
    if (!body.items.length)
      throw new BadRequestException('A receção não tem artigos.');
    if (
      new Set(body.items.map((item) => item.purchaseOrderItemId)).size !==
      body.items.length
    )
      throw new BadRequestException('A receção contém artigos repetidos.');
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
        !(
          [
            PurchaseOrderStatus.SUBMITTED,
            PurchaseOrderStatus.CONFIRMED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
          ] as PurchaseOrderStatus[]
        ).includes(order.status)
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

  inventory(id: string) {
    return this.prisma.inventoryCount.findUniqueOrThrow({
      where: { id },
      include: {
        author: { select: { firstName: true, lastName: true } },
        items: {
          include: { product: true, stockMovement: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
  }

  createInventory(body: InventoryDto, authorId: string) {
    if (!body.items.length)
      throw new BadRequestException('Selecione pelo menos um produto.');
    if (
      new Set(body.items.map((item) => item.productId)).size !==
      body.items.length
    )
      throw new BadRequestException('O inventário contém produtos repetidos.');
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.findMany({
        where: { productId: { in: body.items.map((item) => item.productId) } },
      });
      const products = await tx.product.count({
        where: { id: { in: body.items.map((item) => item.productId) } },
      });
      if (products !== body.items.length)
        throw new BadRequestException('Um ou mais produtos são inválidos.');
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

  async updateInventory(id: string, body: InventoryUpdateDto) {
    if (!body.items.length)
      throw new BadRequestException('A contagem não tem artigos.');
    if (
      new Set(body.items.map((item) => item.productId)).size !==
      body.items.length
    )
      throw new BadRequestException('A contagem contém produtos repetidos.');
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!count) throw new NotFoundException('Inventário não encontrado.');
      if (count.status !== InventoryCountStatus.IN_PROGRESS)
        throw new ConflictException('O inventário já não pode ser alterado.');
      for (const line of body.items) {
        const item = count.items.find(
          (candidate) => candidate.productId === line.productId,
        );
        if (!item)
          throw new BadRequestException(
            'A contagem contém um produto fora deste inventário.',
          );
        await tx.inventoryCountItem.update({
          where: { id: item.id },
          data: {
            countedQuantity: line.countedQuantity,
            reason: line.reason,
          },
        });
      }
      return tx.inventoryCount.update({
        where: { id },
        data: { notes: body.notes },
        include: { items: { include: { product: true } } },
      });
    }, serializable);
  }

  async cancelInventory(id: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
    });
    if (!count) throw new NotFoundException('Inventário não encontrado.');
    if (count.status !== InventoryCountStatus.IN_PROGRESS)
      throw new ConflictException(
        'Apenas inventários em curso podem ser cancelados.',
      );
    return this.prisma.inventoryCount.update({
      where: { id },
      data: { status: InventoryCountStatus.CANCELLED },
      include: { items: { include: { product: true } } },
    });
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
        const current = await tx.stockItem.findUnique({
          where: { productId: item.productId },
        });
        const currentQuantity = current?.onHandQuantity ?? 0;
        if (current && item.countedQuantity < current.reservedQuantity) {
          throw new ConflictException(
            'Uma contagem não pode ficar abaixo do stock reservado.',
          );
        }
        const difference = item.countedQuantity - currentQuantity;
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

  async apply(body: ResellerApplicationDto) {
    const duplicate = await this.prisma.resellerApplication.findFirst({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { taxNumber: body.taxNumber },
          { email: body.email.toLowerCase() },
        ],
      },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictException(
        'Já existe uma candidatura ativa com este NIF ou email.',
      );
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

  application(id: string) {
    return this.prisma.resellerApplication.findUniqueOrThrow({
      where: { id },
    });
  }

  async decideApplication(
    id: string,
    body: ApplicationDecisionDto,
    authorId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
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
      const priceList = await tx.priceList.findFirst({
        where: { id: body.priceListId, isActive: true },
      });
      if (!priceList)
        throw new BadRequestException('Tabela de preços inválida ou inativa.');
      const duplicateAccount = await tx.businessAccount.findUnique({
        where: { taxNumber: application.taxNumber },
      });
      if (duplicateAccount)
        throw new ConflictException(
          'Já existe uma conta empresarial com este NIF.',
        );
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
        select: { id: true, emailVerifiedAt: true },
      });
      if (existingUser?.emailVerifiedAt) {
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
    if (this.config) {
      const website =
        this.config.get<string>('WEBSITE_URL')?.replace(/\/$/, '') ?? '';
      sendTransactionalMail(this.config, {
        to: 'businessEmail' in result ? result.businessEmail : result.email,
        subject: body.approved
          ? 'Nsabores — candidatura profissional aprovada'
          : 'Nsabores — decisão sobre a candidatura profissional',
        text: body.approved
          ? `A sua candidatura profissional foi aprovada. Entre na sua conta ou registe-se com o mesmo email para aceder às condições atribuídas: ${website}/conta/entrar`
          : `A candidatura profissional não foi aprovada nesta fase. Para qualquer esclarecimento, contacte nsabores@outlook.pt.`,
      });
    }
    return result;
  }

  businessAccounts() {
    return this.prisma.businessAccount.findMany({
      include: {
        priceList: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { tradeName: 'asc' },
    });
  }

  businessAccount(id: string) {
    return this.prisma.businessAccount.findUniqueOrThrow({
      where: { id },
      include: {
        priceList: { include: { items: { include: { product: true } } } },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        orders: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  async createBusinessAccount(body: BusinessAccountDto, managerId: string) {
    await this.validateBusinessPriceList(body.priceListId);
    return this.uniqueBusinessOperation(() =>
      this.prisma.businessAccount.create({
        data: {
          ...body,
          businessEmail: body.businessEmail.toLowerCase(),
          billingAddress: body.billingAddress as Prisma.InputJsonValue,
          status: BusinessAccountStatus.APPROVED,
          managerId,
        },
        include: { priceList: true },
      }),
    );
  }

  async updateBusinessAccount(id: string, body: BusinessAccountDto) {
    await this.validateBusinessPriceList(body.priceListId);
    return this.uniqueBusinessOperation(() =>
      this.prisma.businessAccount.update({
        where: { id },
        data: {
          ...body,
          businessEmail: body.businessEmail.toLowerCase(),
          billingAddress: body.billingAddress as Prisma.InputJsonValue,
        },
        include: { priceList: true },
      }),
    );
  }

  setBusinessStatus(id: string, status: BusinessAccountStatus) {
    return this.prisma.businessAccount.update({
      where: { id },
      data: { status },
    });
  }

  async addBusinessAccountUser(
    businessAccountId: string,
    body: BusinessAccountUserDto,
  ) {
    const [account, user] = await Promise.all([
      this.prisma.businessAccount.findUnique({
        where: { id: businessAccountId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
        select: { id: true, emailVerifiedAt: true },
      }),
    ]);
    if (!account)
      throw new NotFoundException('Conta empresarial não encontrada.');
    if (!user)
      throw new NotFoundException(
        'O utilizador ainda não tem conta. Deve registar-se primeiro com este email.',
      );
    if (!user.emailVerifiedAt)
      throw new ConflictException(
        'O utilizador tem de verificar o email antes de ser associado à empresa.',
      );
    const activeMembers = await this.prisma.businessAccountUser.count({
      where: { businessAccountId, isActive: true },
    });
    if (!activeMembers && body.role !== BusinessAccountUserRole.OWNER)
      throw new BadRequestException(
        'O primeiro membro da conta tem de ser proprietário.',
      );
    return this.prisma.businessAccountUser.upsert({
      where: {
        businessAccountId_userId: { businessAccountId, userId: user.id },
      },
      create: { businessAccountId, userId: user.id, role: body.role },
      update: { role: body.role, isActive: true },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateBusinessAccountUser(
    businessAccountId: string,
    membershipId: string,
    body: UpdateBusinessAccountUserDto,
  ) {
    const membership = await this.prisma.businessAccountUser.findFirst({
      where: { id: membershipId, businessAccountId },
    });
    if (!membership)
      throw new NotFoundException('Membro empresarial não encontrado.');
    await this.ensureBusinessOwnerRemains(
      businessAccountId,
      membership,
      body.role,
      body.isActive,
    );
    return this.prisma.businessAccountUser.update({
      where: { id: membershipId },
      data: body,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async removeBusinessAccountUser(
    businessAccountId: string,
    membershipId: string,
  ) {
    const membership = await this.prisma.businessAccountUser.findFirst({
      where: { id: membershipId, businessAccountId },
    });
    if (!membership)
      throw new NotFoundException('Membro empresarial não encontrado.');
    await this.ensureBusinessOwnerRemains(
      businessAccountId,
      membership,
      membership.role,
      false,
    );
    return this.prisma.businessAccountUser.update({
      where: { id: membershipId },
      data: { isActive: false },
    });
  }

  priceLists() {
    return this.prisma.priceList.findMany({
      include: { items: { include: { product: true } } },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  priceList(id: string) {
    return this.prisma.priceList.findUniqueOrThrow({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
        _count: {
          select: {
            businessAccounts: true,
            orders: true,
            promotionTargets: true,
          },
        },
      },
    });
  }

  async createPriceList(body: PriceListDto) {
    await this.validatePriceList(body);
    return this.uniqueBusinessOperation(() =>
      this.prisma.priceList.create({
        data: {
          name: body.name,
          code: body.code.toUpperCase(),
          type: body.type,
          includesTax: body.includesTax,
          priority: body.priority,
          isActive: body.isActive,
          validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
          validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
          items: { create: body.items },
        },
        include: { items: { include: { product: true } } },
      }),
    );
  }

  async updatePriceList(id: string, body: PriceListDto) {
    await this.validatePriceList(body);
    return this.uniqueBusinessOperation(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.priceListItem.deleteMany({ where: { priceListId: id } });
        return tx.priceList.update({
          where: { id },
          data: {
            name: body.name,
            code: body.code.toUpperCase(),
            type: body.type,
            includesTax: body.includesTax,
            priority: body.priority,
            isActive: body.isActive,
            validFrom: body.validFrom ? new Date(body.validFrom) : null,
            validUntil: body.validUntil ? new Date(body.validUntil) : null,
            items: { create: body.items },
          },
          include: { items: { include: { product: true } } },
        });
      }, serializable),
    );
  }

  async deletePriceList(id: string) {
    const list = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            businessAccounts: true,
            orders: true,
            promotionTargets: true,
          },
        },
      },
    });
    if (!list) throw new NotFoundException('Tabela de preços não encontrada.');
    if (
      list._count.businessAccounts ||
      list._count.orders ||
      list._count.promotionTargets
    ) {
      const priceList = await this.prisma.priceList.update({
        where: { id },
        data: { isActive: false },
      });
      return { action: 'DEACTIVATED', priceList };
    }
    await this.prisma.$transaction([
      this.prisma.priceListItem.deleteMany({ where: { priceListId: id } }),
      this.prisma.priceList.delete({ where: { id } }),
    ]);
    return { action: 'DELETED' };
  }

  private async validateBusinessPriceList(priceListId?: string | null) {
    if (!priceListId) return;
    const priceList = await this.prisma.priceList.findFirst({
      where: { id: priceListId, isActive: true },
      select: { id: true },
    });
    if (!priceList)
      throw new BadRequestException('Tabela de preços inválida ou inativa.');
  }

  private async validatePriceList(body: PriceListDto) {
    if (!body.items.length)
      throw new BadRequestException(
        'A tabela tem de incluir pelo menos um produto.',
      );
    if (
      new Set(body.items.map((item) => item.productId)).size !==
      body.items.length
    )
      throw new BadRequestException('A tabela contém produtos repetidos.');
    if (
      body.validFrom &&
      body.validUntil &&
      new Date(body.validFrom) > new Date(body.validUntil)
    )
      throw new BadRequestException('O fim da validade é anterior ao início.');
    if (
      body.items.some(
        (item) =>
          item.promotionalPriceCents !== undefined &&
          item.promotionalPriceCents > item.priceCents,
      )
    )
      throw new BadRequestException(
        'O preço promocional não pode ser superior ao preço base.',
      );
    if (
      body.items.some(
        (item) =>
          item.minimumQuantity !== undefined &&
          item.maximumQuantity !== undefined &&
          item.minimumQuantity > item.maximumQuantity,
      )
    )
      throw new BadRequestException(
        'A quantidade máxima não pode ser inferior à quantidade mínima.',
      );
    const productCount = await this.prisma.product.count({
      where: { id: { in: body.items.map((item) => item.productId) } },
    });
    if (productCount !== body.items.length)
      throw new BadRequestException(
        'A tabela contém um ou mais produtos inválidos.',
      );
  }

  private async uniqueBusinessOperation<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException(
            'Código, NIF ou associação já existente.',
          );
        if (error.code === 'P2025')
          throw new NotFoundException('Registo não encontrado.');
      }
      throw error;
    }
  }

  private async ensureBusinessOwnerRemains(
    businessAccountId: string,
    membership: {
      id: string;
      role: BusinessAccountUserRole;
      isActive: boolean;
    },
    nextRole?: BusinessAccountUserRole,
    nextActive?: boolean,
  ) {
    const removesActiveOwner =
      membership.role === BusinessAccountUserRole.OWNER &&
      membership.isActive &&
      ((nextRole !== undefined && nextRole !== BusinessAccountUserRole.OWNER) ||
        nextActive === false);
    if (!removesActiveOwner) return;
    const otherOwners = await this.prisma.businessAccountUser.count({
      where: {
        businessAccountId,
        id: { not: membership.id },
        role: BusinessAccountUserRole.OWNER,
        isActive: true,
      },
    });
    if (!otherOwners)
      throw new ConflictException(
        'A conta empresarial tem de manter pelo menos um proprietário ativo.',
      );
  }

  async accountForUser(userId: string) {
    const membership = await this.prisma.businessAccountUser.findFirst({
      where: {
        userId,
        isActive: true,
        user: { emailVerifiedAt: { not: null } },
      },
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
    return { ...membership.businessAccount, membershipRole: membership.role };
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
        availableQuantity: product.stockItem?.trackStock
          ? product.stockItem.onHandQuantity -
            product.stockItem.reservedQuantity
          : null,
        salesChannel: b2b ? SalesChannel.B2B : SalesChannel.B2C,
      };
    });
  }

  async createB2BOrder(
    userId: string,
    items: Array<{ productId: string; quantity: number }>,
    deliveryMethodId?: string,
    reference?: string,
    idempotencyKey?: string,
  ) {
    const account = await this.accountForUser(userId);
    if (account.membershipRole === BusinessAccountUserRole.VIEWER)
      throw new ForbiddenException(
        'Este acesso permite consultar, mas não criar encomendas.',
      );
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: true, stockReservations: true },
      });
      if (existing) {
        if (
          existing.userId !== userId ||
          existing.businessAccountId !== account.id
        )
          throw new ConflictException('Chave de idempotência já utilizada.');
        return existing;
      }
    }
    const catalog = await this.resolvedCatalog(userId);
    const lines = items.map((line) => {
      const product = catalog.find((item) => item.id === line.productId);
      if (!product) throw new NotFoundException('Produto B2B indisponível.');
      if (
        line.quantity < product.minimumOrderQuantity ||
        line.quantity % product.orderMultiple !== 0
      )
        throw new BadRequestException(
          `A quantidade de ${product.name} não respeita mínimos e múltiplos.`,
        );
      if (
        product.availableQuantity !== null &&
        line.quantity > product.availableQuantity
      )
        throw new ConflictException(`Stock insuficiente para ${product.name}.`);
      return {
        product,
        quantity: line.quantity,
        totalCents: product.priceCents * line.quantity,
      };
    });
    const delivery = await this.prisma.deliveryMethod.findFirstOrThrow({
      where: { id: deliveryMethodId, isActive: true },
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
    if (account.minimumOrderCents && subtotalCents < account.minimumOrderCents)
      throw new BadRequestException('Encomenda inferior ao mínimo comercial.');
    const order = await this.prisma.order.create({
      data: {
        number: code('NSB2B'),
        userId,
        email: account.businessEmail,
        customerName: account.tradeName,
        phone: account.phone,
        status: account.requiresApproval
          ? OrderStatus.PENDING_APPROVAL
          : OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        subtotalCents,
        shippingCents: account.shippingCents ?? 0,
        totalCents: subtotalCents + (account.shippingCents ?? 0),
        billingAddress: account.billingAddress as Prisma.InputJsonValue,
        shippingAddress: account.billingAddress as Prisma.InputJsonValue,
        deliveryMethodId: delivery.id,
        idempotencyKey: idempotencyKey ?? code('B2B'),
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
          create: lines.map(({ product, quantity, totalCents }) => ({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitPriceCents: product.priceCents,
            quantity,
            totalCents,
            imageUrl: product.imageUrl,
          })),
        },
        statusHistory: {
          create: {
            toStatus: account.requiresApproval
              ? OrderStatus.PENDING_APPROVAL
              : OrderStatus.PENDING_PAYMENT,
          },
        },
      },
    });
    try {
      if (!account.requiresApproval) await this.reserveOrder(order.id);
      await this.receivables?.ensureAgreement(order.id);
    } catch (error) {
      await this.releaseOrder(
        order.id,
        'Criação da encomenda B2B revertida por falha operacional.',
      ).catch(() => undefined);
      await this.prisma.order.deleteMany({ where: { id: order.id } });
      throw error;
    }
    return this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, stockReservations: true },
    });
  }
}
