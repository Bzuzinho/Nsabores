import { Injectable, NotFoundException } from '@nestjs/common';
import { FiscalDocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AccountFiscalService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.fiscalDocument.findMany({
      where: {
        customerUserId: userId,
        status: {
          in: [
            FiscalDocumentStatus.ISSUED,
            FiscalDocumentStatus.CREDITED,
            FiscalDocumentStatus.CANCELLED,
          ],
        },
      },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        number: true,
        currency: true,
        subtotalCents: true,
        discountCents: true,
        taxCents: true,
        totalCents: true,
        issuedAt: true,
        sourceType: true,
        externalDocumentUrl: true,
      },
    });
  }

  async detail(userId: string, id: string) {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: {
        id,
        customerUserId: userId,
        status: {
          in: [
            FiscalDocumentStatus.ISSUED,
            FiscalDocumentStatus.CREDITED,
            FiscalDocumentStatus.CANCELLED,
          ],
        },
      },
      select: {
        id: true,
        type: true,
        status: true,
        number: true,
        currency: true,
        subtotalCents: true,
        discountCents: true,
        taxCents: true,
        totalCents: true,
        customerSnapshot: true,
        billingSnapshot: true,
        issuedAt: true,
        sourceType: true,
        externalDocumentUrl: true,
        lines: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            description: true,
            sku: true,
            quantity: true,
            unitPriceCents: true,
            discountCents: true,
            taxCents: true,
            totalCents: true,
          },
        },
      },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');
    return document;
  }
}
