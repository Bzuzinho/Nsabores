import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const mediaSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(file: UploadedMediaFile | undefined, uploadedById: string) {
    if (!file) throw new BadRequestException('Selecione uma imagem.');
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Formato inválido. São aceites JPG, PNG e WebP.',
      );
    }
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('A imagem deve ter no máximo 8 MB.');
    }

    const asset = await this.prisma.mediaAsset.create({
      data: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        content: Uint8Array.from(file.buffer),
        uploadedById,
      },
      select: mediaSelect,
    });

    return {
      ...asset,
      url: `/v1/media/${asset.id}`,
    };
  }

  async download(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('Imagem não encontrada.');
    return asset;
  }
}
