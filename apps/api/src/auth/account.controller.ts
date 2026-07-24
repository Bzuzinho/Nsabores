import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
}
