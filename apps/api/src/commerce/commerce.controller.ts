import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrderStatus, UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { CommerceService } from './commerce.service';
import {
  CartItemDto,
  CartQuantityDto,
  CheckoutDto,
  DeliveryMethodDto,
  InternalNoteDto,
  ManualPaymentDto,
  MockWebhookDto,
  OrderQueryDto,
  OrderStatusDto,
  PaymentStartDto,
} from './dto';
import { ManualPaymentService } from './manual-payment.service';

class CommerceIdentity {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolve(request: Request, response: Response) {
    const token = request.cookies?.nsabores_access as string | undefined;
    let userId: string | undefined;
    if (token) {
      try {
        const principal = await this.jwt.verifyAsync<AuthPrincipal>(token);
        const user = await this.prisma.user.findFirst({
          where: { id: principal.sub, isActive: true },
          select: { id: true },
        });
        userId = user?.id;
      } catch {
        userId = undefined;
      }
    }
    let sessionId = request.cookies?.nsabores_cart as string | undefined;
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      sessionId = randomUUID();
      response.cookie('nsabores_cart', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.get<boolean>('AUTH_COOKIE_SECURE') ?? false,
        domain: this.config.get<string>('AUTH_COOKIE_DOMAIN') || undefined,
        maxAge: 1000 * 60 * 60 * 24 * 365,
        path: '/',
      });
    }
    return { userId, sessionId };
  }
}

@Controller('v1/cart')
export class CartController {
  private readonly identity: CommerceIdentity;

  constructor(
    private readonly commerce: CommerceService,
    jwt: JwtService,
    prisma: PrismaService,
    config: ConfigService,
  ) {
    this.identity = new CommerceIdentity(jwt, prisma, config);
  }

  @Get()
  async get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.commerce.cart(await this.identity.resolve(request, response));
  }

  @Post('items')
  async add(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: CartItemDto,
  ) {
    return this.commerce.addItem(
      await this.identity.resolve(request, response),
      body.productId,
      body.quantity,
    );
  }

  @Patch('items/:id')
  async update(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Body() body: CartQuantityDto,
  ) {
    return this.commerce.updateItem(
      await this.identity.resolve(request, response),
      id,
      body.quantity,
    );
  }

  @Delete('items/:id')
  async remove(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
  ) {
    return this.commerce.removeItem(
      await this.identity.resolve(request, response),
      id,
    );
  }

  @Delete()
  async clear(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.commerce.clearCart(
      await this.identity.resolve(request, response),
    );
  }

  @UseGuards(AuthGuard)
  @Post('merge')
  merge(@CurrentUser() user: AuthPrincipal, @Req() request: Request) {
    return this.commerce.merge(
      user.sub,
      request.cookies?.nsabores_cart as string | undefined,
    );
  }
}

@Controller('v1')
export class CheckoutController {
  private readonly identity: CommerceIdentity;

  constructor(
    private readonly commerce: CommerceService,
    jwt: JwtService,
    prisma: PrismaService,
    config: ConfigService,
  ) {
    this.identity = new CommerceIdentity(jwt, prisma, config);
  }

  @Get('delivery-methods')
  deliveryMethods() {
    return this.commerce.deliveryMethods();
  }

  @Post('checkout')
  async checkout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: CheckoutDto,
  ) {
    return this.commerce.checkout(
      await this.identity.resolve(request, response),
      body,
    );
  }

  @Post('orders/:id/payment')
  async payment(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Body() body: PaymentStartDto,
  ) {
    const identity = await this.identity.resolve(request, response);
    return this.commerce.startPayment(id, identity.userId, body.idempotencyKey);
  }

  @Post('payments/webhook')
  webhook(
    @Headers('x-payment-signature') signature: string | undefined,
    @Body() body: MockWebhookDto,
  ) {
    return this.commerce.webhook(JSON.stringify(body), signature, body);
  }

  @Post('payments/mock/:providerPaymentId/confirm')
  confirm(@Param('providerPaymentId') providerPaymentId: string) {
    return this.commerce.confirmMock(providerPaymentId);
  }
}

@UseGuards(AuthGuard)
@Controller('v1/account/orders')
export class CustomerOrdersController {
  constructor(private readonly commerce: CommerceService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.commerce.customerOrders(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.commerce.customerOrder(user.sub, id);
  }

  @Post(':id/repeat')
  repeat(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.commerce.repeatOrder(user.sub, id);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin')
export class AdminOrdersController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly manualPayments: ManualPaymentService,
  ) {}

  @Get('orders')
  list(@Query() query: OrderQueryDto) {
    return this.commerce.adminOrders(query);
  }

  @Get('orders/:id')
  detail(@Param('id') id: string) {
    return this.commerce.adminOrder(id);
  }

  @Patch('orders/:id/status')
  status(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: OrderStatusDto,
  ) {
    return this.commerce.changeStatus(id, body.status, user.sub, body.note);
  }

  @Patch('orders/:id/notes')
  note(@Param('id') id: string, @Body() body: InternalNoteDto) {
    return this.commerce.updateInternalNote(id, body.note);
  }

  @Post('orders/:id/mark-paid')
  markPaid(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: ManualPaymentDto,
  ) {
    return this.manualPayments.markReceived(id, user.sub, body);
  }

  @Post('orders/:id/cancel')
  cancel(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.commerce.changeStatus(id, OrderStatus.CANCELLED, user.sub);
  }

  @Post('orders/:id/refund')
  refund(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.commerce.refund(id, user.sub);
  }

  @Get('delivery-methods')
  deliveryMethods() {
    return this.commerce.deliveryMethods(true);
  }

  @Patch('delivery-methods/:id')
  updateDelivery(@Param('id') id: string, @Body() body: DeliveryMethodDto) {
    return this.commerce.updateDeliveryMethod(id, body);
  }
}
