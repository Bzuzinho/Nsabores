import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FiscalProviderService } from './fiscal/fiscal-provider.service';
import { PrismaService } from './prisma.service';

async function main() {
  const prisma = new PrismaService();
  const provider = new FiscalProviderService(prisma);
  const documentIds: string[] = [];
  const year = new Date().getUTCFullYear();
  const author = await prisma.user.create({
    data: {
      email: `fiscal-provider-smoke-${randomUUID()}@example.test`,
      passwordHash: 'smoke-not-used',
      firstName: 'Fiscal',
      lastName: 'Provider Smoke',
      role: 'ADMIN',
    },
  });

  try {
    const series = await prisma.fiscalSeries.upsert({
      where: {
        code_documentType_year: {
          code: `PROVIDER-SMOKE-${year}`,
          documentType: 'INVOICE_RECEIPT',
          year,
        },
      },
      create: {
        code: `PROVIDER-SMOKE-${year}`,
        documentType: 'INVOICE_RECEIPT',
        prefix: `SMOKE ${year}/`,
        year,
      },
      update: {},
    });

    const manualDocument = await prisma.fiscalDocument.create({
      data: {
        seriesId: series.id,
        type: 'INVOICE_RECEIPT',
        status: 'ISSUED',
        sourceType: 'MANUAL',
        currency: 'EUR',
        subtotalCents: 1000,
        totalCents: 1000,
        customerSnapshot: {},
        billingSnapshot: {},
        provider: 'manual',
      },
    });
    documentIds.push(manualDocument.id);

    const registered = await provider.registerManual(
      manualDocument.id,
      author.id,
      {
        externalNumber: 'EXT-2026-001',
        externalDocumentUrl: 'https://example.test/documents/EXT-2026-001',
        providerReference: 'manual-smoke',
      },
    );
    assert.equal(registered.status, 'ISSUED');
    assert.equal(registered.externalNumber, 'EXT-2026-001');
    assert.equal(registered.provider, 'manual');

    const mockDocument = await prisma.fiscalDocument.create({
      data: {
        seriesId: series.id,
        type: 'INVOICE_RECEIPT',
        status: 'ISSUED',
        sourceType: 'MANUAL',
        currency: 'EUR',
        subtotalCents: 2000,
        totalCents: 2000,
        customerSnapshot: {},
        billingSnapshot: {},
        provider: 'manual',
      },
    });
    documentIds.push(mockDocument.id);

    process.env.FISCAL_PROVIDER = 'mock';
    const failed = await provider.processMock(mockDocument.id, author.id, true);
    assert.equal(failed.status, 'FAILED');
    assert.ok(failed.providerError);

    const reprocessed = await provider.processMock(
      mockDocument.id,
      author.id,
      false,
    );
    assert.equal(reprocessed.status, 'ISSUED');
    assert.equal(reprocessed.provider, 'mock');
    assert.equal(reprocessed.providerError, null);
    assert.ok(reprocessed.providerReference);
    assert.ok(
      reprocessed.events.some((event) => event.type === 'PROVIDER_FAILED'),
    );
    assert.ok(reprocessed.events.some((event) => event.type === 'REPROCESSED'));

    console.log('Fiscal provider smoke passed.');
  } finally {
    await prisma.fiscalDocument.deleteMany({
      where: { id: { in: documentIds } },
    });
    await prisma.fiscalSeries.deleteMany({
      where: { code: `PROVIDER-SMOKE-${year}` },
    });
    await prisma.user.delete({ where: { id: author.id } });
    await prisma.$disconnect();
  }
}

void main();
