import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

const endpoints = [
  '/v1/admin/products?limit=100',
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
] as const;

type SetCookieHeaders = Headers & { getSetCookie?: () => string[] };

function cookieHeader(response: Response) {
  const headers = response.headers as SetCookieHeaders;
  const values = headers.getSetCookie?.() ?? [];
  if (!values.length) {
    const single = response.headers.get('set-cookie');
    if (single) values.push(single);
  }
  return values.map((value) => value.split(';', 1)[0]).join('; ');
}

async function main() {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) throw new Error('DEMO_USER_PASSWORD é obrigatória.');

  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  try {
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const login = await fetch(`${baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'demo.staff@nsabores.pt',
        password,
      }),
    });

    if (!login.ok) {
      const body = await login.text();
      throw new Error(
        `Login demo falhou com HTTP ${login.status}: ${body.slice(0, 500)}`,
      );
    }

    const cookie = cookieHeader(login);
    if (!cookie.includes('nsabores_access=')) {
      throw new Error('O login não devolveu o cookie de acesso.');
    }

    const responses = new Map<string, unknown>();
    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { cookie },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `${endpoint} devolveu HTTP ${response.status}: ${body.slice(0, 300)}`,
        );
      }
      responses.set(endpoint, await response.json());
    }

    const products = responses.get('/v1/admin/products?limit=100') as {
      data?: unknown[];
    };
    const categories = responses.get('/v1/admin/categories') as unknown[];
    const orders = responses.get('/v1/admin/orders') as
      | unknown[]
      | { data?: unknown[] };

    const productCount = products.data?.length ?? 0;
    const categoryCount = Array.isArray(categories) ? categories.length : 0;
    const orderCount = Array.isArray(orders)
      ? orders.length
      : (orders.data?.length ?? 0);

    if (productCount < 12 || categoryCount < 6 || orderCount < 8) {
      throw new Error(
        `Dados demo insuficientes: ${productCount} produtos, ${categoryCount} categorias, ${orderCount} encomendas.`,
      );
    }

    console.log(
      `Management validado: ${endpoints.length} endpoints, ${productCount} produtos, ${categoryCount} categorias e ${orderCount} encomendas.`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
