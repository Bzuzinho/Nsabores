import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FiscalDocumentStatus, FiscalEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type FiscalProviderMode = 'manual' | 'mock';

@Injectable()
export class FiscalProviderService {
  constructor(private readonly prisma: PrismaService) {}

  mode(): FiscalProviderMode {
    return process.env.FISCAL_PROVIDER === 'mock' ? 'mock' : 'manual';
  }

  async registerManual(
    documentId: string,
    authorId: string,
    input: {
      externalNumber: string;
      externalDocumentUrl?: string;
      providerReference?: string;
    },
  ) {
    const externalNumber = input.externalNumber?.trim();
    if (!externalNumber) {
      throw new BadRequestException('O número externo é obrigatório.');
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.fiscalDocument.findUnique({
        where: { id: documentId },
      });
      if (!document) throw new NotFoundException('Documento não encontrado.');
      if (document.status === FiscalDocumentStatus.CANCELLED) {
        throw new ConflictException(
          'Um documento cancelado não pode ser processado.',
        );
      }

      const wasFailed = document.status === FiscalDocumentStatus.FAILED;
      await tx.fiscalDocument.update({
        where: { id: documentId },
        data: {
          status: FiscalDocumentStatus.ISSUED,
          provider: 'manual',
          externalNumber,
          externalDocumentUrl: input.externalDocumentUrl?.trim() || null,
          providerReference: input.providerReference?.trim() || null,
          providerError: null,
          issuedAt: document.issuedAt ?? new Date(),
        },
      });
      await tx.fiscalDocumentEvent.create({
        data: {
          documentId,
          type: wasFailed
            ? FiscalEventType.REPROCESSED
            : FiscalEventType.ISSUED,
          authorId,
          note: wasFailed
            ? `Documento reprocessado manualmente como ${externalNumber}.`
            : `Documento externo registado manualmente como ${externalNumber}.`,
          payload: {
            provider: 'manual',
            externalNumber,
            externalDocumentUrl: input.externalDocumentUrl?.trim() || null,
          },
        },
      });
      return tx.fiscalDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: {
          series: true,
          lines: { orderBy: { position: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }

  async processMock(
    documentId: string,
    authorId: string,
    simulateFailure = false,
  ) {
    if (this.mode() !== 'mock') {
      throw new ConflictException(
        'O processamento mock só está disponível com FISCAL_PROVIDER=mock.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.fiscalDocument.findUnique({
        where: { id: documentId },
      });
      if (!document) throw new NotFoundException('Documento não encontrado.');
      if (document.status === FiscalDocumentStatus.CANCELLED) {
        throw new ConflictException(
          'Um documento cancelado não pode ser processado.',
        );
      }

      if (simulateFailure) {
        const errorMessage =
          'Falha mock solicitada para validação do provider.';
        await tx.fiscalDocument.update({
          where: { id: documentId },
          data: {
            status: FiscalDocumentStatus.FAILED,
            provider: 'mock',
            providerError: errorMessage,
          },
        });
        await tx.fiscalDocumentEvent.create({
          data: {
            documentId,
            type: FiscalEventType.PROVIDER_FAILED,
            authorId,
            note: errorMessage,
            payload: { provider: 'mock', simulated: true },
          },
        });
      } else {
        const providerReference = `mock-fiscal-${randomUUID()}`;
        const wasFailed = document.status === FiscalDocumentStatus.FAILED;
        await tx.fiscalDocument.update({
          where: { id: documentId },
          data: {
            status: FiscalDocumentStatus.ISSUED,
            provider: 'mock',
            providerReference,
            externalNumber: document.externalNumber ?? document.number,
            providerError: null,
            issuedAt: document.issuedAt ?? new Date(),
          },
        });
        await tx.fiscalDocumentEvent.create({
          data: {
            documentId,
            type: wasFailed
              ? FiscalEventType.REPROCESSED
              : FiscalEventType.ISSUED,
            authorId,
            note: wasFailed
              ? 'Documento reprocessado com sucesso pelo provider mock.'
              : 'Documento processado com sucesso pelo provider mock.',
            payload: {
              provider: 'mock',
              providerReference,
            },
          },
        });
      }

      return tx.fiscalDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: {
          series: true,
          lines: { orderBy: { position: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }
}
