import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from './auth.decorators';
import { AuthGuard, RolesGuard } from './auth.guards';
import type { AuthPrincipal } from './auth.types';
import { AdminUsersService } from './admin-users.service';
import { InviteUserDto, UpdateUserAdminDto, UsersQueryDto } from './dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('v1/admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: UsersQueryDto) {
    return this.users.list(query);
  }

  @Post()
  invite(@Body() body: InviteUserDto) {
    return this.users.invite(body);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: UpdateUserAdminDto,
  ) {
    return this.users.update(actor.sub, id, body);
  }

  @Post(':id/revoke-sessions')
  revoke(@Param('id') id: string) {
    return this.users.revokeSessions(id);
  }
}
