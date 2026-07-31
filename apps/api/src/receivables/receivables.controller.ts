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
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { CompleteProductionDto, UpdateProductionDto } from '../production/dto';
import { ProductionService } from '../production/production.service';
import { CreateContactEventDto, UpdateAgreementDto } from './dto';
import { ReceivablesService } from './receivables.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')
@Controller('v1/admin')
export class ReceivablesController {
  private readonly productionService: ProductionService;

  constructor(
    private readonly receivables: ReceivablesService,
    prisma: PrismaService,
  ) {
    this.productionService = new ProductionService(prisma);
  }

  @Get('receivables')
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('due') due?: string,
  ) {
    return this.receivables.list(search, status, method, due);
  }

  @Get('receivables/:orderId')
  detail(@Param('orderId') orderId: string) {
    return this.receivables.detail(orderId);
  }

  @Patch('receivables/:orderId')
  update(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() body: UpdateAgreementDto,
  ) {
    return this.receivables.update(orderId, body, user.sub);
  }

  @Post('receivables/:orderId/events')
  event(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() body: CreateContactEventDto,
  ) {
    return this.receivables.addEvent(orderId, body, user.sub);
  }

  @Get('production')
  production() {
    return this.productionService.list();
  }

  @Get('production/:orderId')
  productionDetail(@Param('orderId') orderId: string) {
    return this.productionService.ensure(orderId);
  }

  @Patch('production/:orderId')
  updateProduction(
    @Param('orderId') orderId: string,
    @Body() body: UpdateProductionDto,
  ) {
    return this.productionService.update(orderId, body);
  }

  @Post('production/:orderId/complete')
  completeProduction(
    @Param('orderId') orderId: string,
    @Body() body: CompleteProductionDto,
  ) {
    return this.productionService.complete(orderId, body);
  }
}
