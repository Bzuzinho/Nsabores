import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Joi from 'joi';
import { AccountController } from './auth/account.controller';
import { AccountService } from './auth/account.service';
import { AdminUsersController } from './auth/admin-users.controller';
import { AdminUsersService } from './auth/admin-users.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard, RolesGuard } from './auth/auth.guards';
import { AuthService } from './auth/auth.service';
import { MailProvider } from './auth/mail.provider';
import { BootstrapAdminService } from './bootstrap-admin';
import { BundleAwareCommerceService } from './bundles/bundle-aware-commerce.service';
import { BundleCartController } from './bundles/bundle-cart.controller';
import { BundleCartService } from './bundles/bundle-cart.service';
import { BundleInventoryService } from './bundles/bundle-inventory.service';
import {
  AdminBundlesController,
  PublicBundlesController,
} from './bundles/bundles.controller';
import { BundlesService } from './bundles/bundles.service';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ClubBillingProvider } from './club/billing.provider';
import {
  AccountClubOperationsController,
  AdminClubOperationsController,
  ClubWebhookController,
} from './club/club-operations.controller';
import { ClubOperationsService } from './club/club-operations.service';
import { ClubPromotionsService } from './club/club-promotions.service';
import {
  AccountClubController,
  AdminClubController,
  PublicClubController,
} from './club/club.controller';
import { ClubService } from './club/club.service';
import { ManualClubPaymentsService } from './club/manual-club-payments.service';
import { CommerceIdentityService } from './commerce/commerce-identity.service';
import {
  AdminOrdersController,
  CartController,
  CheckoutController,
  CustomerOrdersController,
} from './commerce/commerce.controller';
import { CommerceMailProvider } from './commerce/mail.provider';
import { ManualPaymentService } from './commerce/manual-payment.service';
import { PaymentProvider } from './commerce/payment.provider';
import { CommerceService } from './commerce/commerce.service';
import { CreditNoteService } from './fiscal/credit-note.service';
import { FiscalProviderService } from './fiscal/fiscal-provider.service';
import { FiscalReconciliationService } from './fiscal/fiscal-reconciliation.service';
import { FiscalController } from './fiscal/fiscal.controller';
import { FiscalService } from './fiscal/fiscal.service';
import { SourceFiscalService } from './fiscal/source-fiscal.service';
import {
  AdminFulfillmentController,
  CustomerFulfillmentController,
  PublicTrackingController,
  ShippingWebhookController,
} from './fulfillment/fulfillment.controller';
import { FulfillmentService } from './fulfillment/fulfillment.service';
import { AdminReturnRefundController } from './fulfillment/refund.controller';
import { ReturnRefundService } from './fulfillment/refund.service';
import { ReturnReplacementService } from './fulfillment/replacement.service';
import { ShippingProvider } from './fulfillment/shipping.provider';
import { HealthController } from './health.controller';
import {
  AdminGiftCardPurchaseController,
  GiftCardPurchaseController,
} from './loyalty/gift-card-purchase.controller';
import { GiftCardPurchaseService } from './loyalty/gift-card-purchase.service';
import { AdminLoyaltyAccountsController } from './loyalty/loyalty-admin.controller';
import { LoyaltyCommerceService } from './loyalty/loyalty-commerce.service';
import { LoyaltyEarningService } from './loyalty/loyalty-earning.service';
import { LoyaltyLedgerService } from './loyalty/loyalty-ledger.service';
import { LoyaltyOrderService } from './loyalty/loyalty-order.service';
import { LoyaltyReleaseService } from './loyalty/loyalty-release.service';
import { LoyaltyReversalService } from './loyalty/loyalty-reversal.service';
import {
  AccountLoyaltyController,
  AdminLoyaltyController,
  PublicGiftCardController,
} from './loyalty/loyalty.controller';
import { LoyaltyService } from './loyalty/loyalty.service';
import {
  AdminOperationsController,
  BusinessOperationsController,
  PublicOperationsController,
} from './operations/operations.controller';
import { OperationsService } from './operations/operations.service';
import { PrismaService } from './prisma.service';
import { ProductionController } from './production/production.controller';
import { ProductionService } from './production/production.service';
import { AdvancedPromotionsService } from './promotions/advanced-promotions.service';
import { CouponAuditController } from './promotions/coupon-audit.controller';
import { CouponAuditService } from './promotions/coupon-audit.service';
import { PromotionalCommerceService } from './promotions/promotional-commerce.service';
import {
  AdminPromotionsController,
  CartCouponController,
  PublicPromotionsController,
} from './promotions/promotions.controller';
import { PromotionsService } from './promotions/promotions.service';
import { QuantityDealController } from './promotions/quantity-deal.controller';
import { AccountReceivablesController } from './receivables/account-receivables.controller';
import { ReceivablesController } from './receivables/receivables.controller';
import { ReceivablesService } from './receivables/receivables.service';

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
        BOOTSTRAP_ADMIN_EMAIL: Joi.string().email().optional(),
        BOOTSTRAP_ADMIN_PASSWORD_HASH: Joi.string().min(20).optional(),
        WEBSITE_URL: Joi.string().uri().default('http://localhost:3000'),
        MANAGEMENT_URL: Joi.string().uri().default('http://localhost:3001'),
        PAYMENT_FLOW_MODE: Joi.string()
          .valid('manual', 'automatic')
          .default('manual'),
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
    AccountReceivablesController,
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
    GiftCardPurchaseController,
    AdminGiftCardPurchaseController,
    AdminLoyaltyController,
    AdminLoyaltyAccountsController,
    ReceivablesController,
    ProductionController,
    FiscalController,
  ],
  providers: [
    PrismaService,
    BootstrapAdminService,
    CatalogService,
    AuthService,
    AccountService,
    AdminUsersService,
    AuthGuard,
    RolesGuard,
    MailProvider,
    ReceivablesService,
    ProductionService,
    FiscalService,
    CreditNoteService,
    SourceFiscalService,
    FiscalProviderService,
    FiscalReconciliationService,
    LoyaltyCommerceService,
    {
      provide: BundleAwareCommerceService,
      useExisting: LoyaltyCommerceService,
    },
    {
      provide: PromotionalCommerceService,
      useExisting: LoyaltyCommerceService,
    },
    { provide: CommerceService, useExisting: LoyaltyCommerceService },
    CommerceIdentityService,
    ManualPaymentService,
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
    ManualClubPaymentsService,
    LoyaltyService,
    LoyaltyLedgerService,
    LoyaltyEarningService,
    LoyaltyReleaseService,
    LoyaltyReversalService,
    LoyaltyOrderService,
    GiftCardPurchaseService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
