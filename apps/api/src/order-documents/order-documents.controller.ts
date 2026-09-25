import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { DeferredFeatureGuard } from '../launch-scope/deferred-feature.guard';
import { UploadOrderDocumentDto } from './order-documents.dto';
import {
  OrderDocumentsService,
  type UploadedOrderDocumentFile,
} from './order-documents.service';

function sendDocument(
  response: Response,
  document: { fileName: string; mimeType: string; content: Uint8Array },
) {
  response.setHeader('Content-Type', document.mimeType);
  response.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
  );
  response.send(Buffer.from(document.content));
}

@UseGuards(AuthGuard)
@Controller('v1/account/documents')
export class AccountOrderDocumentsController {
  constructor(private readonly documents: OrderDocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.documents.listForUser(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.documents.detailForUser(user.sub, id);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    sendDocument(response, await this.documents.downloadForUser(user.sub, id));
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/orders/:orderId/documents')
export class AdminOrderDocumentsController {
  constructor(
    private readonly documents: OrderDocumentsService,
    private readonly deferred: DeferredFeatureGuard,
  ) {}

  @Get()
  list(@Param('orderId') orderId: string) {
    return this.documents.listForOrder(orderId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthPrincipal,
    @Param('orderId') orderId: string,
    @Body() body: UploadOrderDocumentDto,
    @UploadedFile() file: UploadedOrderDocumentFile | undefined,
  ) {
    if (body.type === 'CREDIT_NOTE') {
      this.deferred.assertEnabled();
    }
    return this.documents.upload(orderId, body, file, user.sub);
  }

  @Get(':id/download')
  async download(
    @Param('orderId') orderId: string,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    sendDocument(response, await this.documents.downloadForAdmin(orderId, id));
  }

  @Delete(':id')
  remove(@Param('orderId') orderId: string, @Param('id') id: string) {
    return this.documents.remove(orderId, id);
  }
}
