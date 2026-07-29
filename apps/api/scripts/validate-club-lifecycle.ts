import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ClubBillingProvider } from '../src/club/billing.provider';
import { ClubOperationsService } from '../src/club/club-operations.service';
import { ClubService } from '../src/club/club.service';
import { PrismaService } from '../src/prisma.service';

async function main() {
  const prisma = new PrismaService();
  const billing = new ClubBillingProvider(
    new ConfigService({
      CLUB_BILLING_PROVIDER: 'mock',
      CLUB_BILLING_WEBHOOK_SECRET: '',
    }),
  );
  const club = new ClubService(prisma, billing);
  const operations = new ClubOperationsService(prisma, billing, club);
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const users = await Promise.all(
    ['primary', 'trial'].map((kind) =>
      prisma.user.create({
        data: {
          email: `club-smoke-${kind}-${suffix}@example.invalid`,
          passwordHash: 'not-used-by-smoke-test',
          firstName: 'Club',
          lastName: kind === 'primary' ? 'Smoke' : 'Trial',
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  );
  const [user, trialUser] = users;

  const createdPlanIds: string[] = [];
  const subscriptionIds: string[] = [];

  try {
    const monthly = await club.createPlan({
      name: `Clube Mensal ${suffix}`,
      code: `CLUB-MONTHLY-${suffix}`,
      description: 'Plano mensal criado pelo smoke test.',
      status: 'ACTIVE',
      priceCents: 1990,
      billingInterval: 'MONTHLY',
      benefits: { discountPercent: 5 },
      isPublic: true,
      sortOrder: 10,
    });
    const yearly = await club.createPlan({
      name: `Clube Anual ${suffix}`,
      code: `CLUB-YEARLY-${suffix}`,
      description: 'Plano anual criado pelo smoke test.',
      status: 'ACTIVE',
      priceCents: 19900,
      billingInterval: 'YEARLY',
      benefits: { discountPercent: 10 },
      isPublic: true,
      sortOrder: 20,
    });
    const trial = await club.createPlan({
      name: `Clube Trial ${suffix}`,
      code: `CLUB-TRIAL-${suffix}`,
      description: 'Plano experimental criado pelo smoke test.',
      status: 'ACTIVE',
      priceCents: 990,
      billingInterval: 'MONTHLY',
      trialDays: 14,
      benefits: { discountPercent: 3 },
      isPublic: false,
      sortOrder: 30,
    });
    createdPlanIds.push(monthly.id, yearly.id, trial.id);

    const trialJoined = (await club.join(trialUser.id, {
      planCode: trial.code,
      idempotencyKey: `club-smoke:${suffix}:trial`,
    })) as Record<string, unknown>;
    subscriptionIds.push(String(trialJoined.id));
    assert.equal(trialJoined.status, 'TRIALING');
    assert.ok(trialJoined.trialEndsAt);
    assert.equal((trialJoined.charges as unknown[]).length, 0);

    const joined = (await club.join(user.id, {
      planCode: monthly.code,
      idempotencyKey: `club-smoke:${suffix}:join`,
    })) as Record<string, unknown>;
    const subscriptionId = String(joined.id);
    subscriptionIds.push(subscriptionId);
    assert.equal(joined.status, 'ACTIVE');
    assert.equal(joined.planCode, monthly.code);
    assert.equal((joined.charges as unknown[]).length, 1);

    const duplicateJoin = (await club.join(user.id, {
      planCode: monthly.code,
      idempotencyKey: `club-smoke:${suffix}:join`,
    })) as Record<string, unknown>;
    assert.equal(duplicateJoin.id, subscriptionId);

    const changed = (await operations.changePlan(user.id, yearly.code)) as Record<
      string,
      unknown
    >;
    assert.equal(changed.planCode, yearly.code);
    assert.equal(changed.priceCentsSnapshot, 19900);
    assert.equal(changed.billingIntervalSnapshot, 'YEARLY');

    const failedEvent = {
      eventId: `club-smoke:${suffix}:payment-failed`,
      type: 'payment.failed' as const,
      subscriptionId,
    };
    await operations.handleWebhook(failedEvent);
    const duplicateFailure = await operations.handleWebhook(failedEvent);
    assert.equal(duplicateFailure.duplicate, true);

    const pastDue = (await club.subscriptionDetail(subscriptionId)) as Record<
      string,
      unknown
    >;
    assert.equal(pastDue.status, 'PAST_DUE');

    const beforeRenewal = new Date(String(pastDue.currentPeriodEnd));
    await operations.handleWebhook({
      eventId: `club-smoke:${suffix}:renewed`,
      type: 'renewal.succeeded',
      subscriptionId,
    });
    const renewed = (await club.subscriptionDetail(subscriptionId)) as Record<
      string,
      unknown
    >;
    assert.equal(renewed.status, 'ACTIVE');
    assert.ok(new Date(String(renewed.currentPeriodEnd)) > beforeRenewal);
    assert.equal((renewed.charges as unknown[]).length, 2);

    const cancelled = (await operations.scheduleCancel(
      subscriptionId,
      user.id,
      'Smoke test.',
    )) as Record<string, unknown>;
    assert.equal(cancelled.status, 'CANCEL_AT_PERIOD_END');
    assert.equal(cancelled.cancelAtPeriodEnd, true);

    const resumed = (await operations.resume(
      subscriptionId,
      user.id,
      'Smoke test.',
    )) as Record<string, unknown>;
    assert.equal(resumed.status, 'ACTIVE');
    assert.equal(resumed.cancelAtPeriodEnd, false);

    await operations.scheduleCancel(subscriptionId, user.id, 'Effective cancellation.');
    const ended = (await club.renew(
      subscriptionId,
      `club-smoke:${suffix}:cancelled`,
    )) as Record<string, unknown>;
    assert.equal(ended.status, 'CANCELLED');
    assert.equal(ended.cancelAtPeriodEnd, true);

    const events = ended.events as Array<{ type: string }>;
    for (const required of [
      'ACTIVATED',
      'PLAN_CHANGED',
      'PAYMENT_FAILED',
      'RENEWED',
      'CANCEL_SCHEDULED',
      'RESUMED',
      'CANCELLED',
    ]) {
      assert.ok(events.some((event) => event.type === required), `Missing ${required}`);
    }

    console.log('Club lifecycle smoke passed.');
  } finally {
    for (const subscriptionId of subscriptionIds) {
      await prisma.$executeRaw`DELETE FROM "ClubSubscription" WHERE "id" = ${subscriptionId}::uuid`;
    }
    for (const planId of createdPlanIds) {
      await prisma.$executeRaw`DELETE FROM "ClubPlan" WHERE "id" = ${planId}::uuid`;
    }
    await prisma.user.deleteMany({ where: { id: { in: users.map((item) => item.id) } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
