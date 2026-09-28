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
import { Roles } from './auth.decorators';
import { AuthGuard, RolesGuard } from './auth.guards';
import { AdminUsersService } from './admin-users.service';
import {
  CreateCustomerAdminDto,
  UpdateCustomerAdminDto,
  UsersQueryDto,
} from './dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/customers')
export class AdminCustomersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: UsersQueryDto) {
    return this.users.listCustomers(query);
  }

  @Post()
  create(@Body() body: CreateCustomerAdminDto) {
    return this.users.createCustomer(body);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.users.customerDetail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCustomerAdminDto) {
    return this.users.updateCustomer(id, body);
  }
}
