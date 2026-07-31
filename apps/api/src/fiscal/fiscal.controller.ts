import { Body, Controller, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
import { FiscalDocumentType, UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { CreditNoteService, type CreditNoteLineInput } from './credit-note.service';
import { FiscalProviderService } from './fiscal-provider.service';
import { FiscalReconciliationService } from './fiscal-reconciliation.service';
import { FiscalService } from './fiscal.service';
import { SourceFiscalService } from './source-fiscal.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/fiscal')
export class FiscalController {
  private readonly creditNotes: CreditNoteService;
  private readonly sources: SourceFiscalService;
  private readonly provider: FiscalProviderService;
  private readonly reconciliation: FiscalReconciliationService;

  constructor(
    private readonly fiscal: FiscalService,
    prisma: PrismaService,
  ) {
    this.creditNotes = new CreditNoteService(prisma);
    this.sources = new SourceFiscalService(prisma);
    this.provider = new FiscalProviderService(prisma);
    this.reconciliation = new FiscalReconciliationService(prisma);
  }

  @Get('documents')
  list() {
    return this.fiscal.list();
  }

  @Get('documents.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="documentos-fiscais.csv"')
  documentsCsv() {
    return this.reconciliation.documentsCsv();
  }

  @Get('reconciliation')
  reconciliationReport() {
    return this.reconciliation.report();
  }

  @Get('reconciliation.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="reconciliacao-fiscal.csv"')
  reconciliationCsv() {
    return this.reconciliation.reconciliationCsv();
  }

  @Get('provider')
  providerMode() {
    return { mode: this.provider.mode() };
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

  @Post('gift-card-purchases/:purchaseId/issue')
  issueGiftCardPurchase(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.sources.issueGiftCardPurchase(purchaseId, user.sub);
  }

  @Post('club-charges/:chargeId/issue')
  issueClubCharge(
    @Param('chargeId') chargeId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.sources.issueClubCharge(chargeId, user.sub);
  }

  @Post('documents/:id/provider/manual')
  registerManual(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
    @Body()
    body: {
      externalNumber: string;
      externalDocumentUrl?: string;
      providerReference?: string;
    },
  ) {
    return this.provider.registerManual(id, user.sub, body);
  }

  @Post('documents/:id/provider/mock')
  processMock(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() body: { simulateFailure?: boolean },
  ) {
    return this.provider.processMock(id, user.sub, body.simulateFailure === true);
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
