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
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { AddressDto, UpdateAddressDto } from '../auth/dto';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() query: CustomerQueryDto) {
    return this.customers.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.customers.detail(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: CreateCustomerDto) {
    return this.customers.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }

  @Post(':id/addresses')
  @Roles(UserRole.ADMIN)
  createAddress(@Param('id') id: string, @Body() body: AddressDto) {
    return this.customers.createAddress(id, body);
  }

  @Patch(':id/addresses/:addressId')
  @Roles(UserRole.ADMIN)
  updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() body: UpdateAddressDto,
  ) {
    return this.customers.updateAddress(id, addressId, body);
  }

  @Delete(':id/addresses/:addressId')
  @Roles(UserRole.ADMIN)
  deleteAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
  ) {
    return this.customers.deleteAddress(id, addressId);
  }
}
