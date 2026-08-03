import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ClubService } from './club/club.service';
import { ManualClubPaymentsService } from './club/manual-club-payments.service';
import { PrismaService } from './prisma.service';

type ChargeSummary = {
  id: string;
  status: string;
  periodStart: Date;
};

type SubscriptionDetail = {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  charges: ChargeSummary[];
  events: Array<{ type: string }>;
};

function subscriptionDetail(value: unknown): SubscriptionDetail {
  return value as SubscriptionDetail;
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_ACCESS_TOKEN_SECRET =
    process.env.AUTH_ACCESS_TOKEN_SECRET ??
    'manual-club-smoke-secret-with-more-than-32-characters';
  process.env.PAYMENT_FLOW_MODE = 'manual';
  process.env.CLUB_BILLING_PROVIDER = 'mock';

  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const prisma = app.get(PrismaService);
  const club = app.get(ClubService);
  const manual = app.get(ManualClubPaymentsService);

  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const user = await prisma.user.create({
    data: {
      email: `manual-club-${suffix}@example.invalid`,
      passwordHash: 'not-used',
      firstName: 'Manual',
      lastName: 'Club',
      emailVerifiedAt: new Date(),
    },
  });

  const plan = (await club.createPlan({
    name: `Plano Manual ${suffix}`,
    code: `MANUAL-${suffix}`,
    description: 'Plano para smoke do pagamento manual.',
    status: 'ACTIVE',
    priceCents: 2500,
    billingInterval: 'MONTHLY',
    benefits: { discountPercent: 5 },
    isPublic: true,
    sortOrder: 999,
  })) as { code: string };

  const joined = subscriptionDetail(
    await manual.join(user.id, {
      planCode: plan.code,
      idempotencyKey: `manual-club:${suffix}:join`,
    }),
  );

  assert.equal(joined.status, 'PENDING_ACTIVATION');
  assert.equal(joined.charges.length, 1);
  assert.equal(joined.charges[0]?.status, 'PENDING');

  const firstChargeId = joined.charges[0]!.id;
  await manual.confirmCharge(
    joined.id,
    firstChargeId,
    user.id,
    `SMOKE-${suffix}`,
    'Confirmação inicial do smoke.',
  );
  await manual.confirmCharge(
    joined.id,
    firstChargeId,
    user.id,
    `SMOKE-${suffix}`,
    'Confirmação idempotente repetida.',
  );

  const active = subscriptionDetail(await club.subscriptionDetail(joined.id));
  assert.equal(active.status, 'ACTIVE');
  assert.equal(
    active.charges.find(({ id }) => id === firstChargeId)?.status,
    'PAID',
  );
  assert.equal(
    active.events.filter(({ type }) => type === 'PAYMENT_CONFIRMED').length,
    1,
  );

  const firstPeriodEnd = new Date(active.currentPeriodEnd);
  await manual.requestRenewal(joined.id);
  await manual.requestRenewal(joined.id);

  const renewalPending = subscriptionDetail(
    await club.subscriptionDetail(joined.id),
  );
  const pendingRenewals = renewalPending.charges.filter(
    ({ status }) => status === 'PENDING',
  );
  assert.equal(pendingRenewals.length, 1);
  assert.equal(
    new Date(pendingRenewals[0]!.periodStart).toISOString(),
    firstPeriodEnd.toISOString(),
  );

  await manual.confirmCharge(
    joined.id,
    pendingRenewals[0]!.id,
    user.id,
    `RENEW-${suffix}`,
    'Renovação confirmada no smoke.',
  );

  const renewed = subscriptionDetail(await club.subscriptionDetail(joined.id));
  assert.equal(renewed.status, 'ACTIVE');
  assert.equal(
    new Date(renewed.currentPeriodStart).toISOString(),
    firstPeriodEnd.toISOString(),
  );
  assert.ok(new Date(renewed.currentPeriodEnd) > firstPeriodEnd);
  assert.equal(
    renewed.charges.filter(({ status }) => status === 'PENDING').length,
    0,
  );

  console.log('Manual Club payment lifecycle smoke passed.');
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
