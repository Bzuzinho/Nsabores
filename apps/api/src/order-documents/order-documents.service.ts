import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { UploadOrderDocumentDto } from './order-documents.dto';

export type UploadedOrderDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const publicDocumentSelect = {
  id: true,
  orderId: true,
  type: true,
  label: true,
  reference: true,
  documentDate: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class OrderDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      select: { id: true, number: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!orders.length) return [];

    const documents = await this.prisma.orderDocument.findMany({
      where: { orderId: { in: orders.map((order) => order.id) } },
      select: publicDocumentSelect,
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
    });
    const orderById = new Map(orders.map((order) => [order.id, order]));

    return documents.map((document) => ({
      ...document,
      order: orderById.get(document.orderId),
    }));
  }

  async detailForUser(userId: string, id: string) {
    const document = await this.prisma.orderDocument.findUnique({
      where: { id },
      select: publicDocumentSelect,
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');

    const order = await this.prisma.order.findFirst({
      where: { id: document.orderId, userId },
      select: { id: true, number: true, createdAt: true },
    });
    if (!order) throw new NotFoundException('Documento não encontrado.');

    return { ...document, order };
  }

  async downloadForUser(userId: string, id: string) {
    const document = await this.prisma.orderDocument.findUnique({
      where: { id },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');

    const order = await this.prisma.order.findFirst({
      where: { id: document.orderId, userId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Documento não encontrado.');

    return document;
  }

  async listForOrder(orderId: string) {
    await this.ensureOrder(orderId);
    return this.prisma.orderDocument.findMany({
      where: { orderId },
      select: publicDocumentSelect,
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async upload(
    orderId: string,
    body: UploadOrderDocumentDto,
    file: UploadedOrderDocumentFile | undefined,
    uploadedById: string,
  ) {
    await this.ensureOrder(orderId);
    if (!file) throw new BadRequestException('Selecione um ficheiro.');
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Formato inválido. São aceites PDF, JPG e PNG.',
      );
    }
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('O ficheiro deve ter no máximo 8 MB.');
    }

    const documentDate = body.documentDate
      ? new Date(`${body.documentDate}T00:00:00.000Z`)
      : null;
    if (documentDate && Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException('Data do documento inválida.');
    }

    return this.prisma.orderDocument.create({
      data: {
        orderId,
        type: body.type,
        label: body.label.trim(),
        reference: body.reference?.trim() || null,
        documentDate,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        content: file.buffer,
        uploadedById,
      },
      select: publicDocumentSelect,
    });
  }

  async downloadForAdmin(orderId: string, id: string) {
    await this.ensureOrder(orderId);
    const document = await this.prisma.orderDocument.findFirst({
      where: { id, orderId },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');
    return document;
  }

  async remove(orderId: string, id: string) {
    await this.ensureOrder(orderId);
    const deleted = await this.prisma.orderDocument.deleteMany({
      where: { id, orderId },
    });
    if (!deleted.count)
      throw new NotFoundException('Documento não encontrado.');
    return { success: true };
  }

  private async ensureOrder(orderId: string) {
    const exists = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Encomenda não encontrada.');
  }
}
