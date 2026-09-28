import 'reflect-metadata';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

process.env.PAYMENT_FLOW_MODE = 'manual';
process.env.DEFERRED_FEATURES_ENABLED = 'false';

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

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 201);
  const cookie = cookieHeader(response);
  assert.match(cookie, /nsabores_access=/);
  return cookie;
}

async function json<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  expected = 200,
) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(
      `${path} devolveu HTTP ${response.status}; esperado ${expected}: ${body.slice(0, 500)}`,
    );
  }
  return (await response.json()) as T;
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
    const prisma = app.get(PrismaService);

    const staffCookie = await login(
      baseUrl,
      'demo.staff@nsabores.pt',
      password,
    );
    const customerCookie = await login(
      baseUrl,
      'demo.cliente1@nsabores.pt',
      password,
    );

    const customer = await json<{ id: string; email: string }>(
      baseUrl,
      '/v1/auth/me',
      { headers: { cookie: customerCookie } },
    );

    const catalog = await json<{ data: Array<{ id: string }> }>(
      baseUrl,
      '/v1/products?limit=100',
    );
    const deliveryMethods = await json<
      Array<{ id: string; code: string; isActive: boolean }>
    >(baseUrl, '/v1/delivery-methods');
    const productId = catalog.data[0]?.id;
    const delivery = deliveryMethods.find(
      (method) => method.isActive && method.code !== 'case-by-case',
    );
    assert.ok(productId, 'Produto público necessário para o smoke de arranque.');
    assert.ok(delivery, 'Método de entrega fixo necessário para o smoke.');

    const auditCustomerEmail = `launch-audit-${Date.now()}@example.invalid`;
    const createdCustomer = await json<{
      id: string;
      email: string;
      role: string;
    }>(
      baseUrl,
      '/v1/admin/users/customers',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: staffCookie,
        },
        body: JSON.stringify({
          email: auditCustomerEmail,
          firstName: 'Cliente',
          lastName: 'Auditoria',
          phone: '+351912345678',
          taxNumber: '245123456',
        }),
      },
      201,
    );
    assert.equal(createdCustomer.role, 'CUSTOMER');
    assert.equal(createdCustomer.email, auditCustomerEmail);

    const orderDraft = await json<{
      id: string;
      userId: string | null;
      status: string;
      paymentStatus: string;
    }>(
      baseUrl,
      '/v1/admin/orders',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: staffCookie,
        },
        body: JSON.stringify({
          email: customer.email,
          customerName: 'Cliente Demo',
          phone: '+351912345678',
          shippingAddress: {
            firstName: 'Cliente',
            lastName: 'Demo',
            line1: 'Rua de Teste 1',
            postalCode: '1000-001',
            city: 'Lisboa',
            countryCode: 'PT',
          },
          billingAddress: {
            firstName: 'Cliente',
            lastName: 'Demo',
            line1: 'Rua de Teste 1',
            postalCode: '1000-001',
            city: 'Lisboa',
            countryCode: 'PT',
          },
          deliveryMethodId: delivery.id,
          source: 'DEMO_SEED',
          requiresApproval: false,
          items: [{ productId, quantity: 1 }],
        }),
      },
      201,
    );
    assert.equal(orderDraft.status, 'DRAFT');
    assert.equal(
      orderDraft.userId,
      customer.id,
      'A encomenda manual deve ser associada automaticamente pelo email.',
    );

    const submitted = await json<{ status: string }>(
      baseUrl,
      `/v1/admin/orders/${orderDraft.id}/submit`,
      {
        method: 'POST',
        headers: { cookie: staffCookie },
      },
      201,
    );
    assert.equal(submitted.status, 'PENDING_PAYMENT');

    const customerOrders = await json<Array<{ id: string }>>(
      baseUrl,
      '/v1/account/orders',
      { headers: { cookie: customerCookie } },
    );
    assert.ok(
      customerOrders.some((order) => order.id === orderDraft.id),
      'A encomenda criada na Gestão deve aparecer na área do cliente.',
    );

    const paid = await json<{ status: string; paymentStatus: string }>(
      baseUrl,
      `/v1/admin/orders/${orderDraft.id}/mark-paid`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: staffCookie,
        },
        body: JSON.stringify({
          method: 'transferencia',
          reference: 'LAUNCH-AUDIT',
        }),
      },
      201,
    );
    assert.equal(paid.status, 'PAID');
    assert.equal(paid.paymentStatus, 'PAID');

    for (const status of ['PROCESSING', 'READY', 'DELIVERED']) {
      const updated = await json<{ status: string }>(
        baseUrl,
        `/v1/admin/orders/${orderDraft.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            cookie: staffCookie,
          },
          body: JSON.stringify({ status }),
        },
      );
      assert.equal(updated.status, status);
    }

    const cartResponse = await fetch(`${baseUrl}/v1/cart/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    assert.equal(cartResponse.status, 201);
    const cartCookie = cookieHeader(cartResponse);
    assert.match(cartCookie, /nsabores_cart=/);

    const checkout = await json<{
      id: string;
      status: string;
      paymentStatus: string;
      paymentFlowMode?: string;
    }>(
      baseUrl,
      '/v1/checkout',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cartCookie,
        },
        body: JSON.stringify({
          email: 'guest-launch-audit@example.invalid',
          customerName: 'Cliente Website',
          phone: '+351912345678',
          shippingAddress: {
            firstName: 'Cliente',
            lastName: 'Website',
            line1: 'Rua de Teste 2',
            postalCode: '1000-002',
            city: 'Lisboa',
            countryCode: 'PT',
          },
          billingAddress: {
            firstName: 'Cliente',
            lastName: 'Website',
            line1: 'Rua de Teste 2',
            postalCode: '1000-002',
            city: 'Lisboa',
            countryCode: 'PT',
          },
          deliveryMethodId: delivery.id,
          manualPaymentPreference: 'OPERATOR_CONTACT',
          termsAccepted: true,
          privacyAccepted: true,
          idempotencyKey: `launch-checkout-${Date.now()}`,
        }),
      },
      201,
    );
    assert.equal(checkout.status, 'PENDING_PAYMENT');
    assert.equal(checkout.paymentStatus, 'PENDING');
    assert.equal(checkout.paymentFlowMode, 'manual');
    await prisma.order.update({
      where: { id: checkout.id },
      data: { source: 'DEMO_SEED' },
    });

    const paymentAttempt = await fetch(
      `${baseUrl}/v1/orders/${checkout.id}/payment`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cartCookie,
        },
        body: JSON.stringify({ idempotencyKey: 'launch-payment-disabled' }),
      },
    );
    assert.equal(paymentAttempt.status, 409);

    const phase2Attempt = await fetch(`${baseUrl}/v1/admin/stock`, {
      headers: { cookie: staffCookie },
    });
    assert.equal(phase2Attempt.status, 404);

    const newsletterEmail = `newsletter-launch-${Date.now()}@example.invalid`;
    await json(
      baseUrl,
      '/v1/newsletter',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: newsletterEmail,
          consentAccepted: true,
          source: 'LAUNCH_AUDIT',
        }),
      },
      201,
    );
    const unsubscribe = await json<{ message: string }>(
      baseUrl,
      '/v1/newsletter/unsubscribe',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      },
      201,
    );
    assert.match(unsubscribe.message, /cancelada/i);

    console.log(
      'Launch smoke validado: criação de cliente, associação Cliente ↔ Encomenda, PENDING_PAYMENT, pagamento manual, tratamento até DELIVERED, funcionalidades Fase 2 bloqueadas e unsubscribe público.',
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
