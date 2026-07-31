import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { AccountFiscalService } from './account-fiscal.service';

@UseGuards(AuthGuard)
@Controller('v1/account/documents')
export class AccountFiscalController {
  constructor(private readonly fiscal: AccountFiscalService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.fiscal.list(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.fiscal.detail(user.sub, id);
  }
}
