import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';

const managementEndpoints = [
  '/v1/admin/products?limit=1',
  '/v1/admin/categories',
  '/v1/admin/orders',
  '/v1/admin/operations/dashboard',
  '/v1/admin/operations/preparation',
  '/v1/admin/production',
  '/v1/admin/receivables',
  '/v1/admin/fiscal/documents',
  '/v1/admin/promotions',
  '/v1/admin/coupons',
  '/v1/admin/bundles',
  '/v1/admin/club/plans',
  '/v1/admin/club/subscriptions',
  '/v1/admin/club/pending-charges',
  '/v1/admin/loyalty/rules',
  '/v1/admin/loyalty/accounts',
  '/v1/admin/loyalty/gift-cards',
  '/v1/admin/gift-card-purchases',
  '/v1/admin/stock',
  '/v1/admin/inventories',
  '/v1/admin/suppliers',
  '/v1/admin/purchases',
  '/v1/admin/business-accounts',
  '/v1/admin/reseller-applications',
  '/v1/admin/price-lists',
  '/v1/admin/shipments',
  '/v1/admin/returns',
  '/v1/admin/support-cases',
  '/v1/admin/users',
] as const;

describe('management API route smoke test', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  }, 20_000);

  afterAll(async () => {
    await app.close();
  });

  it.each(managementEndpoints)('%s is mapped and protected', async (path) => {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
    expect(response.status).toBe(401);
  });
});
