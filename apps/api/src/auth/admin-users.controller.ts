import {
  Body,
  Controller,
  Delete,
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
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: UsersQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  invite(@Body() body: InviteUserDto) {
    return this.users.invite(body);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: UpdateUserAdminDto,
  ) {
    return this.users.update(actor.sub, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.users.remove(actor.sub, id);
  }

  @Post(':id/password-reset')
  @Roles(UserRole.ADMIN)
  passwordReset(@Param('id') id: string) {
    return this.users.sendPasswordReset(id);
  }

  @Post(':id/revoke-sessions')
  @Roles(UserRole.ADMIN)
  revoke(@Param('id') id: string) {
    return this.users.revokeSessions(id);
  }
}
