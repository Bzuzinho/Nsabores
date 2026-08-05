import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import {
  ApplicationDecisionDto,
  BusinessStatusDto,
  InventoryDto,
  PriceListDto,
  PurchaseOrderDto,
  PurchaseReceiptDto,
  ResellerApplicationDto,
  SupplierDto,
} from './dto';
import { OperationsService } from './operations.service';

@Controller('v1')
export class PublicOperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Post('reseller-applications')
  apply(@Body() body: ResellerApplicationDto) {
    return this.operations.apply(body);
  }

  @Get('catalog/resolved')
  catalog() {
    return this.operations.resolvedCatalog();
  }
}

@UseGuards(AuthGuard)
@Controller('v1/business')
export class BusinessOperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('account')
  account(@CurrentUser() user: AuthPrincipal) {
    return this.operations.accountForUser(user.sub);
  }

  @Get('catalog')
  catalog(@CurrentUser() user: AuthPrincipal) {
    return this.operations.resolvedCatalog(user.sub);
  }

  @Post('orders')
  order(
    @CurrentUser() user: AuthPrincipal,
    @Body()
    body: { productId: string; quantity: number; customerReference?: string },
  ) {
    return this.operations.createB2BOrder(
      user.sub,
      body.productId,
      body.quantity,
      body.customerReference,
    );
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin')
export class AdminOperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('operations/dashboard') dashboard() {
    return this.operations.dashboard();
  }
  @Get('stock') stock() {
    return this.operations.stock();
  }
  @Get('stock/movements') movements() {
    return this.operations.movements();
  }
  @Get('suppliers') suppliers() {
    return this.operations.suppliers();
  }
  @Get('suppliers/:id') supplier(@Param('id') id: string) {
    return this.operations.supplier(id);
  }
  @Post('suppliers') createSupplier(@Body() body: SupplierDto) {
    return this.operations.createSupplier(body);
  }
  @Put('suppliers/:id') updateSupplier(
    @Param('id') id: string,
    @Body() body: SupplierDto,
  ) {
    return this.operations.updateSupplier(id, body);
  }
  @Delete('suppliers/:id') deleteSupplier(@Param('id') id: string) {
    return this.operations.deleteSupplier(id);
  }
  @Get('purchases') purchases() {
    return this.operations.purchases();
  }
  @Get('purchases/:id') purchase(@Param('id') id: string) {
    return this.operations.purchase(id);
  }
  @Post('purchases') createPurchase(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: PurchaseOrderDto,
  ) {
    return this.operations.createPurchase(body, user.sub);
  }
  @Post('purchases/:id/receipts') receive(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: PurchaseReceiptDto,
  ) {
    return this.operations.receivePurchase(id, body, user.sub);
  }
  @Get('inventories') inventories() {
    return this.operations.inventories();
  }
  @Post('inventories') inventory(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: InventoryDto,
  ) {
    return this.operations.createInventory(body, user.sub);
  }
  @Post('inventories/:id/complete') completeInventory(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.operations.completeInventory(id, user.sub);
  }
  @Get('reseller-applications') applications() {
    return this.operations.applications();
  }
  @Post('reseller-applications/:id/decision') decide(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: ApplicationDecisionDto,
  ) {
    return this.operations.decideApplication(id, body, user.sub);
  }
  @Get('business-accounts') accounts() {
    return this.operations.businessAccounts();
  }
  @Get('business-accounts/:id') account(@Param('id') id: string) {
    return this.operations.businessAccount(id);
  }
  @Patch('business-accounts/:id/status')
  @Roles(UserRole.ADMIN)
  status(@Param('id') id: string, @Body() body: BusinessStatusDto) {
    return this.operations.setBusinessStatus(id, body.status);
  }
  @Get('price-lists') priceLists() {
    return this.operations.priceLists();
  }
  @Post('price-lists')
  @Roles(UserRole.ADMIN)
  priceList(@Body() body: PriceListDto) {
    return this.operations.createPriceList(body);
  }
}
