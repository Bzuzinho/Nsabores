import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { AdminUsersController } from './auth/admin-users.controller';
import { AdminBundlesController } from './bundles/bundles.controller';
import { AdminClubController } from './club/club.controller';
import { AdminOrdersController } from './commerce/commerce.controller';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { FiscalController } from './fiscal/fiscal.controller';
import { AdminFulfillmentController } from './fulfillment/fulfillment.controller';
import { AdminGiftCardPurchaseController } from './loyalty/gift-card-purchase.controller';
import { AdminLoyaltyAccountsController } from './loyalty/loyalty-admin.controller';
import { AdminLoyaltyController } from './loyalty/loyalty.controller';
import { AdminOperationsController } from './operations/operations.controller';
import { ProductionController } from './production/production.controller';
import { ProductionService } from './production/production.service';
import { AdminPromotionsController } from './promotions/promotions.controller';
import { ReceivablesController } from './receivables/receivables.controller';

const expectedControllers = [
  AdminCatalogController,
  AdminOrdersController,
  AdminOperationsController,
  AdminFulfillmentController,
  AdminPromotionsController,
  AdminBundlesController,
  AdminClubController,
  AdminLoyaltyController,
  AdminLoyaltyAccountsController,
  AdminGiftCardPurchaseController,
  ReceivablesController,
  ProductionController,
  FiscalController,
  AdminUsersController,
];

describe('management API registration', () => {
  it.each(expectedControllers)('registers $name', (controller) => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AppModule,
    ) as unknown[];
    expect(controllers).toContain(controller);
  });

  it('registers ProductionService through dependency injection', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AppModule,
    ) as unknown[];
    expect(providers).toContain(ProductionService);
  });
});
