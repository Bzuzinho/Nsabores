import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FiscalDocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CurrentUser } from './auth.decorators';
import { AuthGuard } from './auth.guards';
import type { AuthPrincipal } from './auth.types';
import { AccountService } from './account.service';
import { AuthService } from './auth.service';
import { AddressDto, UpdateAddressDto, UpdateProfileDto } from './dto';

@UseGuards(AuthGuard)
@Controller('v1/account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Patch('profile')
  profile(@CurrentUser() user: AuthPrincipal, @Body() body: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, body);
  }

  @Get('addresses')
  addresses(@CurrentUser() user: AuthPrincipal) {
    return this.account.addresses(user.sub);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: AuthPrincipal, @Body() body: AddressDto) {
    return this.account.createAddress(user.sub, body);
  }

  @Patch('addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: UpdateAddressDto,
  ) {
    return this.account.updateAddress(user.sub, id, body);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.account.deleteAddress(user.sub, id);
  }

  @Get('documents')
  documents(@CurrentUser() user: AuthPrincipal) {
    return this.prisma.fiscalDocument.findMany({
      where: {
        customerUserId: user.sub,
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

  @Get('documents/:id')
  async document(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ) {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: {
        id,
        customerUserId: user.sub,
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
