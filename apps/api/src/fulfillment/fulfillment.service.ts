import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  StockMovementType,
  StockReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { OperationsService } from '../operations/operations.service';
import type {
  CreateReturnDto,
  CreateShipmentDto,
  CreateSupportCaseDto,
  ReturnDecisionDto,
  ShipmentEventDto,
  SupportCaseCommentDto,
  SupportCaseStatusUpdateDto,
} from './dto';
import { ReturnRequestStatusDtoValue, ShipmentStatusDtoValue } from './dto';
import { ShippingProvider } from './shipping.provider';

interface ShipmentRow {
  id: string;
  orderId: string;
  number: string;
  provider: string;
  service: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  providerShipmentId: string | null;
  status: string;
  costCents: number;
  currency: string;
  shippedAt: Date | null;
  estimatedDeliveryAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReturnRow {
  id: string;
  number: string;
  orderId: string;
  userId: string | null;
  status: string;
  resolution: string;
  reason: string;
  customerNotes: string | null;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SupportCaseRow {
  id: string;
  number: string;
  userId: string | null;
  businessAccountId: string | null;
  orderId: string | null;
  shipmentId: string | null;
  type: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  resolution: string | null;
  assignedToId: string | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const serializable = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};

const number = (prefix: string) =>
  `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: OperationsService,
    private readonly shipping: ShippingProvider,
  ) {}

  preparationQueue() {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.READY],
        },
      },
      include: {
        items: true,
        deliveryMethod: true,
        businessAccount: { select: { id: true, tradeName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async shipments(orderId?: string) {
    const rows = orderId
      ? await this.prisma.$queryRaw<ShipmentRow[]>`
          SELECT * FROM "Shipment" WHERE "orderId" = ${orderId}::uuid
          ORDER BY "createdAt" DESC
        `
      : await this.prisma.$queryRaw<ShipmentRow[]>`
          SELECT * FROM "Shipment" ORDER BY "createdAt" DESC LIMIT 500
        `;
    return Promise.all(rows.map((row) => this.shipment(row.id)));
  }

  async shipment(id: string) {
    const rows = await this.prisma.$queryRaw<ShipmentRow[]>`
      SELECT * FROM "Shipment" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    const shipment = rows[0];
    if (!shipment) throw new NotFoundException('Expedição não encontrada.');
    const [items, events] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT si.*, oi."productName", oi."sku", oi."imageUrl"
        FROM "ShipmentItem" si
        JOIN "OrderItem" oi ON oi."id" = si."orderItemId"
        WHERE si."shipmentId" = ${id}::uuid
        ORDER BY si."createdAt" ASC
      `,
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "ShipmentEvent"
        WHERE "shipmentId" = ${id}::uuid
        ORDER BY "occurredAt" ASC
      `,
    ]);
    return { ...shipment, items, events };
  }

  async createShipment(body: CreateShipmentDto) {
    const duplicate = await this.prisma.$queryRaw<ShipmentRow[]>`
      SELECT * FROM "Shipment" WHERE "idempotencyKey" = ${body.idempotencyKey} LIMIT 1
    `;
    if (duplicate[0]) return this.shipment(duplicate[0].id);
    if (!body.items.length)
      throw new BadRequestException('A expedição não tem artigos.');
    if (
      new Set(body.items.map((item) => item.orderItemId)).size !==
      body.items.length
    )
      throw new BadRequestException('A expedição contém artigos repetidos.');

    const shipmentId = randomUUID();
    const shipmentNumber = number('SHP');
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: body.orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Encomenda não encontrada.');
      if (
        order.status !== OrderStatus.PAID &&
        order.status !== OrderStatus.PROCESSING &&
        order.status !== OrderStatus.READY
      ) {
        throw new ConflictException(
          'A encomenda não está pronta para preparação.',
        );
      }

      for (const line of body.items) {
        const orderItem = order.items.find(
          (item) => item.id === line.orderItemId,
        );
        if (!orderItem)
          throw new BadRequestException('Artigo inválido na expedição.');
        const shipped = await tx.$queryRaw<Array<{ quantity: bigint }>>`
          SELECT COALESCE(SUM(si."quantity"), 0)::bigint AS quantity
          FROM "ShipmentItem" si
          JOIN "Shipment" s ON s."id" = si."shipmentId"
          WHERE si."orderItemId" = ${line.orderItemId}::uuid
            AND s."status" <> 'CANCELLED'::"ShipmentStatus"
        `;
        if (
          Number(shipped[0]?.quantity ?? 0) + line.quantity >
          orderItem.quantity
        ) {
          throw new ConflictException(
            `A quantidade expedida de ${orderItem.productName} excede a encomendada.`,
          );
        }
      }

      await tx.$executeRaw`
        INSERT INTO "Shipment" (
          "id", "orderId", "number", "provider", "service", "status",
          "weightGrams", "lengthMm", "widthMm", "heightMm", "costCents",
          "idempotencyKey", "createdAt", "updatedAt"
        ) VALUES (
          ${shipmentId}::uuid, ${body.orderId}::uuid, ${shipmentNumber}, 'mock',
          ${body.service}, 'READY'::"ShipmentStatus", ${body.weightGrams ?? null},
          ${body.lengthMm ?? null}, ${body.widthMm ?? null}, ${body.heightMm ?? null},
          ${body.costCents ?? 0}, ${body.idempotencyKey}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
      for (const line of body.items) {
        await tx.$executeRaw`
          INSERT INTO "ShipmentItem" ("id", "shipmentId", "orderItemId", "quantity", "createdAt")
          VALUES (${randomUUID()}::uuid, ${shipmentId}::uuid, ${line.orderItemId}::uuid,
            ${line.quantity}, CURRENT_TIMESTAMP)
        `;
      }
      if (order.status === OrderStatus.PAID) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PROCESSING },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderStatus.PAID,
            toStatus: OrderStatus.PROCESSING,
            note: 'Preparação iniciada.',
          },
        });
      }
    }, serializable);
    return this.shipment(shipmentId);
  }

  async createLabel(id: string) {
    const shipment = await this.shipment(id);
    if (!['READY', 'LABEL_CREATED'].includes(shipment.status)) {
      throw new ConflictException('A expedição não permite criar etiqueta.');
    }
    if (shipment.trackingNumber) return shipment;
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: shipment.orderId },
      select: { shippingAddress: true },
    });
    const label = await this.shipping.createLabel({
      shipmentNumber: shipment.number,
      service: shipment.service,
      recipient: order.shippingAddress as Record<string, unknown>,
    });
    await this.prisma.$executeRaw`
      UPDATE "Shipment" SET
        "provider" = ${label.provider},
        "providerShipmentId" = ${label.providerShipmentId},
        "trackingNumber" = ${label.trackingNumber},
        "trackingUrl" = ${label.trackingUrl},
        "labelUrl" = ${label.labelUrl},
        "estimatedDeliveryAt" = ${label.estimatedDeliveryAt ?? null},
        "status" = 'LABEL_CREATED'::"ShipmentStatus",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}::uuid
    `;
    return this.shipment(id);
  }

  async dispatch(id: string, authorId?: string) {
    const shipment = await this.shipment(id);
    if (!['READY', 'LABEL_CREATED'].includes(shipment.status)) {
      throw new ConflictException('A expedição já foi processada.');
    }

    await this.prisma.$transaction(async (tx) => {
      const lines = await tx.$queryRaw<
        Array<{
          orderItemId: string;
          quantity: number;
          productId: string | null;
        }>
      >`
        SELECT si."orderItemId", si."quantity", oi."productId"
        FROM "ShipmentItem" si
        JOIN "OrderItem" oi ON oi."id" = si."orderItemId"
        WHERE si."shipmentId" = ${id}::uuid
      `;
      for (const line of lines) {
        if (!line.productId)
          throw new ConflictException('Produto removido do catálogo.');
        const reservation = await tx.stockReservation.findFirst({
          where: {
            orderId: shipment.orderId,
            productId: line.productId,
            status: StockReservationStatus.ACTIVE,
          },
        });
        if (!reservation || reservation.quantity < line.quantity) {
          throw new ConflictException(
            'Reserva de stock insuficiente para expedir.',
          );
        }
        const changed = await tx.stockItem.updateMany({
          where: {
            productId: line.productId,
            onHandQuantity: { gte: line.quantity },
            reservedQuantity: { gte: line.quantity },
          },
          data: {
            onHandQuantity: { decrement: line.quantity },
            reservedQuantity: { decrement: line.quantity },
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('Stock inconsistente.');
        if (reservation.quantity === line.quantity) {
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { status: StockReservationStatus.CONSUMED },
          });
        } else {
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { quantity: { decrement: line.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            orderId: shipment.orderId,
            type: StockMovementType.ORDER_FULFILLMENT,
            quantity: -line.quantity,
            referenceType: 'Shipment',
            referenceId: id,
            idempotencyKey: `shipment:${id}:fulfill:${line.orderItemId}`,
            authorId,
          },
        });
      }
      await tx.$executeRaw`
        UPDATE "Shipment" SET "status" = 'IN_TRANSIT'::"ShipmentStatus",
          "shippedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}::uuid
      `;

      const remaining = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "OrderItem" oi
        WHERE oi."orderId" = ${shipment.orderId}::uuid
          AND oi."quantity" > COALESCE((
            SELECT SUM(si."quantity") FROM "ShipmentItem" si
            JOIN "Shipment" s ON s."id" = si."shipmentId"
            WHERE si."orderItemId" = oi."id"
              AND s."status" IN ('IN_TRANSIT', 'DELIVERED')
          ), 0)
      `;
      if (Number(remaining[0]?.count ?? 0) === 0) {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: shipment.orderId },
        });
        if (order.status !== OrderStatus.SHIPPED) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.SHIPPED },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: OrderStatus.SHIPPED,
              authorId,
              note: 'Todos os artigos foram expedidos.',
            },
          });
        }
      }
    }, serializable);
    return this.shipment(id);
  }

  async addEvent(id: string, body: ShipmentEventDto) {
    await this.shipment(id);
    await this.prisma.$executeRaw`
      INSERT INTO "ShipmentEvent" (
        "id", "shipmentId", "providerEventId", "code", "description",
        "location", "occurredAt", "payload", "createdAt"
      ) VALUES (
        ${randomUUID()}::uuid, ${id}::uuid, ${body.providerEventId}, ${body.code},
        ${body.description}, ${body.location ?? null}, ${new Date(body.occurredAt)},
        ${body.payload ? JSON.stringify(body.payload) : null}::jsonb, CURRENT_TIMESTAMP
      ) ON CONFLICT ("shipmentId", "providerEventId") DO NOTHING
    `;
    return this.shipment(id);
  }

  async updateShipmentStatus(id: string, status: ShipmentStatusDtoValue) {
    const shipment = await this.shipment(id);
    await this.prisma.$executeRaw`
      UPDATE "Shipment" SET "status" = ${status}::"ShipmentStatus",
        "deliveredAt" = CASE WHEN ${status} = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE "deliveredAt" END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}::uuid
    `;
    if (status === ShipmentStatusDtoValue.DELIVERED) {
      const active = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "Shipment"
        WHERE "orderId" = ${shipment.orderId}::uuid
          AND "status" NOT IN ('DELIVERED', 'CANCELLED')
      `;
      if (Number(active[0]?.count ?? 0) === 0) {
        const order = await this.prisma.order.findUniqueOrThrow({
          where: { id: shipment.orderId },
        });
        if (order.status === OrderStatus.SHIPPED) {
          await this.prisma.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.DELIVERED },
          });
          await this.prisma.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: OrderStatus.SHIPPED,
              toStatus: OrderStatus.DELIVERED,
              note: 'Entrega confirmada pela transportadora.',
            },
          });
        }
      }
    }
    return this.shipment(id);
  }

  async trackingForUser(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    return this.shipments(orderId);
  }

  async guestTracking(orderNumber: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: { number: orderNumber, email: email.trim().toLowerCase() },
      select: { id: true, number: true, status: true },
    });
    if (!order)
      throw new NotFoundException('Não foi possível localizar a encomenda.');
    return { order, shipments: await this.shipments(order.id) };
  }

  async createReturn(userId: string, body: CreateReturnDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: body.orderId, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    if (
      order.status !== OrderStatus.SHIPPED &&
      order.status !== OrderStatus.DELIVERED
    ) {
      throw new ConflictException('A encomenda ainda não admite devolução.');
    }
    if (!body.items.length)
      throw new BadRequestException('Selecione artigos para devolver.');
    const returnId = randomUUID();
    const returnNumber = number('RMA');
    await this.prisma.$transaction(async (tx) => {
      for (const line of body.items) {
        const item = order.items.find(
          (candidate) => candidate.id === line.orderItemId,
        );
        if (!item) throw new BadRequestException('Artigo inválido.');
        const previous = await tx.$queryRaw<Array<{ quantity: bigint }>>`
          SELECT COALESCE(SUM(ri."quantity"), 0)::bigint AS quantity
          FROM "ReturnItem" ri
          JOIN "ReturnRequest" rr ON rr."id" = ri."returnRequestId"
          WHERE ri."orderItemId" = ${line.orderItemId}::uuid
            AND rr."status" NOT IN ('REJECTED', 'CANCELLED')
        `;
        if (
          Number(previous[0]?.quantity ?? 0) + line.quantity >
          item.quantity
        ) {
          throw new ConflictException(
            'Quantidade de devolução superior à comprada.',
          );
        }
      }
      await tx.$executeRaw`
        INSERT INTO "ReturnRequest" (
          "id", "number", "orderId", "userId", "status", "resolution", "reason",
          "customerNotes", "requestedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${returnId}::uuid, ${returnNumber}, ${order.id}::uuid, ${userId}::uuid,
          'REQUESTED'::"ReturnRequestStatus", ${body.resolution}::"ReturnResolution",
          ${body.reason}, ${body.customerNotes ?? null}, CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
      for (const line of body.items) {
        await tx.$executeRaw`
          INSERT INTO "ReturnItem" (
            "id", "returnRequestId", "orderItemId", "quantity", "reason",
            "declaredCondition", "eligibleRefundCents", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}::uuid, ${returnId}::uuid, ${line.orderItemId}::uuid,
            ${line.quantity}, ${line.reason}, ${line.declaredCondition ?? null}, 0,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      }
      await tx.$executeRaw`
        INSERT INTO "ReturnEvent" ("id", "returnRequestId", "toStatus", "note", "createdAt")
        VALUES (${randomUUID()}::uuid, ${returnId}::uuid,
          'REQUESTED'::"ReturnRequestStatus", 'Pedido submetido pelo cliente.', CURRENT_TIMESTAMP)
      `;
    }, serializable);
    return this.returnRequest(returnId, userId);
  }

  async returns(userId?: string) {
    const rows = userId
      ? await this.prisma.$queryRaw<ReturnRow[]>`
          SELECT * FROM "ReturnRequest" WHERE "userId" = ${userId}::uuid
          ORDER BY "createdAt" DESC
        `
      : await this.prisma.$queryRaw<ReturnRow[]>`
          SELECT * FROM "ReturnRequest" ORDER BY "createdAt" DESC LIMIT 500
        `;
    return rows;
  }

  async returnRequest(id: string, userId?: string) {
    const rows = userId
      ? await this.prisma.$queryRaw<ReturnRow[]>`
          SELECT * FROM "ReturnRequest" WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid LIMIT 1
        `
      : await this.prisma.$queryRaw<ReturnRow[]>`
          SELECT * FROM "ReturnRequest" WHERE "id" = ${id}::uuid LIMIT 1
        `;
    const request = rows[0];
    if (!request) throw new NotFoundException('Devolução não encontrada.');
    const [items, events] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT ri.*, oi."productName", oi."sku", oi."unitPriceCents", oi."imageUrl"
        FROM "ReturnItem" ri JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
        WHERE ri."returnRequestId" = ${id}::uuid ORDER BY ri."createdAt" ASC
      `,
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "ReturnEvent" WHERE "returnRequestId" = ${id}::uuid
        ORDER BY "createdAt" ASC
      `,
    ]);
    return { ...request, items, events };
  }

  async decideReturn(id: string, body: ReturnDecisionDto, authorId: string) {
    const request = await this.returnRequest(id);
    if (!['REQUESTED', 'UNDER_REVIEW'].includes(request.status)) {
      throw new ConflictException('A devolução já foi decidida.');
    }
    const status = body.approved ? 'APPROVED' : 'REJECTED';
    await this.prisma.$transaction(async (tx) => {
      for (const item of body.items ?? []) {
        await tx.$executeRaw`
          UPDATE "ReturnItem" SET "disposition" = ${item.disposition}::"ReturnItemDisposition",
            "receivedCondition" = ${item.receivedCondition ?? null},
            "eligibleRefundCents" = ${item.eligibleRefundCents}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${item.returnItemId}::uuid AND "returnRequestId" = ${id}::uuid
        `;
      }
      await tx.$executeRaw`
        UPDATE "ReturnRequest" SET "status" = ${status}::"ReturnRequestStatus",
          "internalNotes" = ${body.internalNotes ?? null}, "decidedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO "ReturnEvent" (
          "id", "returnRequestId", "fromStatus", "toStatus", "authorId", "note", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${id}::uuid, ${request.status}::"ReturnRequestStatus",
          ${status}::"ReturnRequestStatus", ${authorId}::uuid,
          ${body.internalNotes ?? null}, CURRENT_TIMESTAMP
        )
      `;
    }, serializable);
    return this.returnRequest(id);
  }

  async updateReturnStatus(
    id: string,
    status: ReturnRequestStatusDtoValue,
    authorId: string,
    note?: string,
  ) {
    const request = await this.returnRequest(id);
    await this.prisma.$transaction(async (tx) => {
      if (status === ReturnRequestStatusDtoValue.RECEIVED) {
        await tx.$executeRaw`
          UPDATE "ReturnRequest" SET "receivedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}::uuid
        `;
      }
      if (
        status === ReturnRequestStatusDtoValue.CLOSED ||
        status === ReturnRequestStatusDtoValue.REFUNDED
      ) {
        await tx.$executeRaw`
          UPDATE "ReturnRequest" SET "closedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}::uuid
        `;
      }
      await tx.$executeRaw`
        UPDATE "ReturnRequest" SET "status" = ${status}::"ReturnRequestStatus",
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}::uuid
      `;
      await tx.$executeRaw`
        INSERT INTO "ReturnEvent" (
          "id", "returnRequestId", "fromStatus", "toStatus", "authorId", "note", "createdAt"
        ) VALUES (${randomUUID()}::uuid, ${id}::uuid,
          ${request.status}::"ReturnRequestStatus", ${status}::"ReturnRequestStatus",
          ${authorId}::uuid, ${note ?? null}, CURRENT_TIMESTAMP)
      `;

      if (status === ReturnRequestStatusDtoValue.INSPECTED) {
        const restock = await tx.$queryRaw<
          Array<{
            orderItemId: string;
            quantity: number;
            productId: string | null;
          }>
        >`
          SELECT ri."orderItemId", ri."quantity", oi."productId"
          FROM "ReturnItem" ri JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
          WHERE ri."returnRequestId" = ${id}::uuid
            AND ri."disposition" = 'RESTOCK'::"ReturnItemDisposition"
        `;
        for (const line of restock) {
          if (!line.productId) continue;
          await tx.stockItem.upsert({
            where: { productId: line.productId },
            create: {
              productId: line.productId,
              onHandQuantity: line.quantity,
            },
            update: { onHandQuantity: { increment: line.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              orderId: request.orderId,
              type: StockMovementType.CUSTOMER_RETURN,
              quantity: line.quantity,
              referenceType: 'ReturnRequest',
              referenceId: id,
              idempotencyKey: `return:${id}:restock:${line.orderItemId}`,
              authorId,
            },
          });
        }
      }
    }, serializable);
    return this.returnRequest(id);
  }

  async createSupportCase(userId: string, body: CreateSupportCaseDto) {
    if (body.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: body.orderId, userId },
      });
      if (!order)
        throw new ForbiddenException('Sem acesso à encomenda indicada.');
    }
    const id = randomUUID();
    const caseNumber = number('SUP');
    await this.prisma.$executeRaw`
      INSERT INTO "SupportCase" (
        "id", "number", "userId", "orderId", "shipmentId", "type", "priority",
        "status", "subject", "description", "createdAt", "updatedAt"
      ) VALUES (
        ${id}::uuid, ${caseNumber}, ${userId}::uuid, ${body.orderId ?? null}::uuid,
        ${body.shipmentId ?? null}::uuid, ${body.type}::"SupportCaseType",
        ${body.priority ?? 'NORMAL'}::"SupportCasePriority", 'OPEN'::"SupportCaseStatus",
        ${body.subject}, ${body.description}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
    return this.supportCase(id, userId);
  }

  async supportCases(userId?: string) {
    return userId
      ? this.prisma.$queryRaw<SupportCaseRow[]>`
          SELECT * FROM "SupportCase" WHERE "userId" = ${userId}::uuid ORDER BY "createdAt" DESC
        `
      : this.prisma.$queryRaw<SupportCaseRow[]>`
          SELECT * FROM "SupportCase" ORDER BY "createdAt" DESC LIMIT 500
        `;
  }

  async supportCase(id: string, userId?: string) {
    const rows = userId
      ? await this.prisma.$queryRaw<SupportCaseRow[]>`
          SELECT * FROM "SupportCase" WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid LIMIT 1
        `
      : await this.prisma.$queryRaw<SupportCaseRow[]>`
          SELECT * FROM "SupportCase" WHERE "id" = ${id}::uuid LIMIT 1
        `;
    const supportCase = rows[0];
    if (!supportCase)
      throw new NotFoundException('Caso de apoio não encontrado.');
    const comments = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`
      SELECT c.*, u."firstName", u."lastName"
      FROM "SupportCaseComment" c
      LEFT JOIN "User" u ON u."id" = c."authorId"
      WHERE c."supportCaseId" = ${id}::uuid
        AND (${userId ?? null}::uuid IS NULL OR c."isInternal" = false)
      ORDER BY c."createdAt" ASC
    `;
    return { ...supportCase, comments };
  }

  async updateSupportCase(id: string, body: SupportCaseStatusUpdateDto) {
    await this.supportCase(id);
    await this.prisma.$executeRaw`
      UPDATE "SupportCase" SET "status" = ${body.status}::"SupportCaseStatus",
        "resolution" = COALESCE(${body.resolution ?? null}, "resolution"),
        "assignedToId" = COALESCE(${body.assignedToId ?? null}::uuid, "assignedToId"),
        "resolvedAt" = CASE WHEN ${body.status} IN ('RESOLVED', 'CLOSED')
          THEN CURRENT_TIMESTAMP ELSE "resolvedAt" END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}::uuid
    `;
    return this.supportCase(id);
  }

  async addSupportComment(
    id: string,
    body: SupportCaseCommentDto,
    authorId: string,
  ) {
    await this.supportCase(id);
    await this.prisma.$executeRaw`
      INSERT INTO "SupportCaseComment" (
        "id", "supportCaseId", "authorId", "body", "isInternal", "createdAt"
      ) VALUES (${randomUUID()}::uuid, ${id}::uuid, ${authorId}::uuid,
        ${body.body}, ${body.isInternal ?? true}, CURRENT_TIMESTAMP)
    `;
    return this.supportCase(id);
  }
}
