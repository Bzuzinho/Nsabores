import 'reflect-metadata';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

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

type AuthMe = {
  id: string;
  email: string;
  role: string;
};

type PublicProduct = {
  id: string;
};

type DeliveryMethod = {
  id: string;
  code: string;
};

type ManualOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  shippingCents: number;
  totalCents: number;
  paymentTermsSnapshot?: {
    preference?: string;
    shippingQuoteStatus?: string;
    shippingQuoteCents?: number | null;
  } | null;
};

function cookieHeader(response: Response) {
  const headers = response.headers as SetCookieHeaders;
  const values = headers.getSetCookie?.() ?? [];
  if (!values.length) {
    const single = response.headers.get('set-cookie');
    if (single) values.push(single);
  }
  return values.map((value) => value.split(';', 1)[0]).join('; ');
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Login de ${email} falhou com HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }
  const cookie = cookieHeader(response);
  assert.match(cookie, /nsabores_access=/);
  return cookie;
}

async function validateManualCheckout(
  baseUrl: string,
  staffCookie: string,
  products: PublicProduct[],
) {
  const deliveryResponse = await fetch(`${baseUrl}/v1/delivery-methods`);
  assert.equal(deliveryResponse.status, 200);
  const deliveryMethods = (await deliveryResponse.json()) as DeliveryMethod[];
  const caseByCase = deliveryMethods.find(
    ({ code }) => code === 'case-by-case',
  );
  assert.ok(caseByCase, 'Método de transporte caso a caso não disponível.');
  assert.ok(products[0]?.id, 'Produto público não disponível para checkout.');

  const cartResponse = await fetch(`${baseUrl}/v1/cart/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: products[0].id, quantity: 1 }),
  });
  assert.equal(cartResponse.status, 201);
  const cartCookie = cookieHeader(cartResponse);
  assert.match(cartCookie, /nsabores_cart=/);

  const checkoutResponse = await fetch(`${baseUrl}/v1/checkout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: cartCookie,
    },
    body: JSON.stringify({
      email: 'e2e.manual@example.invalid',
      customerName: 'Cliente Manual E2E',
      phone: '+351912345678',
      shippingAddress: {
        firstName: 'Cliente',
        lastName: 'Manual',
        line1: 'Rua de Teste 1',
        postalCode: '1000-001',
        city: 'Lisboa',
        countryCode: 'PT',
      },
      billingAddress: {
        firstName: 'Cliente',
        lastName: 'Manual',
        line1: 'Rua de Teste 1',
        postalCode: '1000-001',
        city: 'Lisboa',
        countryCode: 'PT',
      },
      deliveryMethodId: caseByCase.id,
      manualPaymentPreference: 'CARRIER_COD',
      termsAccepted: true,
      privacyAccepted: true,
      idempotencyKey: `e2e-manual-${Date.now()}`,
    }),
  });
  assert.equal(checkoutResponse.status, 201);
  const order = (await checkoutResponse.json()) as ManualOrder;
  assert.equal(order.status, 'PROCESSING');
  assert.equal(order.paymentStatus, 'PENDING');
  assert.equal(order.shippingCents, 0);
  assert.equal(order.paymentTermsSnapshot?.preference, 'CARRIER_COD');
  assert.equal(order.paymentTermsSnapshot?.shippingQuoteStatus, 'PENDING');

  const digitalPaymentResponse = await fetch(
    `${baseUrl}/v1/orders/${order.id}/payment`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cartCookie,
      },
      body: JSON.stringify({ idempotencyKey: `e2e-payment-${Date.now()}` }),
    },
  );
  assert.equal(digitalPaymentResponse.status, 409);

  const shippingResponse = await fetch(
    `${baseUrl}/v1/admin/orders/${order.id}/shipping-quote`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: staffCookie,
      },
      body: JSON.stringify({
        amountCents: 725,
        note: 'Transportadora escolhida caso a caso no E2E.',
      }),
    },
  );
  assert.equal(shippingResponse.status, 200);
  const quoted = (await shippingResponse.json()) as ManualOrder;
  assert.equal(quoted.shippingCents, 725);
  assert.equal(quoted.totalCents, order.totalCents + 725);
  assert.equal(quoted.paymentTermsSnapshot?.shippingQuoteStatus, 'CONFIRMED');
  assert.equal(quoted.paymentTermsSnapshot?.shippingQuoteCents, 725);
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

    const unauthenticated = await fetch(`${baseUrl}/v1/admin/products?limit=1`);
    assert.equal(unauthenticated.status, 401);

    const publicCatalog = await fetch(`${baseUrl}/v1/products?limit=100`);
    assert.equal(publicCatalog.status, 200);
    const publicProducts = (await publicCatalog.json()) as {
      data?: PublicProduct[];
    };
    assert.ok((publicProducts.data?.length ?? 0) >= 12);

    const staffCookie = await login(
      baseUrl,
      'demo.staff@nsabores.pt',
      password,
    );
    const staffMeResponse = await fetch(`${baseUrl}/v1/auth/me`, {
      headers: { cookie: staffCookie },
    });
    assert.equal(staffMeResponse.status, 200);
    const staffMe = (await staffMeResponse.json()) as AuthMe;
    assert.equal(staffMe.role, 'STAFF');

    const customerCookie = await login(
      baseUrl,
      'demo.cliente1@nsabores.pt',
      password,
    );
    const forbidden = await fetch(`${baseUrl}/v1/admin/orders`, {
      headers: { cookie: customerCookie },
    });
    assert.equal(forbidden.status, 403);

    await validateManualCheckout(
      baseUrl,
      staffCookie,
      publicProducts.data ?? [],
    );

    const responses = new Map<string, unknown>();
    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { cookie: staffCookie },
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
      unknown[] | { data?: unknown[] };
    const operations = responses.get(
      '/v1/admin/operations/dashboard',
    ) as Record<string, unknown>;
    const production = responses.get('/v1/admin/production') as unknown[];

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
    assert.ok(Object.keys(operations).length > 0);
    assert.ok(Array.isArray(production));
    assert.ok(production.length >= 3);

    console.log(
      `E2E validado: autenticação, permissões, checkout manual, transporte caso a caso, catálogo público, ${endpoints.length} endpoints administrativos, ${productCount} produtos, ${categoryCount} categorias e ${orderCount} encomendas.`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
