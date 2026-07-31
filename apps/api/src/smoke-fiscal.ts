import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { FiscalDocumentType, PaymentStatus } from '@prisma/client';
import { CreditNoteService } from './fiscal/credit-note.service';
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
      subtotalCents: 2000,
      shippingCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 2000,
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
          quantity: 2,
          totalCents: 2000,
        },
      },
    },
  });
}

async function main() {
  const prisma = new PrismaService();
  const fiscal = new FiscalService(prisma);
  const creditNotes = new CreditNoteService(prisma);
  const orderIds: string[] = [];
  const author = await prisma.user.create({
    data: {
      email: `fiscal-smoke-${randomUUID()}@example.test`,
      passwordHash: 'not-used-in-smoke',
      firstName: 'Fiscal',
      lastName: 'Smoke',
      role: 'ADMIN',
      isActive: true,
    },
  });

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
      author.id,
      FiscalDocumentType.INVOICE_RECEIPT,
    );
    const duplicate = await fiscal.issueOrder(
      pending.id,
      author.id,
      FiscalDocumentType.INVOICE_RECEIPT,
    );

    assert.equal(first.id, duplicate.id);
    assert.equal(first.status, 'ISSUED');
    assert.equal(first.lines.length, 1);
    assert.ok(first.number);
    assert.ok(first.sequentialNumber);

    const originalLine = first.lines[0];
    assert.ok(originalLine);
    const partialKey = `fiscal-credit-partial:${randomUUID()}`;
    const partial = await creditNotes.create(
      first.id,
      author.id,
      partialKey,
      'Crédito parcial de teste.',
      [{ lineId: originalLine.id, quantity: 1 }],
    );
    const partialDuplicate = await creditNotes.create(
      first.id,
      author.id,
      partialKey,
      'Crédito parcial de teste.',
      [{ lineId: originalLine.id, quantity: 1 }],
    );
    assert.equal(partial.id, partialDuplicate.id);
    assert.equal(partial.totalCents, 1000);

    const afterPartial = await prisma.fiscalDocument.findUniqueOrThrow({
      where: { id: first.id },
    });
    assert.equal(afterPartial.status, 'ISSUED');

    await assert.rejects(
      () =>
        creditNotes.create(
          first.id,
          author.id,
          `fiscal-credit-excess:${randomUUID()}`,
          'Tentativa excessiva.',
          [{ lineId: originalLine.id, quantity: 2 }],
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const remaining = await creditNotes.create(
      first.id,
      author.id,
      `fiscal-credit-remaining:${randomUUID()}`,
      'Crédito do saldo restante.',
    );
    assert.equal(remaining.totalCents, 1000);

    const fullyCredited = await prisma.fiscalDocument.findUniqueOrThrow({
      where: { id: first.id },
    });
    assert.equal(fullyCredited.status, 'CREDITED');

    const secondOrder = await createOrder(prisma, 'SECOND', true);
    orderIds.push(secondOrder.id);
    const second = await fiscal.issueOrder(secondOrder.id, author.id);

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

    const creditCount = await prisma.fiscalDocument.count({
      where: { parentDocumentId: first.id, type: FiscalDocumentType.CREDIT_NOTE },
    });
    assert.equal(creditCount, 2);

    console.log('Fiscal issuance and credit note smoke passed.');
  } finally {
    const originals = await prisma.fiscalDocument.findMany({
      where: { sourceType: 'ORDER', sourceId: { in: orderIds } },
      select: { id: true },
    });
    await prisma.fiscalDocument.deleteMany({
      where: { parentDocumentId: { in: originals.map((document) => document.id) } },
    });
    await prisma.fiscalDocument.deleteMany({
      where: { sourceType: 'ORDER', sourceId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.deliveryMethod.deleteMany({ where: { code: 'FISCAL-SMOKE' } });
    await prisma.user.delete({ where: { id: author.id } });
    await prisma.$disconnect();
  }
}

void main();
