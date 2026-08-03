import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import { UserRole } from '@prisma/client';
import { CompleteProductionDto, UpdateProductionDto } from './dto';
import { ProductionService } from './production.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin/production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get()
  list() {
    return this.production.list();
  }

  @Get(':orderId')
  detail(@Param('orderId') orderId: string) {
    return this.production.ensure(orderId);
  }

  @Patch(':orderId')
  update(@Param('orderId') orderId: string, @Body() body: UpdateProductionDto) {
    return this.production.update(orderId, body);
  }

  @Post(':orderId/complete')
  complete(
    @Param('orderId') orderId: string,
    @Body() body: CompleteProductionDto,
  ) {
    return this.production.complete(orderId, body);
  }
}
