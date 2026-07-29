import {
  Body,
  Controller,
  Delete,
  Get,
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
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma.service';
import { ApplyCouponDto, CouponDto, PromotionDto } from './dto';
import { PromotionalCommerceService } from './promotional-commerce.service';
import { PromotionsService } from './promotions.service';

class PromotionCartIdentity {
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
      const crypto = await import('node:crypto');
      sessionId = crypto.randomUUID();
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

@Controller('v1/promotions')
export class PublicPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(@Query('channel') channel?: 'B2C' | 'B2B') {
    return this.promotions.publicPromotions(channel ?? 'B2C');
  }
}

@Controller('v1/cart/coupon')
export class CartCouponController {
  private readonly identity: PromotionCartIdentity;

  constructor(
    private readonly commerce: PromotionalCommerceService,
    jwt: JwtService,
    prisma: PrismaService,
    config: ConfigService,
  ) {
    this.identity = new PromotionCartIdentity(jwt, prisma, config);
  }

  @Post()
  async apply(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: ApplyCouponDto,
  ) {
    return this.commerce.applyCoupon(
      await this.identity.resolve(request, response),
      body.code,
    );
  }

  @Delete()
  async remove(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.commerce.removeCoupon(
      await this.identity.resolve(request, response),
    );
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('v1/admin')
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get('promotions')
  promotionsList() {
    return this.promotions.promotions();
  }

  @Get('promotions/:id')
  promotion(@Param('id') id: string) {
    return this.promotions.promotion(id);
  }

  @Post('promotions')
  createPromotion(@Body() body: PromotionDto) {
    return this.promotions.createPromotion(body);
  }

  @Patch('promotions/:id')
  updatePromotion(@Param('id') id: string, @Body() body: PromotionDto) {
    return this.promotions.updatePromotion(id, body);
  }

  @Get('coupons')
  coupons() {
    return this.promotions.coupons();
  }

  @Get('coupons/:id')
  coupon(@Param('id') id: string) {
    return this.promotions.coupon(id);
  }

  @Post('coupons')
  createCoupon(@Body() body: CouponDto) {
    return this.promotions.createCoupon(body);
  }

  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() body: CouponDto) {
    return this.promotions.updateCoupon(id, body);
  }
}
