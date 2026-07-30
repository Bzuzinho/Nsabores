import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import Joi from 'joi';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { CatalogService } from './catalog/catalog.service';
import { CatalogController } from './catalog/catalog.controller';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { AuthController } from './auth/auth.controller';
import { AccountController } from './auth/account.controller';
import { AdminUsersController } from './auth/admin-users.controller';
import { AuthService } from './auth/auth.service';
import { AccountService } from './auth/account.service';
import { AdminUsersService } from './auth/admin-users.service';
import { AuthGuard, RolesGuard } from './auth/auth.guards';
import { MailProvider } from './auth/mail.provider';
import {
  AdminOrdersController,
  CartController,
  CheckoutController,
  CustomerOrdersController,
} from './commerce/commerce.controller';
import { CommerceService } from './commerce/commerce.service';
import { PaymentProvider } from './commerce/payment.provider';
import { CommerceMailProvider } from './commerce/mail.provider';
import {
  AdminOperationsController,
  BusinessOperationsController,
  PublicOperationsController,
} from './operations/operations.controller';
import { OperationsService } from './operations/operations.service';
import {
  AdminFulfillmentController,
  CustomerFulfillmentController,
  PublicTrackingController,
  ShippingWebhookController,
} from './fulfillment/fulfillment.controller';
import { FulfillmentService } from './fulfillment/fulfillment.service';
import { ShippingProvider } from './fulfillment/shipping.provider';
import { AdminReturnRefundController } from './fulfillment/refund.controller';
import { ReturnRefundService } from './fulfillment/refund.service';
import { ReturnReplacementService } from './fulfillment/replacement.service';
import {
  AdminPromotionsController,
  CartCouponController,
  PublicPromotionsController,
} from './promotions/promotions.controller';
import { AdvancedPromotionsService } from './promotions/advanced-promotions.service';
import { CouponAuditController } from './promotions/coupon-audit.controller';
import { CouponAuditService } from './promotions/coupon-audit.service';
import { PromotionalCommerceService } from './promotions/promotional-commerce.service';
import { PromotionsService } from './promotions/promotions.service';
import { QuantityDealController } from './promotions/quantity-deal.controller';
import {
  AdminBundlesController,
  PublicBundlesController,
} from './bundles/bundles.controller';
import { BundleAwareCommerceService } from './bundles/bundle-aware-commerce.service';
import { BundleCartController } from './bundles/bundle-cart.controller';
import { BundleCartService } from './bundles/bundle-cart.service';
import { BundleInventoryService } from './bundles/bundle-inventory.service';
import { BundlesService } from './bundles/bundles.service';
import {
  AccountClubController,
  AdminClubController,
  PublicClubController,
} from './club/club.controller';
import {
  AccountClubOperationsController,
  AdminClubOperationsController,
  ClubWebhookController,
} from './club/club-operations.controller';
import { ClubBillingProvider } from './club/billing.provider';
import { ClubOperationsService } from './club/club-operations.service';
import { ClubPromotionsService } from './club/club-promotions.service';
import { ClubService } from './club/club.service';
import { AdminLoyaltyAccountsController } from './loyalty/loyalty-admin.controller';
import {
  AccountLoyaltyController,
  AdminLoyaltyController,
  PublicGiftCardController,
} from './loyalty/loyalty.controller';
import { LoyaltyCommerceService } from './loyalty/loyalty-commerce.service';
import { LoyaltyLedgerService } from './loyalty/loyalty-ledger.service';
import { LoyaltyOrderService } from './loyalty/loyalty-order.service';
import { LoyaltyReversalService } from './loyalty/loyalty-reversal.service';
import { LoyaltyService } from './loyalty/loyalty.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        CORS_ORIGINS: Joi.string().default(
          'http://localhost:3000,http://localhost:3001',
        ),
        DATABASE_URL: Joi.string().uri().optional(),
        AUTH_ACCESS_TOKEN_SECRET: Joi.string()
          .min(32)
          .when('NODE_ENV', {
            is: 'production',
            then: Joi.required(),
            otherwise: Joi.string().default(
              'development-only-secret-change-me',
            ),
          }),
        AUTH_ACCESS_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('15m'),
        AUTH_REFRESH_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('30d'),
        PASSWORD_RESET_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('1h'),
        EMAIL_VERIFICATION_TOKEN_TTL: Joi.string()
          .pattern(/^\d+[mhd]$/)
          .default('24h'),
        AUTH_COOKIE_DOMAIN: Joi.string().allow('').optional(),
        AUTH_COOKIE_SECURE: Joi.boolean().default(false),
        WEBSITE_URL: Joi.string().uri().default('http://localhost:3000'),
        MANAGEMENT_URL: Joi.string().uri().default('http://localhost:3001'),
        PAYMENT_PROVIDER: Joi.string().valid('mock', 'stripe').default('mock'),
        PAYMENT_SECRET_KEY: Joi.string().allow('').optional(),
        PAYMENT_WEBHOOK_SECRET: Joi.string()
          .min(16)
          .default('development-mock-webhook-secret'),
        PAYMENT_SUCCESS_URL: Joi.string()
          .uri()
          .default('http://localhost:3000/checkout/sucesso'),
        PAYMENT_CANCEL_URL: Joi.string()
          .uri()
          .default('http://localhost:3000/checkout/erro'),
        SHIPPING_PROVIDER: Joi.string().default('mock'),
        SHIPPING_API_KEY: Joi.string().allow('').optional(),
        SHIPPING_API_SECRET: Joi.string().allow('').optional(),
        SHIPPING_WEBHOOK_SECRET: Joi.string()
          .min(16)
          .default('development-shipping-webhook-secret'),
        SHIPPING_SENDER_NAME: Joi.string().default('Nsabores'),
        SHIPPING_SENDER_ADDRESS: Joi.string().allow('').optional(),
        CLUB_BILLING_PROVIDER: Joi.string()
          .valid('mock', 'stripe')
          .default('mock'),
        CLUB_BILLING_WEBHOOK_SECRET: Joi.string()
          .min(16)
          .default('development-club-webhook-secret'),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(4000),
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('AUTH_ACCESS_TOKEN_SECRET'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [
    HealthController,
    CatalogController,
    AdminCatalogController,
    AuthController,
    AccountController,
    AdminUsersController,
    CartController,
    CheckoutController,
    CustomerOrdersController,
    AdminOrdersController,
    PublicOperationsController,
    BusinessOperationsController,
    AdminOperationsController,
    PublicTrackingController,
    CustomerFulfillmentController,
    AdminFulfillmentController,
    ShippingWebhookController,
    AdminReturnRefundController,
    PublicPromotionsController,
    CartCouponController,
    AdminPromotionsController,
    QuantityDealController,
    CouponAuditController,
    PublicBundlesController,
    BundleCartController,
    AdminBundlesController,
    PublicClubController,
    AccountClubController,
    AdminClubController,
    AccountClubOperationsController,
    AdminClubOperationsController,
    ClubWebhookController,
    AccountLoyaltyController,
    PublicGiftCardController,
    AdminLoyaltyController,
    AdminLoyaltyAccountsController,
  ],
  providers: [
    PrismaService,
    CatalogService,
    AuthService,
    AccountService,
    AdminUsersService,
    AuthGuard,
    RolesGuard,
    MailProvider,
    LoyaltyCommerceService,
    { provide: BundleAwareCommerceService, useExisting: LoyaltyCommerceService },
    { provide: PromotionalCommerceService, useExisting: LoyaltyCommerceService },
    { provide: CommerceService, useExisting: LoyaltyCommerceService },
    PaymentProvider,
    CommerceMailProvider,
    OperationsService,
    FulfillmentService,
    ShippingProvider,
    ReturnRefundService,
    ReturnReplacementService,
    ClubPromotionsService,
    { provide: AdvancedPromotionsService, useExisting: ClubPromotionsService },
    { provide: PromotionsService, useExisting: ClubPromotionsService },
    CouponAuditService,
    BundlesService,
    BundleCartService,
    BundleInventoryService,
    ClubBillingProvider,
    ClubService,
    ClubOperationsService,
    LoyaltyService,
    LoyaltyLedgerService,
    LoyaltyReversalService,
    LoyaltyOrderService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
