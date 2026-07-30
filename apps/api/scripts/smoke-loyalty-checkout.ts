import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { CommerceService } from '../src/commerce/commerce.service';
import { LoyaltyService } from '../src/loyalty/loyalty.service';
import { PrismaService } from '../src/prisma.service';

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_ACCESS_TOKEN_SECRET =
    process.env.AUTH_ACCESS_TOKEN_SECRET ?? 'checkout-smoke-secret-with-more-than-32-characters';
  process.env.PAYMENT_PROVIDER = 'mock';

  const { AppModule } = await import('../src/app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const commerce = app.get(CommerceService);
  const loyalty = app.get(LoyaltyService);
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  const user = await prisma.user.create({
    data: {
      email: `checkout-smoke-${suffix}@example.invalid`,
      passwordHash: 'not-used',
      firstName: 'Checkout',
      lastName: 'Smoke',
      phone: '+351912345678',
      emailVerifiedAt: new Date(),
    },
  });
  const category = await prisma.category.create({
    data: {
      name: `Categoria Smoke ${suffix}`,
      slug: `categoria-smoke-${suffix.toLowerCase()}`,
      isActive: true,
    },
  });
  const product = await prisma.product.create({
    data: {
      name: `Produto Smoke ${suffix}`,
      slug: `produto-smoke-${suffix.toLowerCase()}`,
      shortDescription: 'Produto do smoke de checkout.',
      sku: `SMOKE-${suffix}`,
      priceCents: 5000,
      imageUrl: '/placeholder.png',
      categoryId: category.id,
      isActive: true,
      stockStatus: 'IN_STOCK',
      stockItem: {
        create: {
          onHandQuantity: 10,
          reservedQuantity: 0,
          trackStock: true,
        },
      },
    },
  });
  const delivery = await prisma.deliveryMethod.create({
    data: {
      code: `SMOKE-${suffix}`,
      name: 'Entrega Smoke',
      type: 'STANDARD',
      isActive: true,
      priceCents: 0,
    },
  });

  await loyalty.createRule({
    name: `Regra Checkout ${suffix}`,
    code: `CHECKOUT-${suffix}`,
    isActive: true,
    channel: 'B2C',
    pointsPerEuro: 1,
    clubMultiplierBasisPoints: 10000,
    minimumOrderCents: 0,
    maximumPointsPerOrder: 1000,
    pendingDays: 14,
    configuration: {},
  });
  await loyalty.adjust(user.id, {
    points: 1000,
    note: 'Saldo do smoke de checkout.',
    idempotencyKey: `checkout:${suffix}:points`,
  });
  const giftCard = (await loyalty.issueGiftCard(
    {
      initialAmountCents: 2000,
      recipientEmail: user.email,
      recipientName: `${user.firstName} ${user.lastName}`,
      idempotencyKey: `checkout:${suffix}:gift-card`,
    },
    user.id,
  )) as Record<string, unknown>;

  await commerce.addItem({ userId: user.id }, product.id, 1);
  const order = (await commerce.checkout(
    { userId: user.id },
    {
      email: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
      phone: user.phone!,
      shippingAddress: {
        firstName: user.firstName,
        lastName: user.lastName,
        line1: 'Rua do Smoke 1',
        postalCode: '1000-001',
        city: 'Lisboa',
        countryCode: 'PT',
      },
      billingAddress: {
        firstName: user.firstName,
        lastName: user.lastName,
        line1: 'Rua do Smoke 1',
        postalCode: '1000-001',
        city: 'Lisboa',
        countryCode: 'PT',
      },
      deliveryMethodId: delivery.id,
      termsAccepted: true,
      privacyAccepted: true,
      idempotencyKey: `checkout:${suffix}:order`,
      loyaltyPoints: 1000,
      giftCardCode: String(giftCard.code),
    },
  )) as Record<string, unknown>;

  assert.equal(order.totalCents, 2000);
  const benefits = order.benefits as {
    loyalty: { status: string; points: number };
    giftCard: { status: string; amountCents: number };
  };
  assert.equal(benefits.loyalty.status, 'RESERVED');
  assert.equal(benefits.loyalty.points, 1000);
  assert.equal(benefits.giftCard.status, 'RESERVED');
  assert.equal(benefits.giftCard.amountCents, 2000);

  const payment = await commerce.startPayment(
    String(order.id),
    user.id,
    `checkout:${suffix}:payment`,
  );
  await commerce.confirmMock(payment.providerPaymentId);

  const paid = await prisma.order.findUniqueOrThrow({
    where: { id: String(order.id) },
  });
  assert.equal(paid.status, 'PAID');
  assert.equal(paid.paymentStatus, 'PAID');

  const applications = await prisma.$queryRaw<
    Array<{ loyaltyStatus: string; giftCardStatus: string }>
  >`
    SELECT ola."status"::text AS "loyaltyStatus", oga."status"::text AS "giftCardStatus"
    FROM "OrderLoyaltyApplication" ola
    JOIN "OrderGiftCardApplication" oga ON oga."orderId" = ola."orderId"
    WHERE ola."orderId" = ${String(order.id)}::uuid
  `;
  assert.equal(applications[0]?.loyaltyStatus, 'CONSUMED');
  assert.equal(applications[0]?.giftCardStatus, 'CONSUMED');

  const account = (await loyalty.account(user.id)) as Record<string, unknown>;
  assert.equal(account.availablePoints, 0);
  assert.equal(account.reservedPoints, 0);
  assert.equal(account.pendingPoints, 40);

  const card = (await loyalty.lookupGiftCard(String(giftCard.code))) as Record<
    string,
    unknown
  >;
  assert.equal(card.balanceCents, 0);
  assert.equal(card.reservedCents, 0);
  assert.equal(card.status, 'DEPLETED');

  console.log('Full loyalty checkout smoke passed.');
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
