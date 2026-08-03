import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, ProductionWorkStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { CompleteProductionDto, UpdateProductionDto } from './dto';

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    await this.prisma.$executeRaw`
      INSERT INTO "ProductionWorkOrder" ("id", "orderId", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${orderId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("orderId") DO NOTHING
    `;
    return this.detail(orderId);
  }

  async list() {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: [OrderStatus.PROCESSING, OrderStatus.READY] } },
      select: { id: true },
    });
    for (const order of orders) await this.ensure(order.id);
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pwo.*, o."number", o."customerName", o."email", o."paymentStatus", o."status" AS "orderStatus",
        o."createdAt", COUNT(oi."id")::int AS "itemCount", COALESCE(SUM(oi."quantity"),0)::int AS "unitCount"
      FROM "ProductionWorkOrder" pwo
      JOIN "Order" o ON o."id" = pwo."orderId"
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
      WHERE pwo."status" NOT IN ('COMPLETED','CANCELLED')
      GROUP BY pwo."id", o."id"
      ORDER BY CASE pwo."priority" WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,
        pwo."targetDate" NULLS LAST, pwo."createdAt"
    `;
  }

  async detail(orderId: string) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pwo.*, o."number", o."customerName", o."email", o."phone", o."paymentStatus",
        o."status" AS "orderStatus", o."customerNotes", o."shippingAddress", o."createdAt"
      FROM "ProductionWorkOrder" pwo JOIN "Order" o ON o."id" = pwo."orderId"
      WHERE pwo."orderId" = ${orderId}::uuid LIMIT 1
    `;
    const work = rows[0];
    if (!work) throw new NotFoundException('Ficha de produção não encontrada.');
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return { ...work, items };
  }

  async update(orderId: string, body: UpdateProductionDto) {
    await this.ensure(orderId);
    const status = body.status ?? null;
    await this.prisma.$executeRaw`
      UPDATE "ProductionWorkOrder" SET
        "priority" = COALESCE(${body.priority ?? null}::"ProductionPriority", "priority"),
        "status" = COALESCE(${status}::"ProductionWorkStatus", "status"),
        "targetDate" = COALESCE(${body.targetDate ? new Date(body.targetDate) : null}, "targetDate"),
        "responsibleUserId" = COALESCE(${body.responsibleUserId ?? null}::uuid, "responsibleUserId"),
        "productionNotes" = COALESCE(${body.productionNotes?.trim() ?? null}, "productionNotes"),
        "startedAt" = CASE WHEN ${status} = 'IN_PROGRESS' AND "startedAt" IS NULL THEN CURRENT_TIMESTAMP ELSE "startedAt" END,
        "readyAt" = CASE WHEN ${status} = 'READY' AND "readyAt" IS NULL THEN CURRENT_TIMESTAMP ELSE "readyAt" END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "orderId" = ${orderId}::uuid
    `;
    if (status === ProductionWorkStatus.READY) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.READY },
      });
    }
    return this.detail(orderId);
  }

  async complete(orderId: string, body: CompleteProductionDto) {
    await this.ensure(orderId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "ProductionWorkOrder" SET "status" = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP,
          "productionNotes" = COALESCE(${body.note?.trim() ?? null}, "productionNotes"), "updatedAt" = CURRENT_TIMESTAMP
        WHERE "orderId" = ${orderId}::uuid
      `;
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.READY },
      });
    });
    return this.detail(orderId);
  }
}
