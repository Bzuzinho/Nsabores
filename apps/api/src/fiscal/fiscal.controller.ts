import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FiscalDocumentType, UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { CreditNoteService, type CreditNoteLineInput } from './credit-note.service';
import { FiscalService } from './fiscal.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/fiscal')
export class FiscalController {
  constructor(
    private readonly fiscal: FiscalService,
    private readonly creditNotes: CreditNoteService,
  ) {}

  @Get('documents')
  list() {
    return this.fiscal.list();
  }

  @Get('documents/:id')
  detail(@Param('id') id: string) {
    return this.fiscal.detail(id);
  }

  @Post('orders/:orderId/issue')
  issueOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() body: { type?: FiscalDocumentType },
  ) {
    return this.fiscal.issueOrder(
      orderId,
      user.sub,
      body.type ?? FiscalDocumentType.INVOICE_RECEIPT,
    );
  }

  @Post('documents/:id/credit-notes')
  credit(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
    @Body()
    body: {
      idempotencyKey: string;
      reason: string;
      lines?: CreditNoteLineInput[];
    },
  ) {
    return this.creditNotes.create(
      id,
      user.sub,
      body.idempotencyKey,
      body.reason,
      body.lines,
    );
  }
}
