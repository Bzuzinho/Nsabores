import assert from 'node:assert/strict';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../src/auth/auth.decorators';
import { AdminClubController } from '../src/club/club.controller';
import { PrismaService } from '../src/prisma.service';
import { ReceivablesController } from '../src/receivables/receivables.controller';
import { ReceivablesService } from '../src/receivables/receivables.service';

async function createOrder(prisma: PrismaService, suffix: string) {
  const deliveryId = randomUUID();
  const orderId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "DeliveryMethod" (
      "id", "code", "name", "type", "isActive", "priceCents", "createdAt", "updatedAt"
    ) VALUES (
      ${deliveryId}::uuid, ${`SPRINT10-${suffix}`}, 'Entrega Sprint 10',
      'STANDARD'::"DeliveryMethodType", true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    INSERT INTO "Order" (
      "id", "number", "email", "customerName", "phone", "status", "paymentStatus",
      "subtotalCents", "shippingCents", "discountCents", "taxCents", "totalCents",
      "currency", "billingAddress", "shippingAddress", "source", "deliveryMethodId",
      "idempotencyKey", "createdAt", "updatedAt"
    ) VALUES (
      ${orderId}::uuid, ${`S10-${suffix}`}, ${`s10-${suffix}@example.invalid`},
      'Cliente Sprint 10', '+351910000000', 'PROCESSING'::"OrderStatus",
      'PENDING'::"PaymentStatus", 2500, 0, 0, 0, 2500, 'EUR', '{}'::jsonb,
      '{}'::jsonb, 'SMOKE', ${deliveryId}::uuid, ${`s10:${suffix}`},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  return orderId;
}

async function main() {
  const prisma = new PrismaService();
  const service = new ReceivablesService(prisma);
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  try {
    const overdueOrderId = await createOrder(prisma, `${suffix}-OVERDUE`);
    await service.ensureAgreement(overdueOrderId);
    await prisma.$executeRaw`
      UPDATE "PaymentAgreement"
      SET "status" = 'AWAITING_PAYMENT', "dueAt" = CURRENT_TIMESTAMP - INTERVAL '1 day'
      WHERE "orderId" = ${overdueOrderId}::uuid
    `;
    const overdue = await service.detail(overdueOrderId);
    assert.equal(overdue.status, 'OVERDUE');

    const cancelledOrderId = await createOrder(prisma, `${suffix}-CANCEL`);
    await service.ensureAgreement(cancelledOrderId);
    await prisma.$executeRaw`
      UPDATE "PaymentAgreement"
      SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "orderId" = ${cancelledOrderId}::uuid
    `;
    const cancelled = await service.detail(cancelledOrderId);
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.paidAt, null);

    const paidOrderId = await createOrder(prisma, `${suffix}-PAID`);
    await service.markPaid(paidOrderId, undefined, 'transferencia', `S10-${suffix}`);
    await service.markPaid(paidOrderId, undefined, 'transferencia', `S10-${suffix}`);
    const paid = await service.detail(paidOrderId);
    assert.equal(paid.status, 'PAID');
    const paymentEvents = (paid.events as Array<{ type: string }>).filter(
      ({ type }) => type === 'PAYMENT_CONFIRMED',
    );
    assert.equal(paymentEvents.length, 1);

    const receivableRoles = Reflect.getMetadata(ROLES_KEY, ReceivablesController) as UserRole[];
    const clubRoles = Reflect.getMetadata(ROLES_KEY, AdminClubController) as UserRole[];
    assert.deepEqual(receivableRoles, [UserRole.STAFF, UserRole.ADMIN]);
    assert.deepEqual(clubRoles, [UserRole.STAFF, UserRole.ADMIN]);

    console.log('Sprint 10 acceptance smoke passed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
