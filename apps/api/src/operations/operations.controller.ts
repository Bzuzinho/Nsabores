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
  BusinessAccountDto,
  BusinessAccountUserDto,
  BusinessOrderDto,
  BusinessStatusDto,
  InventoryDto,
  InventoryUpdateDto,
  PriceListDto,
  PurchaseOrderDto,
  PurchaseReceiptDto,
  PurchaseStatusDto,
  ResellerApplicationDto,
  StockAdjustmentDto,
  StockConfigurationDto,
  SupplierDto,
  UpdateBusinessAccountUserDto,
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
  order(@CurrentUser() user: AuthPrincipal, @Body() body: BusinessOrderDto) {
    return this.operations.createB2BOrder(
      user.sub,
      body.items,
      body.deliveryMethodId,
      body.customerReference,
      body.idempotencyKey,
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
  @Patch('stock/:productId')
  configureStock(
    @Param('productId') productId: string,
    @Body() body: StockConfigurationDto,
  ) {
    return this.operations.configureStock(productId, body);
  }
  @Post('stock/adjustments')
  adjustStock(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: StockAdjustmentDto,
  ) {
    return this.operations.adjustStock(body, user.sub);
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
  @Put('purchases/:id') updatePurchase(
    @Param('id') id: string,
    @Body() body: PurchaseOrderDto,
  ) {
    return this.operations.updatePurchase(id, body);
  }
  @Post('purchases/:id/receipts') receive(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: PurchaseReceiptDto,
  ) {
    return this.operations.receivePurchase(id, body, user.sub);
  }
  @Patch('purchases/:id/status')
  purchaseStatus(@Param('id') id: string, @Body() body: PurchaseStatusDto) {
    return this.operations.setPurchaseStatus(id, body.status);
  }
  @Get('inventories') inventories() {
    return this.operations.inventories();
  }
  @Get('inventories/:id') inventoryDetail(@Param('id') id: string) {
    return this.operations.inventory(id);
  }
  @Post('inventories') inventory(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: InventoryDto,
  ) {
    return this.operations.createInventory(body, user.sub);
  }
  @Patch('inventories/:id') updateInventory(
    @Param('id') id: string,
    @Body() body: InventoryUpdateDto,
  ) {
    return this.operations.updateInventory(id, body);
  }
  @Post('inventories/:id/complete') completeInventory(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.operations.completeInventory(id, user.sub);
  }
  @Post('inventories/:id/cancel') cancelInventory(@Param('id') id: string) {
    return this.operations.cancelInventory(id);
  }
  @Get('reseller-applications') applications() {
    return this.operations.applications();
  }
  @Get('reseller-applications/:id') application(@Param('id') id: string) {
    return this.operations.application(id);
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
  @Post('business-accounts')
  @Roles(UserRole.ADMIN)
  createAccount(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: BusinessAccountDto,
  ) {
    return this.operations.createBusinessAccount(body, user.sub);
  }
  @Patch('business-accounts/:id')
  @Roles(UserRole.ADMIN)
  updateAccount(@Param('id') id: string, @Body() body: BusinessAccountDto) {
    return this.operations.updateBusinessAccount(id, body);
  }
  @Patch('business-accounts/:id/status')
  @Roles(UserRole.ADMIN)
  status(@Param('id') id: string, @Body() body: BusinessStatusDto) {
    return this.operations.setBusinessStatus(id, body.status);
  }
  @Post('business-accounts/:id/users')
  @Roles(UserRole.ADMIN)
  addAccountUser(
    @Param('id') id: string,
    @Body() body: BusinessAccountUserDto,
  ) {
    return this.operations.addBusinessAccountUser(id, body);
  }
  @Patch('business-accounts/:id/users/:membershipId')
  @Roles(UserRole.ADMIN)
  updateAccountUser(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateBusinessAccountUserDto,
  ) {
    return this.operations.updateBusinessAccountUser(id, membershipId, body);
  }
  @Delete('business-accounts/:id/users/:membershipId')
  @Roles(UserRole.ADMIN)
  removeAccountUser(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.operations.removeBusinessAccountUser(id, membershipId);
  }
  @Get('price-lists') priceLists() {
    return this.operations.priceLists();
  }
  @Get('price-lists/:id') priceListDetail(@Param('id') id: string) {
    return this.operations.priceList(id);
  }
  @Post('price-lists')
  @Roles(UserRole.ADMIN)
  priceList(@Body() body: PriceListDto) {
    return this.operations.createPriceList(body);
  }
  @Patch('price-lists/:id')
  @Roles(UserRole.ADMIN)
  updatePriceList(@Param('id') id: string, @Body() body: PriceListDto) {
    return this.operations.updatePriceList(id, body);
  }
  @Delete('price-lists/:id')
  @Roles(UserRole.ADMIN)
  deletePriceList(@Param('id') id: string) {
    return this.operations.deletePriceList(id);
  }
}
