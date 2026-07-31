import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FiscalReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async report() {
    const paymentsWithoutDocument = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`
      SELECT 'ORDER' AS "sourceType", o."id" AS "sourceId", o."number" AS "reference",
             o."customerName" AS "customer", o."email", o."totalCents" AS "amountCents",
             o."currency", o."createdAt"
      FROM "Order" o
      WHERE o."paymentStatus" = 'PAID'
        AND NOT EXISTS (
          SELECT 1 FROM "FiscalDocument" fd
          WHERE fd."sourceType" = 'ORDER'
            AND fd."sourceId" = o."id"
            AND fd."type" IN ('INVOICE','INVOICE_RECEIPT','RECEIPT')
        )
      UNION ALL
      SELECT 'GIFT_CARD_PURCHASE', gcp."id", gcp."id"::text,
             gcp."purchaserEmail", gcp."purchaserEmail", gcp."amountCents",
             gcp."currency", gcp."createdAt"
      FROM "GiftCardPurchase" gcp
      WHERE gcp."status" = 'PAID'
        AND NOT EXISTS (
          SELECT 1 FROM "FiscalDocument" fd
          WHERE fd."sourceType" = 'GIFT_CARD_PURCHASE'
            AND fd."sourceId" = gcp."id"
            AND fd."type" IN ('INVOICE','INVOICE_RECEIPT','RECEIPT')
        )
      UNION ALL
      SELECT 'CLUB_CHARGE', csc."id", csc."id"::text,
             CONCAT(u."firstName", ' ', u."lastName"), u."email", csc."amountCents",
             csc."currency", csc."createdAt"
      FROM "ClubSubscriptionCharge" csc
      JOIN "ClubSubscription" cs ON cs."id" = csc."subscriptionId"
      JOIN "User" u ON u."id" = cs."userId"
      WHERE csc."status" = 'PAID'
        AND NOT EXISTS (
          SELECT 1 FROM "FiscalDocument" fd
          WHERE fd."sourceType" = 'CLUB_CHARGE'
            AND fd."sourceId" = csc."id"
            AND fd."type" IN ('INVOICE','INVOICE_RECEIPT','RECEIPT')
        )
      ORDER BY "createdAt" DESC
    `;

    const documentsWithoutFinancialMatch = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`
      SELECT fd."id", fd."number", fd."type", fd."status", fd."sourceType",
             fd."sourceId", fd."totalCents", fd."currency", fd."issuedAt",
             CASE
               WHEN fd."sourceType" = 'ORDER' AND NOT EXISTS (
                 SELECT 1 FROM "Order" o WHERE o."id" = fd."sourceId" AND o."paymentStatus" = 'PAID'
               ) THEN 'ORDER_NOT_PAID_OR_MISSING'
               WHEN fd."sourceType" = 'GIFT_CARD_PURCHASE' AND NOT EXISTS (
                 SELECT 1 FROM "GiftCardPurchase" gcp WHERE gcp."id" = fd."sourceId" AND gcp."status" = 'PAID'
               ) THEN 'GIFT_CARD_NOT_PAID_OR_MISSING'
               WHEN fd."sourceType" = 'CLUB_CHARGE' AND NOT EXISTS (
                 SELECT 1 FROM "ClubSubscriptionCharge" csc WHERE csc."id" = fd."sourceId" AND csc."status" = 'PAID'
               ) THEN 'CLUB_CHARGE_NOT_PAID_OR_MISSING'
               WHEN fd."sourceType" = 'MANUAL' THEN 'MANUAL_WITHOUT_FINANCIAL_SOURCE'
               ELSE 'UNKNOWN_SOURCE'
             END AS "reason"
      FROM "FiscalDocument" fd
      WHERE fd."type" <> 'CREDIT_NOTE'
        AND (
          fd."sourceType" = 'MANUAL'
          OR (fd."sourceType" = 'ORDER' AND NOT EXISTS (
            SELECT 1 FROM "Order" o WHERE o."id" = fd."sourceId" AND o."paymentStatus" = 'PAID'
          ))
          OR (fd."sourceType" = 'GIFT_CARD_PURCHASE' AND NOT EXISTS (
            SELECT 1 FROM "GiftCardPurchase" gcp WHERE gcp."id" = fd."sourceId" AND gcp."status" = 'PAID'
          ))
          OR (fd."sourceType" = 'CLUB_CHARGE' AND NOT EXISTS (
            SELECT 1 FROM "ClubSubscriptionCharge" csc WHERE csc."id" = fd."sourceId" AND csc."status" = 'PAID'
          ))
        )
      ORDER BY fd."createdAt" DESC
    `;

    return {
      metrics: {
        paymentsWithoutDocument: paymentsWithoutDocument.length,
        documentsWithoutFinancialMatch: documentsWithoutFinancialMatch.length,
      },
      paymentsWithoutDocument,
      documentsWithoutFinancialMatch,
    };
  }

  async documentsCsv() {
    const documents = await this.prisma.fiscalDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: { series: true },
    });
    return this.toCsv(
      [
        'number',
        'type',
        'status',
        'sourceType',
        'sourceId',
        'customerUserId',
        'currency',
        'subtotalCents',
        'discountCents',
        'taxCents',
        'totalCents',
        'provider',
        'externalNumber',
        'issuedAt',
      ],
      documents.map((document) => [
        document.number,
        document.type,
        document.status,
        document.sourceType,
        document.sourceId,
        document.customerUserId,
        document.currency,
        document.subtotalCents,
        document.discountCents,
        document.taxCents,
        document.totalCents,
        document.provider,
        document.externalNumber,
        document.issuedAt?.toISOString(),
      ]),
    );
  }

  async reconciliationCsv() {
    const report = await this.report();
    const rows = [
      ...report.paymentsWithoutDocument.map((row) => [
        'PAYMENT_WITHOUT_DOCUMENT',
        row.sourceId,
        row.sourceType,
        row.sourceId,
        row.reference,
        row.customer,
        row.email,
        row.amountCents,
        row.currency,
        row.createdAt,
        '',
      ]),
      ...report.documentsWithoutFinancialMatch.map((row) => [
        'DOCUMENT_WITHOUT_FINANCIAL_MATCH',
        row.id,
        row.sourceType,
        row.sourceId,
        row.number,
        '',
        '',
        row.totalCents,
        row.currency,
        row.issuedAt,
        row.reason,
      ]),
    ];
    return this.toCsv(
      [
        'kind',
        'recordId',
        'sourceType',
        'sourceId',
        'reference',
        'customer',
        'email',
        'amountCents',
        'currency',
        'date',
        'reason',
      ],
      rows,
    );
  }

  private toCsv(headers: string[], rows: unknown[][]) {
    const escape = (value: unknown) => {
      const text =
        value == null
          ? ''
          : value instanceof Date
            ? value.toISOString()
            : String(value);
      return `"${text.replaceAll('"', '""')}"`;
    };
    return [
      headers.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ].join('\n');
  }
}
