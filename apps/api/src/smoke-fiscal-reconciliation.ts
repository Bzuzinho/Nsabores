import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FiscalReconciliationService } from './fiscal/fiscal-reconciliation.service';
import { FiscalService } from './fiscal/fiscal.service';
import { PrismaService } from './prisma.service';

async function main() {
  const prisma = new PrismaService();
  const reconciliation = new FiscalReconciliationService(prisma);
  const fiscal = new FiscalService(prisma);
  const orderIds: string[] = [];
  const documentIds: string[] = [];
  const year = new Date().getUTCFullYear();

  try {
    const delivery = await prisma.deliveryMethod.upsert({
      where: { code: 'FISCAL-RECON-SMOKE' },
      create: {
        code: 'FISCAL-RECON-SMOKE',
        name: 'Entrega smoke reconciliação fiscal',
        type: 'STANDARD',
        priceCents: 0,
      },
      update: {},
    });

    const order = await prisma.order.create({
      data: {
        number: `FISCAL-RECON-${Date.now()}`,
        email: 'fiscal-recon@example.test',
        customerName: 'Cliente Reconciliação Fiscal',
        phone: '910000000',
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        subtotalCents: 1500,
        shippingCents: 0,
        discountCents: 0,
        taxCents: 0,
        totalCents: 1500,
        currency: 'EUR',
        billingAddress: {},
        shippingAddress: {},
        deliveryMethodId: delivery.id,
        idempotencyKey: `fiscal-recon:${randomUUID()}`,
        items: {
          create: {
            productName: 'Produto Reconciliação',
            sku: 'SKU-RECON',
            unitPriceCents: 1500,
            quantity: 1,
            totalCents: 1500,
          },
        },
      },
    });
    orderIds.push(order.id);

    const series = await prisma.fiscalSeries.upsert({
      where: {
        code_documentType_year: {
          code: `RECON-SMOKE-${year}`,
          documentType: 'INVOICE_RECEIPT',
          year,
        },
      },
      create: {
        code: `RECON-SMOKE-${year}`,
        documentType: 'INVOICE_RECEIPT',
        prefix: `RS ${year}/`,
        year,
      },
      update: {},
    });

    const manual = await prisma.fiscalDocument.create({
      data: {
        seriesId: series.id,
        type: 'INVOICE_RECEIPT',
        status: 'ISSUED',
        sourceType: 'MANUAL',
        currency: 'EUR',
        subtotalCents: 500,
        totalCents: 500,
        customerSnapshot: {},
        billingSnapshot: {},
      },
    });
    documentIds.push(manual.id);

    const before = await reconciliation.report();
    assert.ok(
      before.paymentsWithoutDocument.some((item) => item.sourceId === order.id),
    );
    assert.ok(
      before.documentsWithoutFinancialMatch.some(
        (item) => item.id === manual.id,
      ),
    );

    const issued = await fiscal.issueOrder(order.id);
    documentIds.push(issued.id);

    const after = await reconciliation.report();
    assert.ok(
      !after.paymentsWithoutDocument.some((item) => item.sourceId === order.id),
    );

    const csv = await reconciliation.reconciliationCsv();
    assert.ok(csv.includes('DOCUMENT_WITHOUT_FINANCIAL_MATCH'));
    assert.ok(csv.includes(manual.id));

    console.log('Fiscal reconciliation smoke passed.');
  } finally {
    await prisma.fiscalDocument.deleteMany({
      where: { id: { in: documentIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.fiscalSeries.deleteMany({
      where: { code: `RECON-SMOKE-${year}` },
    });
    await prisma.deliveryMethod.deleteMany({
      where: { code: 'FISCAL-RECON-SMOKE' },
    });
    await prisma.$disconnect();
  }
}

void main();
