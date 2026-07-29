import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma.service';

interface ReservationNeed {
  productId: string;
  quantity: number;
  label: string;
}

interface BundleSelectionRow {
  orderItemId: string;
  componentProductId: string | null;
  componentName: string;
  quantity: number;
}

const serializable = { isolationLevel: 'Serializable' as const };

@Injectable()
export class BundleInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  reserveOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' },
      });
      if (existing.length) return existing;

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Encomenda não encontrada.');

      const bundleRows = await tx.$queryRaw<BundleSelectionRow[]>`
        SELECT s."orderItemId", s."componentProductId", s."componentName", s."quantity"
        FROM "OrderItemBundleSelection" s
        JOIN "OrderItem" oi ON oi."id" = s."orderItemId"
        WHERE oi."orderId" = ${orderId}::uuid
      `;
      const byOrderItem = new Map<string, BundleSelectionRow[]>();
      for (const row of bundleRows) {
        const rows = byOrderItem.get(row.orderItemId) ?? [];
        rows.push(row);
        byOrderItem.set(row.orderItemId, rows);
      }

      const needs = new Map<string, ReservationNeed>();
      for (const item of order.items) {
        const components = byOrderItem.get(item.id) ?? [];
        if (components.length) {
          for (const component of components) {
            if (!component.componentProductId)
              throw new ConflictException(`Componente removido de ${item.productName}.`);
            this.aggregate(
              needs,
              component.componentProductId,
              component.quantity * item.quantity,
              component.componentName,
            );
          }
        } else {
          if (!item.productId) throw new ConflictException('Produto removido.');
          this.aggregate(needs, item.productId, item.quantity, item.productName);
        }
      }

      const reservations = [];
      for (const need of needs.values()) {
        const changed = await tx.$executeRaw`
          UPDATE "StockItem"
          SET "reservedQuantity" = "reservedQuantity" + ${need.quantity},
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "productId" = ${need.productId}::uuid
            AND ("trackStock" = false OR "onHandQuantity" - "reservedQuantity" >= ${need.quantity})
        `;
        if (changed !== 1)
          throw new ConflictException(`Stock insuficiente para ${need.label}.`);

        const reservation = await tx.stockReservation.create({
          data: {
            productId: need.productId,
            orderId,
            quantity: need.quantity,
            idempotencyKey: `order:${orderId}:reserve:${need.productId}`,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: need.productId,
            orderId,
            type: StockMovementType.ORDER_RESERVATION,
            quantity: -need.quantity,
            referenceType: 'Order',
            referenceId: orderId,
            idempotencyKey: `order:${orderId}:movement:reserve:${need.productId}`,
            note: 'Reserva calculada sobre produto ou componentes reais do cabaz.',
          },
        });
        reservations.push(reservation);
      }
      return reservations;
    }, serializable);
  }

  private aggregate(
    needs: Map<string, ReservationNeed>,
    productId: string,
    quantity: number,
    label: string,
  ) {
    const current = needs.get(productId);
    needs.set(productId, {
      productId,
      quantity: (current?.quantity ?? 0) + quantity,
      label: current?.label ?? label,
    });
  }
}
