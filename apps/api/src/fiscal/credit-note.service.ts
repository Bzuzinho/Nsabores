import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FiscalDocumentStatus,
  FiscalDocumentType,
  FiscalEventType,
  FiscalSourceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type CreditNoteLineInput = {
  lineId: string;
  quantity: number;
};

@Injectable()
export class CreditNoteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    originalDocumentId: string,
    authorId: string,
    idempotencyKey: string,
    reason: string,
    requestedLines?: CreditNoteLineInput[],
  ) {
    const key = idempotencyKey.trim();
    if (!key) throw new BadRequestException('A chave de idempotência é obrigatória.');
    if (!reason.trim()) throw new BadRequestException('O motivo da nota de crédito é obrigatório.');

    const existing = await this.prisma.fiscalDocument.findUnique({
      where: { idempotencyKey: key },
      include: { series: true, lines: { orderBy: { position: 'asc' } }, events: true },
    });
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.fiscalDocument.findUnique({
            where: { idempotencyKey: key },
            include: { series: true, lines: { orderBy: { position: 'asc' } }, events: true },
          });
          if (duplicate) return duplicate;

          const original = await tx.fiscalDocument.findUnique({
            where: { id: originalDocumentId },
            include: {
              lines: { orderBy: { position: 'asc' } },
              creditDocuments: { include: { lines: true } },
            },
          });
          if (!original) throw new NotFoundException('Documento original não encontrado.');
          if (original.type === FiscalDocumentType.CREDIT_NOTE) {
            throw new ConflictException('Não é possível creditar uma nota de crédito.');
          }
          if (![FiscalDocumentStatus.ISSUED, FiscalDocumentStatus.CREDITED].includes(original.status)) {
            throw new ConflictException('Apenas documentos emitidos podem ser creditados.');
          }

          const alreadyCredited = new Map<string, number>();
          for (const credit of original.creditDocuments) {
            if (credit.status === FiscalDocumentStatus.CANCELLED) continue;
            for (const line of credit.lines) {
              if (!line.sourceLineId) continue;
              alreadyCredited.set(
                line.sourceLineId,
                (alreadyCredited.get(line.sourceLineId) ?? 0) + line.quantity,
              );
            }
          }

          const requested = this.resolveLines(original.lines, alreadyCredited, requestedLines);
          if (!requested.length) {
            throw new ConflictException('O documento já se encontra totalmente creditado.');
          }

          const year = new Date().getUTCFullYear();
          const seriesCode = `CREDIT-${year}`;
          const series = await tx.fiscalSeries.upsert({
            where: {
              code_documentType_year: {
                code: seriesCode,
                documentType: FiscalDocumentType.CREDIT_NOTE,
                year,
              },
            },
            create: {
              code: seriesCode,
              documentType: FiscalDocumentType.CREDIT_NOTE,
              prefix: `NC ${year}/`,
              year,
              nextNumber: 1,
              isActive: true,
            },
            update: {},
          });
          const allocated = await tx.$queryRaw<Array<{ sequentialNumber: number; prefix: string }>>(
            Prisma.sql`
              UPDATE "FiscalSeries"
              SET "nextNumber" = "nextNumber" + 1,
                  "updatedAt" = CURRENT_TIMESTAMP
              WHERE "id" = ${series.id}::uuid AND "isActive" = true
              RETURNING "nextNumber" - 1 AS "sequentialNumber", "prefix"
            `,
          );
          const sequence = allocated[0];
          if (!sequence) throw new ConflictException('A série de notas de crédito não está ativa.');

          const totals = requested.reduce(
            (sum, item) => ({
              subtotalCents: sum.subtotalCents + item.subtotalCents,
              discountCents: sum.discountCents + item.discountCents,
              taxCents: sum.taxCents + item.taxCents,
              totalCents: sum.totalCents + item.totalCents,
            }),
            { subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 },
          );
          const documentId = randomUUID();
          const number = `${sequence.prefix}${String(sequence.sequentialNumber).padStart(6, '0')}`;

          await tx.fiscalDocument.create({
            data: {
              id: documentId,
              seriesId: series.id,
              type: FiscalDocumentType.CREDIT_NOTE,
              status: FiscalDocumentStatus.ISSUED,
              sourceType: FiscalSourceType.MANUAL,
              sourceId: null,
              idempotencyKey: key,
              customerUserId: original.customerUserId,
              parentDocumentId: original.id,
              sequentialNumber: sequence.sequentialNumber,
              number,
              currency: original.currency,
              subtotalCents: totals.subtotalCents,
              discountCents: totals.discountCents,
              taxCents: totals.taxCents,
              totalCents: totals.totalCents,
              customerSnapshot: original.customerSnapshot,
              billingSnapshot: original.billingSnapshot,
              metadata: {
                reason: reason.trim(),
                originalDocumentNumber: original.number,
                creditKind: requestedLines?.length ? 'PARTIAL' : 'REMAINING_TOTAL',
              },
              provider: 'manual',
              issuedAt: new Date(),
              createdById: authorId,
              lines: {
                create: requested.map((item, index) => ({
                  position: index + 1,
                  description: item.description,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPriceCents: item.unitPriceCents,
                  discountCents: item.discountCents,
                  taxRateBasisPoints: item.taxRateBasisPoints,
                  taxCents: item.taxCents,
                  totalCents: item.totalCents,
                  sourceLineId: item.id,
                  snapshot: { originalQuantity: item.originalQuantity },
                })),
              },
              events: {
                create: [
                  {
                    type: FiscalEventType.CREATED,
                    authorId,
                    note: `Nota de crédito criada para ${original.number ?? original.id}.`,
                  },
                  {
                    type: FiscalEventType.ISSUED,
                    authorId,
                    note: `Nota de crédito emitida com o número ${number}.`,
                  },
                ],
              },
            },
          });

          const creditedAfter = new Map(alreadyCredited);
          for (const item of requested) {
            creditedAfter.set(item.id, (creditedAfter.get(item.id) ?? 0) + item.quantity);
          }
          const fullyCredited = original.lines.every(
            (line) => (creditedAfter.get(line.id) ?? 0) >= line.quantity,
          );
          await tx.fiscalDocument.update({
            where: { id: original.id },
            data: {
              status: fullyCredited ? FiscalDocumentStatus.CREDITED : original.status,
              events: {
                create: {
                  type: FiscalEventType.CREDITED,
                  authorId,
                  note: `${fullyCredited ? 'Crédito total' : 'Crédito parcial'} através de ${number}.`,
                  payload: { creditDocumentId: documentId, amountCents: totals.totalCents },
                },
              },
            },
          });

          return tx.fiscalDocument.findUniqueOrThrow({
            where: { id: documentId },
            include: { series: true, lines: { orderBy: { position: 'asc' } }, events: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.prisma.fiscalDocument.findUnique({
          where: { idempotencyKey: key },
          include: { series: true, lines: { orderBy: { position: 'asc' } }, events: true },
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  private resolveLines(
    lines: Array<{
      id: string;
      description: string;
      sku: string | null;
      quantity: number;
      unitPriceCents: number;
      discountCents: number;
      taxRateBasisPoints: number;
      taxCents: number;
      totalCents: number;
    }>,
    alreadyCredited: Map<string, number>,
    requestedLines?: CreditNoteLineInput[],
  ) {
    const requestedMap = requestedLines?.length
      ? new Map(requestedLines.map((line) => [line.lineId, line.quantity]))
      : null;
    if (requestedMap) {
      for (const [lineId, quantity] of requestedMap) {
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException(`Quantidade inválida para a linha ${lineId}.`);
        }
      }
    }

    return lines.flatMap((line) => {
      const remaining = line.quantity - (alreadyCredited.get(line.id) ?? 0);
      const quantity = requestedMap ? requestedMap.get(line.id) ?? 0 : remaining;
      if (quantity === 0) return [];
      if (remaining <= 0 || quantity > remaining) {
        throw new ConflictException(`A quantidade pedida excede o saldo creditável da linha ${line.id}.`);
      }
      const ratio = quantity / line.quantity;
      return [{
        ...line,
        originalQuantity: line.quantity,
        quantity,
        subtotalCents: Math.round(line.unitPriceCents * quantity),
        discountCents: Math.round(line.discountCents * ratio),
        taxCents: Math.round(line.taxCents * ratio),
        totalCents: Math.round(line.totalCents * ratio),
      }];
    });
  }

  private isUniqueViolation(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    return text.includes('P2002') || text.includes('23505');
  }
}
