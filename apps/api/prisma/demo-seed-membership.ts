import { createHash } from 'node:crypto';
import {
  db,
  day,
  findOrCreate,
  now,
  prisma,
  requiredOrder,
  requiredUser,
} from './demo-shared';

async function seedClub() {
  const admin = await requiredUser('demo.admin@nsabores.pt');
  const customers = await db.user.findMany({
    where: { email: { startsWith: 'demo.cliente' } },
    orderBy: { email: 'asc' },
  });
  const specs = [
    ['DEMO-ESSENCIAL', 'Clube Essencial Demo', 990, 'MONTHLY', null, 10],
    ['DEMO-DESCOBERTA', 'Clube Descoberta Demo', 2490, 'QUARTERLY', 14, 15],
    ['DEMO-PREMIUM', 'Clube Premium Demo', 8990, 'YEARLY', 30, 20],
  ] as const;
  const plans: any[] = [];
  for (const [index, [code, name, priceCents, billingInterval, trialDays, discountPercent]] of specs.entries()) {
    plans.push(
      await db.clubPlan.upsert({
        where: { code },
        update: {
          name,
          description: 'Plano criado pelo ambiente de demonstração.',
          status: 'ACTIVE',
          priceCents,
          currency: 'EUR',
          billingInterval,
          trialDays,
          benefits: {
            discountPercent,
            freeShippingAboveCents: 3500,
            pointsMultiplier: discountPercent >= 20 ? 2 : 1.5,
          },
          isPublic: true,
          sortOrder: index,
        },
        create: {
          name,
          code,
          description: 'Plano criado pelo ambiente de demonstração.',
          status: 'ACTIVE',
          priceCents,
          currency: 'EUR',
          billingInterval,
          trialDays,
          benefits: {
            discountPercent,
            freeShippingAboveCents: 3500,
            pointsMultiplier: discountPercent >= 20 ? 2 : 1.5,
          },
          isPublic: true,
          sortOrder: index,
        },
      }),
    );
  }

  const subscriptions: any[] = [];
  const statuses = ['ACTIVE', 'PENDING_ACTIVATION', 'TRIALING', 'PAST_DUE'] as const;
  for (const [index, customer] of customers.slice(0, 4).entries()) {
    const plan = plans[index % plans.length];
    const status = statuses[index];
    const existing = await db.clubSubscription.findFirst({
      where: { userId: customer.id, planId: plan.id },
    });
    const data = {
      userId: customer.id,
      planId: plan.id,
      status,
      provider: 'mock',
      providerCustomerId: `demo-club-customer-${index + 1}`,
      providerSubscriptionId: `demo-club-subscription-${index + 1}`,
      currentPeriodStart: day(-15),
      currentPeriodEnd: day(15),
      trialEndsAt: status === 'TRIALING' ? day(14) : null,
      cancelAtPeriodEnd: false,
      priceCentsSnapshot: plan.priceCents,
      currencySnapshot: 'EUR',
      billingIntervalSnapshot: plan.billingInterval,
      planSnapshot: {
        name: plan.name,
        code: plan.code,
        benefits: plan.benefits,
        demo: true,
      },
    };
    const subscription = existing
      ? await db.clubSubscription.update({ where: { id: existing.id }, data })
      : await db.clubSubscription.create({ data });
    subscriptions.push(subscription);

    const eventType =
      status === 'ACTIVE'
        ? 'ACTIVATED'
        : status === 'TRIALING'
          ? 'TRIAL_STARTED'
          : status === 'PAST_DUE'
            ? 'PAYMENT_FAILED'
            : 'CREATED';
    await findOrCreate(
      db.clubSubscriptionEvent,
      {
        subscriptionId: subscription.id,
        providerEventId: `demo-club-event-${index + 1}`,
      },
      {
        subscriptionId: subscription.id,
        type: eventType,
        fromStatus: null,
        toStatus: status,
        providerEventId: `demo-club-event-${index + 1}`,
        authorId: admin.id,
        note: 'Evento de subscrição demonstrativo.',
        payload: { demo: true },
      },
    );

    if (status !== 'TRIALING') {
      const chargeStatus =
        status === 'ACTIVE' ? 'PAID' : status === 'PAST_DUE' ? 'FAILED' : 'PENDING';
      await db.clubSubscriptionCharge.upsert({
        where: { idempotencyKey: `demo:club-charge:${index + 1}` },
        update: {
          subscriptionId: subscription.id,
          periodStart: day(-15),
          periodEnd: day(15),
          amountCents: plan.priceCents,
          currency: 'EUR',
          status: chargeStatus,
          provider: 'mock',
          providerPaymentId: `demo-club-payment-${index + 1}`,
          paidAt: chargeStatus === 'PAID' ? day(-14) : null,
          failedAt: chargeStatus === 'FAILED' ? day(-2) : null,
          metadata: { demo: true },
        },
        create: {
          subscriptionId: subscription.id,
          periodStart: day(-15),
          periodEnd: day(15),
          amountCents: plan.priceCents,
          currency: 'EUR',
          status: chargeStatus,
          provider: 'mock',
          providerPaymentId: `demo-club-payment-${index + 1}`,
          idempotencyKey: `demo:club-charge:${index + 1}`,
          paidAt: chargeStatus === 'PAID' ? day(-14) : null,
          failedAt: chargeStatus === 'FAILED' ? day(-2) : null,
          metadata: { demo: true },
        },
      });
    }
  }
  return subscriptions;
}

async function seedLoyalty() {
  const customers = await db.user.findMany({
    where: { email: { startsWith: 'demo.cliente' } },
    orderBy: { email: 'asc' },
  });
  const rule = await db.loyaltyRule.upsert({
    where: { code: 'DEMO-PONTOS-BASE' },
    update: {
      name: 'Regra base de pontos Demo',
      isActive: true,
      channel: null,
      pointsPerEuro: 10,
      clubMultiplierBasisPoints: 15000,
      minimumOrderCents: 1000,
      maximumPointsPerOrder: 5000,
      pendingDays: 7,
      validFrom: day(-30),
      validUntil: day(365),
      configuration: { demo: true },
    },
    create: {
      name: 'Regra base de pontos Demo',
      code: 'DEMO-PONTOS-BASE',
      isActive: true,
      channel: null,
      pointsPerEuro: 10,
      clubMultiplierBasisPoints: 15000,
      minimumOrderCents: 1000,
      maximumPointsPerOrder: 5000,
      pendingDays: 7,
      validFrom: day(-30),
      validUntil: day(365),
      configuration: { demo: true },
    },
  });

  for (const [index, customer] of customers.entries()) {
    const availablePoints = 500 + index * 250;
    const pendingPoints = 100 + index * 50;
    const reservedPoints = index === 1 ? 100 : 0;
    const account = await db.loyaltyAccount.upsert({
      where: { userId: customer.id },
      update: {
        status: 'ACTIVE',
        availablePoints,
        pendingPoints,
        reservedPoints,
        lifetimeEarnedPoints: availablePoints + pendingPoints + 500,
        lifetimeRedeemedPoints: 500,
        tier: index >= 3 ? 'OURO' : index >= 1 ? 'PRATA' : 'BRONZE',
      },
      create: {
        userId: customer.id,
        status: 'ACTIVE',
        availablePoints,
        pendingPoints,
        reservedPoints,
        lifetimeEarnedPoints: availablePoints + pendingPoints + 500,
        lifetimeRedeemedPoints: 500,
        tier: index >= 3 ? 'OURO' : index >= 1 ? 'PRATA' : 'BRONZE',
      },
    });
    const order = await db.order.findUnique({
      where: { number: `DEMO-${String(index + 2).padStart(4, '0')}` },
    });
    await db.loyaltyTransaction.upsert({
      where: { idempotencyKey: `demo:loyalty:earn:${index + 1}` },
      update: {
        accountId: account.id,
        orderId: order?.id,
        ruleId: rule.id,
        type: 'EARN_RELEASED',
        status: 'AVAILABLE',
        points: availablePoints,
        availableBalanceAfter: availablePoints,
        pendingBalanceAfter: pendingPoints,
        reservedBalanceAfter: reservedPoints,
        availableAt: day(-5),
        note: 'Movimento de pontos demonstrativo.',
        metadata: { demo: true },
      },
      create: {
        accountId: account.id,
        orderId: order?.id,
        ruleId: rule.id,
        type: 'EARN_RELEASED',
        status: 'AVAILABLE',
        points: availablePoints,
        availableBalanceAfter: availablePoints,
        pendingBalanceAfter: pendingPoints,
        reservedBalanceAfter: reservedPoints,
        availableAt: day(-5),
        idempotencyKey: `demo:loyalty:earn:${index + 1}`,
        note: 'Movimento de pontos demonstrativo.',
        metadata: { demo: true },
      },
    });
  }
}

async function seedGiftCards() {
  const customers = await db.user.findMany({
    where: { email: { startsWith: 'demo.cliente' } },
    orderBy: { email: 'asc' },
  });
  const cards: any[] = [];
  for (const [index, amount] of [2500, 5000, 10000].entries()) {
    const plainCode = `NS-DEMO-${index + 1}-2026`;
    const codeHash = createHash('sha256')
      .update(plainCode.toUpperCase())
      .digest('hex');
    const card = await db.giftCard.upsert({
      where: { codeHash },
      update: {
        codeLast4: plainCode.slice(-4),
        status: index === 2 ? 'BLOCKED' : 'ACTIVE',
        initialAmountCents: amount,
        balanceCents: index === 1 ? amount - 1500 : amount,
        reservedCents: index === 0 ? 500 : 0,
        purchaserUserId: customers[index]?.id,
        recipientEmail: `destinatario${index + 1}.demo@example.pt`,
        recipientName: `Destinatário Demo ${index + 1}`,
        message: 'Vale-oferta criado pelo ambiente de demonstração.',
        expiresAt: day(365),
        activatedAt: day(-10),
        blockedAt: index === 2 ? day(-1) : null,
        blockReason: index === 2 ? 'Bloqueio demonstrativo.' : null,
      },
      create: {
        codeHash,
        codeLast4: plainCode.slice(-4),
        status: index === 2 ? 'BLOCKED' : 'ACTIVE',
        initialAmountCents: amount,
        balanceCents: index === 1 ? amount - 1500 : amount,
        reservedCents: index === 0 ? 500 : 0,
        currency: 'EUR',
        purchaserUserId: customers[index]?.id,
        recipientEmail: `destinatario${index + 1}.demo@example.pt`,
        recipientName: `Destinatário Demo ${index + 1}`,
        message: 'Vale-oferta criado pelo ambiente de demonstração.',
        expiresAt: day(365),
        activatedAt: day(-10),
        blockedAt: index === 2 ? day(-1) : null,
        blockReason: index === 2 ? 'Bloqueio demonstrativo.' : null,
      },
    });
    cards.push(card);
    await db.giftCardTransaction.upsert({
      where: { idempotencyKey: `demo:gift-card:issue:${index + 1}` },
      update: {
        giftCardId: card.id,
        type: 'ISSUE',
        status: 'COMPLETED',
        amountCents: amount,
        balanceAfterCents: amount,
        reservedAfterCents: 0,
        note: 'Emissão demonstrativa.',
        metadata: { demo: true },
      },
      create: {
        giftCardId: card.id,
        type: 'ISSUE',
        status: 'COMPLETED',
        amountCents: amount,
        balanceAfterCents: amount,
        reservedAfterCents: 0,
        idempotencyKey: `demo:gift-card:issue:${index + 1}`,
        note: 'Emissão demonstrativa.',
        metadata: { demo: true },
      },
    });
  }

  for (const [index, status] of ['PAID', 'PENDING_PAYMENT'].entries()) {
    await db.giftCardPurchase.upsert({
      where: { idempotencyKey: `demo:gift-card-purchase:${index + 1}` },
      update: {
        purchaserUserId: customers[index]?.id,
        purchaserEmail: customers[index]?.email,
        recipientEmail: `presente${index + 1}.demo@example.pt`,
        recipientName: `Presente Demo ${index + 1}`,
        message: 'Mensagem de oferta demonstrativa.',
        amountCents: index === 0 ? 5000 : 7500,
        status,
        provider: 'mock',
        providerPaymentId: `demo-gift-purchase-payment-${index + 1}`,
        giftCardId: status === 'PAID' ? cards[index].id : null,
        paidAt: status === 'PAID' ? day(-2) : null,
      },
      create: {
        purchaserUserId: customers[index]?.id,
        purchaserEmail: customers[index]?.email,
        recipientEmail: `presente${index + 1}.demo@example.pt`,
        recipientName: `Presente Demo ${index + 1}`,
        message: 'Mensagem de oferta demonstrativa.',
        amountCents: index === 0 ? 5000 : 7500,
        currency: 'EUR',
        status,
        provider: 'mock',
        providerPaymentId: `demo-gift-purchase-payment-${index + 1}`,
        giftCardId: status === 'PAID' ? cards[index].id : null,
        idempotencyKey: `demo:gift-card-purchase:${index + 1}`,
        paidAt: status === 'PAID' ? day(-2) : null,
      },
    });
  }
}

async function seedFiscal(subscriptions: any[]) {
  const admin = await requiredUser('demo.admin@nsabores.pt');
  const year = now.getUTCFullYear();
  const invoiceSeries = await db.fiscalSeries.upsert({
    where: {
      code_documentType_year: {
        code: 'DEMO-FR',
        documentType: 'INVOICE_RECEIPT',
        year,
      },
    },
    update: { prefix: 'DEMO-FR', nextNumber: 20, isActive: true },
    create: {
      code: 'DEMO-FR',
      documentType: 'INVOICE_RECEIPT',
      prefix: 'DEMO-FR',
      year,
      nextNumber: 20,
      isActive: true,
    },
  });
  const creditSeries = await db.fiscalSeries.upsert({
    where: {
      code_documentType_year: {
        code: 'DEMO-NC',
        documentType: 'CREDIT_NOTE',
        year,
      },
    },
    update: { prefix: 'DEMO-NC', nextNumber: 10, isActive: true },
    create: {
      code: 'DEMO-NC',
      documentType: 'CREDIT_NOTE',
      prefix: 'DEMO-NC',
      year,
      nextNumber: 10,
      isActive: true,
    },
  });

  const orderNumbers = ['DEMO-0002', 'DEMO-0003', 'DEMO-0004', 'DEMO-0005', 'DEMO-0006'];
  const documents: any[] = [];
  for (const [index, number] of orderNumbers.entries()) {
    const order = await requiredOrder(number);
    const document = await db.fiscalDocument.upsert({
      where: { idempotencyKey: `demo:fiscal:order:${order.id}` },
      update: {
        seriesId: invoiceSeries.id,
        type: 'INVOICE_RECEIPT',
        status: index === 4 ? 'CREDITED' : 'ISSUED',
        sourceType: 'ORDER',
        sourceId: order.id,
        customerUserId: order.userId,
        sequentialNumber: index + 1,
        number: `DEMO-FR ${year}/${String(index + 1).padStart(6, '0')}`,
        currency: 'EUR',
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        customerSnapshot: { name: order.customerName, email: order.email, demo: true },
        billingSnapshot: order.billingAddress,
        metadata: { demo: true, source: 'DEMO_SEED' },
        externalNumber: `EXT-DEMO-${index + 1}`,
        externalDocumentUrl: `https://documents.invalid/demo-${index + 1}.pdf`,
        provider: 'manual',
        providerReference: `DEMO-PROVIDER-${index + 1}`,
        issuedAt: day(-5 + index),
        createdById: admin.id,
      },
      create: {
        seriesId: invoiceSeries.id,
        type: 'INVOICE_RECEIPT',
        status: index === 4 ? 'CREDITED' : 'ISSUED',
        sourceType: 'ORDER',
        sourceId: order.id,
        idempotencyKey: `demo:fiscal:order:${order.id}`,
        customerUserId: order.userId,
        sequentialNumber: index + 1,
        number: `DEMO-FR ${year}/${String(index + 1).padStart(6, '0')}`,
        currency: 'EUR',
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        customerSnapshot: { name: order.customerName, email: order.email, demo: true },
        billingSnapshot: order.billingAddress,
        metadata: { demo: true, source: 'DEMO_SEED' },
        externalNumber: `EXT-DEMO-${index + 1}`,
        externalDocumentUrl: `https://documents.invalid/demo-${index + 1}.pdf`,
        provider: 'manual',
        providerReference: `DEMO-PROVIDER-${index + 1}`,
        issuedAt: day(-5 + index),
        createdById: admin.id,
      },
    });
    documents.push(document);
    const items = await db.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    for (const [position, item] of items.entries()) {
      await db.fiscalDocumentLine.upsert({
        where: { documentId_position: { documentId: document.id, position: position + 1 } },
        update: {
          description: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          discountCents: 0,
          taxRateBasisPoints: 0,
          taxCents: 0,
          totalCents: item.totalCents,
          sourceLineId: item.id,
          snapshot: { demo: true },
        },
        create: {
          documentId: document.id,
          position: position + 1,
          description: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          discountCents: 0,
          taxRateBasisPoints: 0,
          taxCents: 0,
          totalCents: item.totalCents,
          sourceLineId: item.id,
          snapshot: { demo: true },
        },
      });
    }
    await findOrCreate(
      db.fiscalDocumentEvent,
      { documentId: document.id, type: 'ISSUED', note: 'Emissão demonstrativa.' },
      {
        documentId: document.id,
        type: 'ISSUED',
        authorId: admin.id,
        note: 'Emissão demonstrativa.',
        payload: { demo: true },
      },
    );
  }

  const original = documents[4];
  if (original) {
    const credit = await db.fiscalDocument.upsert({
      where: { idempotencyKey: 'demo:fiscal:credit-note:1' },
      update: {
        seriesId: creditSeries.id,
        type: 'CREDIT_NOTE',
        status: 'ISSUED',
        sourceType: 'MANUAL',
        sourceId: null,
        customerUserId: original.customerUserId,
        parentDocumentId: original.id,
        sequentialNumber: 1,
        number: `DEMO-NC ${year}/000001`,
        currency: 'EUR',
        subtotalCents: -1000,
        discountCents: 0,
        taxCents: 0,
        totalCents: -1000,
        customerSnapshot: original.customerSnapshot,
        billingSnapshot: original.billingSnapshot,
        metadata: { demo: true, reason: 'Crédito demonstrativo.' },
        provider: 'manual',
        issuedAt: now,
        createdById: admin.id,
      },
      create: {
        seriesId: creditSeries.id,
        type: 'CREDIT_NOTE',
        status: 'ISSUED',
        sourceType: 'MANUAL',
        sourceId: null,
        idempotencyKey: 'demo:fiscal:credit-note:1',
        customerUserId: original.customerUserId,
        parentDocumentId: original.id,
        sequentialNumber: 1,
        number: `DEMO-NC ${year}/000001`,
        currency: 'EUR',
        subtotalCents: -1000,
        discountCents: 0,
        taxCents: 0,
        totalCents: -1000,
        customerSnapshot: original.customerSnapshot,
        billingSnapshot: original.billingSnapshot,
        metadata: { demo: true, reason: 'Crédito demonstrativo.' },
        provider: 'manual',
        issuedAt: now,
        createdById: admin.id,
      },
    });
    await db.fiscalDocumentLine.upsert({
      where: { documentId_position: { documentId: credit.id, position: 1 } },
      update: {
        description: 'Crédito parcial demonstrativo',
        quantity: 1,
        unitPriceCents: -1000,
        totalCents: -1000,
        snapshot: { demo: true },
      },
      create: {
        documentId: credit.id,
        position: 1,
        description: 'Crédito parcial demonstrativo',
        quantity: 1,
        unitPriceCents: -1000,
        totalCents: -1000,
        snapshot: { demo: true },
      },
    });
  }

  const purchase = await db.giftCardPurchase.findFirst({
    where: { idempotencyKey: 'demo:gift-card-purchase:1' },
  });
  if (purchase) {
    await db.fiscalDocument.upsert({
      where: { idempotencyKey: 'demo:fiscal:gift-card-purchase:1' },
      update: {
        seriesId: invoiceSeries.id,
        type: 'INVOICE_RECEIPT',
        status: 'ISSUED',
        sourceType: 'GIFT_CARD_PURCHASE',
        sourceId: purchase.id,
        sequentialNumber: 10,
        number: `DEMO-FR ${year}/000010`,
        currency: 'EUR',
        subtotalCents: purchase.amountCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: purchase.amountCents,
        customerSnapshot: { email: purchase.purchaserEmail, demo: true },
        billingSnapshot: {},
        metadata: { demo: true },
        provider: 'manual',
        issuedAt: now,
        createdById: admin.id,
      },
      create: {
        seriesId: invoiceSeries.id,
        type: 'INVOICE_RECEIPT',
        status: 'ISSUED',
        sourceType: 'GIFT_CARD_PURCHASE',
        sourceId: purchase.id,
        idempotencyKey: 'demo:fiscal:gift-card-purchase:1',
        sequentialNumber: 10,
        number: `DEMO-FR ${year}/000010`,
        currency: 'EUR',
        subtotalCents: purchase.amountCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: purchase.amountCents,
        customerSnapshot: { email: purchase.purchaserEmail, demo: true },
        billingSnapshot: {},
        metadata: { demo: true },
        provider: 'manual',
        issuedAt: now,
        createdById: admin.id,
      },
    });
  }

  const activeSubscription = subscriptions[0];
  const charge = activeSubscription
    ? await db.clubSubscriptionCharge.findFirst({
        where: { subscriptionId: activeSubscription.id, status: 'PAID' },
      })
    : null;
  if (charge) {
    await db.fiscalDocument.upsert({
      where: { idempotencyKey: 'demo:fiscal:club-charge:1' },
      update: {
        seriesId: invoiceSeries.id,
        type: 'INVOICE_RECEIPT',
        status: 'ISSUED',
        sourceType: 'CLUB_CHARGE',
        sourceId: charge.id,
        sequentialNumber: 11,
        number: `DEMO-FR ${year}/000011`,
        currency: 'EUR',
        subtotalCents: charge.amountCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: charge.amountCents,
        customerSnapshot: { demo: true },
        billingSnapshot: {},
        metadata: { demo: true },
        provider: 'manual',
        issuedAt: now,
        createdById: admin.id,
      },
      create: {
        seriesId: invoiceSeries.id,
        type: 'INVOICE_RECEIPT',
        status: 'ISSUED',
        sourceType: 'CLUB_CHARGE',
        sourceId: charge.id,
        idempotencyKey: 'demo:fiscal:club-charge:1',
        sequentialNumber: 11,
        number: `DEMO-FR ${year}/000011`,
        currency: 'EUR',
        subtotalCents: charge.amountCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: charge.amountCents,
        customerSnapshot: { demo: true },
        billingSnapshot: {},
        metadata: { demo: true },
        provider: 'manual',
        issuedAt: now,
        createdById: admin.id,
      },
    });
  }
}

async function main() {
  const subscriptions = await seedClub();
  await seedLoyalty();
  await seedGiftCards();
  await seedFiscal(subscriptions);
  console.log('Clube, fidelização, vales e documentos demo concluídos.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
