import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { FiscalDocumentType, PaymentStatus } from '@prisma/client';
import { FiscalService } from './fiscal/fiscal.service';
import { PrismaService } from './prisma.service';

async function createOrder(prisma: PrismaService, suffix: string, paid: boolean) {
  const delivery = await prisma.deliveryMethod.upsert({
    where: { code: 'FISCAL-SMOKE' },
    create: {
      code: 'FISCAL-SMOKE',
      name: 'Entrega smoke fiscal',
      type: 'STANDARD',
      isActive: true,
      priceCents: 0,
    },
    update: {},
  });

  return prisma.order.create({
    data: {
      number: `FISCAL-${suffix}-${Date.now()}`,
      email: `fiscal-${suffix}@example.test`,
      customerName: `Cliente Fiscal ${suffix}`,
      phone: '910000000',
      status: 'PROCESSING',
      paymentStatus: paid ? PaymentStatus.PAID : PaymentStatus.PENDING,
      subtotalCents: 1000,
      shippingCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 1000,
      currency: 'EUR',
      billingAddress: {
        firstName: 'Cliente',
        lastName: suffix,
        line1: 'Rua de Teste 1',
        postalCode: '1000-001',
        city: 'Lisboa',
        countryCode: 'PT',
      },
      shippingAddress: {
        firstName: 'Cliente',
        lastName: suffix,
        line1: 'Rua de Teste 1',
        postalCode: '1000-001',
        city: 'Lisboa',
        countryCode: 'PT',
      },
      deliveryMethodId: delivery.id,
      idempotencyKey: `fiscal-smoke:${randomUUID()}`,
      items: {
        create: {
          productName: `Produto ${suffix}`,
          sku: `SKU-${suffix}`,
          unitPriceCents: 1000,
          quantity: 1,
          totalCents: 1000,
        },
      },
    },
  });
}

async function main() {
  const prisma = new PrismaService();
  const fiscal = new FiscalService(prisma);
  const orderIds: string[] = [];

  try {
    const pending = await createOrder(prisma, 'PENDING', false);
    orderIds.push(pending.id);

    await assert.rejects(
      () => fiscal.issueOrder(pending.id),
      (error: unknown) => error instanceof ConflictException,
    );

    await prisma.order.update({
      where: { id: pending.id },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    const first = await fiscal.issueOrder(
      pending.id,
      undefined,
      FiscalDocumentType.INVOICE_RECEIPT,
    );
    const duplicate = await fiscal.issueOrder(
      pending.id,
      undefined,
      FiscalDocumentType.INVOICE_RECEIPT,
    );

    assert.equal(first.id, duplicate.id);
    assert.equal(first.status, 'ISSUED');
    assert.equal(first.lines.length, 1);
    assert.ok(first.number);
    assert.ok(first.sequentialNumber);

    const secondOrder = await createOrder(prisma, 'SECOND', true);
    orderIds.push(secondOrder.id);
    const second = await fiscal.issueOrder(secondOrder.id);

    assert.equal(
      second.sequentialNumber,
      (first.sequentialNumber ?? 0) + 1,
    );
    assert.notEqual(second.number, first.number);

    const documentCount = await prisma.fiscalDocument.count({
      where: {
        sourceType: 'ORDER',
        sourceId: { in: orderIds },
        type: FiscalDocumentType.INVOICE_RECEIPT,
      },
    });
    assert.equal(documentCount, 2);

    console.log('Fiscal issuance smoke passed.');
  } finally {
    await prisma.fiscalDocument.deleteMany({
      where: { sourceType: 'ORDER', sourceId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.deliveryMethod.deleteMany({ where: { code: 'FISCAL-SMOKE' } });
    await prisma.$disconnect();
  }
}

void main();
