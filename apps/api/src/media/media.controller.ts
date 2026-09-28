import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { MediaService, type UploadedMediaFile } from './media.service';

@Controller('v1/media')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  async image(@Param('id') id: string, @Res() response: Response) {
    const asset = await this.media.download(id);
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Length', String(asset.sizeBytes));
    response.send(Buffer.from(asset.content));
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthPrincipal,
    @UploadedFile() file: UploadedMediaFile | undefined,
  ) {
    return this.media.upload(file, user.sub);
  }
}
