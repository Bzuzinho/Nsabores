import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import {
  CreateReturnDto,
  CreateShipmentDto,
  CreateSupportCaseDto,
  GuestTrackingDto,
  ReturnDecisionDto,
  ReturnStatusUpdateDto,
  ShipmentEventDto,
  ShipmentStatusUpdateDto,
  SupportCaseCommentDto,
  SupportCaseStatusUpdateDto,
} from './dto';
import { FulfillmentService } from './fulfillment.service';
import { ShippingProvider } from './shipping.provider';

@Controller('v1/tracking')
export class PublicTrackingController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Post()
  track(@Body() body: GuestTrackingDto) {
    return this.fulfillment.guestTracking(body.orderNumber, body.email);
  }
}

@UseGuards(AuthGuard)
@Controller('v1/account')
export class CustomerFulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Get('orders/:orderId/tracking')
  tracking(
    @CurrentUser() user: AuthPrincipal,
    @Param('orderId') orderId: string,
  ) {
    return this.fulfillment.trackingForUser(orderId, user.sub);
  }

  @Get('returns')
  returns(@CurrentUser() user: AuthPrincipal) {
    return this.fulfillment.returns(user.sub);
  }

  @Get('returns/:id')
  returnRequest(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.fulfillment.returnRequest(id, user.sub);
  }

  @Post('returns')
  createReturn(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: CreateReturnDto,
  ) {
    return this.fulfillment.createReturn(user.sub, body);
  }

  @Get('support-cases')
  supportCases(@CurrentUser() user: AuthPrincipal) {
    return this.fulfillment.supportCases(user.sub);
  }

  @Get('support-cases/:id')
  supportCase(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.fulfillment.supportCase(id, user.sub);
  }

  @Post('support-cases')
  createSupportCase(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: CreateSupportCaseDto,
  ) {
    return this.fulfillment.createSupportCase(user.sub, body);
  }

  @Post('support-cases/:id/comments')
  comment(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: SupportCaseCommentDto,
  ) {
    return this.fulfillment.addCustomerSupportComment(id, body.body, user.sub);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin')
export class AdminFulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Get('operations/preparation')
  preparationQueue() {
    return this.fulfillment.preparationQueue();
  }

  @Get('shipments')
  shipments(@Query('orderId') orderId?: string) {
    return this.fulfillment.shipments(orderId);
  }

  @Get('shipments/:id')
  shipment(@Param('id') id: string) {
    return this.fulfillment.shipment(id);
  }

  @Post('shipments')
  createShipment(@Body() body: CreateShipmentDto) {
    return this.fulfillment.createShipment(body);
  }

  @Post('shipments/:id/label')
  createLabel(@Param('id') id: string) {
    return this.fulfillment.createLabel(id);
  }

  @Post('shipments/:id/dispatch')
  dispatch(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.fulfillment.dispatch(id, user.sub);
  }

  @Post('shipments/:id/events')
  addEvent(@Param('id') id: string, @Body() body: ShipmentEventDto) {
    return this.fulfillment.addEvent(id, body);
  }

  @Patch('shipments/:id/status')
  updateShipmentStatus(
    @Param('id') id: string,
    @Body() body: ShipmentStatusUpdateDto,
  ) {
    return this.fulfillment.updateShipmentStatus(id, body.status);
  }

  @Get('returns')
  returns() {
    return this.fulfillment.returns();
  }

  @Get('returns/:id')
  returnRequest(@Param('id') id: string) {
    return this.fulfillment.returnRequest(id);
  }

  @Post('returns/:id/decision')
  decideReturn(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: ReturnDecisionDto,
  ) {
    return this.fulfillment.decideReturn(id, body, user.sub);
  }

  @Patch('returns/:id/status')
  updateReturnStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: ReturnStatusUpdateDto,
  ) {
    return this.fulfillment.updateReturnStatus(
      id,
      body.status,
      user.sub,
      body.note,
    );
  }

  @Get('support-cases')
  supportCases() {
    return this.fulfillment.supportCases();
  }

  @Get('support-cases/:id')
  supportCase(@Param('id') id: string) {
    return this.fulfillment.supportCase(id);
  }

  @Patch('support-cases/:id')
  updateSupportCase(
    @Param('id') id: string,
    @Body() body: SupportCaseStatusUpdateDto,
  ) {
    return this.fulfillment.updateSupportCase(id, body);
  }

  @Post('support-cases/:id/comments')
  addSupportComment(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: SupportCaseCommentDto,
  ) {
    return this.fulfillment.addSupportComment(id, body, user.sub);
  }
}

@Controller('v1/shipping/webhooks')
export class ShippingWebhookController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly provider: ShippingProvider,
  ) {}

  @Post('mock')
  async webhook(
    @Headers('x-shipping-signature') signature: string | undefined,
    @Body() body: ShipmentEventDto & { shipmentId: string },
  ) {
    const raw = JSON.stringify(body);
    if (!this.provider.verifyWebhook(raw, signature)) {
      return { accepted: false };
    }
    await this.fulfillment.addEvent(body.shipmentId, body);
    return { accepted: true };
  }
}
