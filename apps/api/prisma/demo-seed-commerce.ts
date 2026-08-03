import {
  db,
  day,
  demoAddress,
  findOrCreate,
  prisma,
  requiredOrder,
  requiredProduct,
  requiredUser,
} from './demo-shared';

async function ensureExtendedOrders() {
  const reseller = await requiredUser('demo.revendedor@nsabores.pt');
  const customer = await requiredUser('demo.cliente5@nsabores.pt');
  const staff = await requiredUser('demo.staff@nsabores.pt');
  const delivery = await db.deliveryMethod.findUnique({
    where: { code: 'standard-pt' },
  });
  const account = await db.businessAccount.findUnique({
    where: { taxNumber: '509990001' },
  });
  const priceList = await db.priceList.findUnique({
    where: { code: 'DEMO-REVENDA' },
  });
  if (!delivery || !account || !priceList) {
    throw new Error('Fundação B2B demo incompleta.');
  }

  const specs = [
    {
      number: 'DEMO-0009',
      user: reseller,
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      salesChannel: 'B2B',
      businessAccountId: account.id,
      priceListId: priceList.id,
      firstSku: 'CAB-PORTUGAL',
      secondSku: 'TAB-ESSENCIAL',
      firstQuantity: 5,
      secondQuantity: 5,
    },
    {
      number: 'DEMO-0010',
      user: customer,
      status: 'DELIVERED',
      paymentStatus: 'PARTIALLY_REFUNDED',
      salesChannel: 'B2C',
      businessAccountId: null,
      priceListId: null,
      firstSku: 'QUE-OVELHA',
      secondSku: 'VIN-ESPUMANTE',
      firstQuantity: 1,
      secondQuantity: 1,
    },
  ];

  for (const [index, spec] of specs.entries()) {
    const first = await requiredProduct(spec.firstSku);
    const second = await requiredProduct(spec.secondSku);
    const subtotalCents =
      first.priceCents * spec.firstQuantity +
      second.priceCents * spec.secondQuantity;
    const shippingCents =
      spec.salesChannel === 'B2B' || subtotalCents >= 5000 ? 0 : 490;
    const totalCents = subtotalCents + shippingCents;
    const order = await db.order.upsert({
      where: { number: spec.number },
      update: {
        userId: spec.user.id,
        email: spec.user.email,
        customerName: `${spec.user.firstName} ${spec.user.lastName}`,
        phone: '+351 910 000 000',
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        subtotalCents,
        shippingCents,
        discountCents: 0,
        taxCents: 0,
        totalCents,
        billingAddress: demoAddress(spec.user.firstName),
        shippingAddress: demoAddress(spec.user.firstName),
        internalNotes: 'Encomenda adicional do ambiente de demonstração.',
        source: 'DEMO_SEED',
        deliveryMethodId: delivery.id,
        salesChannel: spec.salesChannel,
        businessAccountId: spec.businessAccountId,
        priceListId: spec.priceListId,
        paymentTermsSnapshot:
          spec.salesChannel === 'B2B'
            ? { terms: 'NET_30', label: '30 dias' }
            : null,
        customerReference:
          spec.salesChannel === 'B2B' ? 'PO-CLIENTE-DEMO-001' : null,
        requiresApproval: false,
        approvedBy: spec.salesChannel === 'B2B' ? staff.id : null,
        approvedAt: spec.salesChannel === 'B2B' ? day(-2) : null,
      },
      create: {
        number: spec.number,
        userId: spec.user.id,
        email: spec.user.email,
        customerName: `${spec.user.firstName} ${spec.user.lastName}`,
        phone: '+351 910 000 000',
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        subtotalCents,
        shippingCents,
        discountCents: 0,
        taxCents: 0,
        totalCents,
        billingAddress: demoAddress(spec.user.firstName),
        shippingAddress: demoAddress(spec.user.firstName),
        internalNotes: 'Encomenda adicional do ambiente de demonstração.',
        source: 'DEMO_SEED',
        deliveryMethodId: delivery.id,
        idempotencyKey: `demo:order:${9 + index}`,
        salesChannel: spec.salesChannel,
        businessAccountId: spec.businessAccountId,
        priceListId: spec.priceListId,
        paymentTermsSnapshot:
          spec.salesChannel === 'B2B'
            ? { terms: 'NET_30', label: '30 dias' }
            : null,
        customerReference:
          spec.salesChannel === 'B2B' ? 'PO-CLIENTE-DEMO-001' : null,
        requiresApproval: false,
        approvedBy: spec.salesChannel === 'B2B' ? staff.id : null,
        approvedAt: spec.salesChannel === 'B2B' ? day(-2) : null,
      },
    });

    for (const [product, quantity] of [
      [first, spec.firstQuantity],
      [second, spec.secondQuantity],
    ] as const) {
      const existing = await db.orderItem.findFirst({
        where: { orderId: order.id, sku: product.sku },
      });
      const data = {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPriceCents: product.priceCents,
        quantity,
        totalCents: product.priceCents * quantity,
        imageUrl: product.imageUrl,
      };
      if (existing) {
        await db.orderItem.update({ where: { id: existing.id }, data });
      } else {
        await db.orderItem.create({ data });
      }
    }

    await db.payment.upsert({
      where: { providerPaymentId: `demo-payment-${9 + index}` },
      update: {
        orderId: order.id,
        provider: spec.paymentStatus === 'PENDING' ? 'manual' : 'demo',
        method: spec.salesChannel === 'B2B' ? 'bank_transfer' : 'card',
        status: spec.paymentStatus,
        amountCents: totalCents,
        metadata: { demo: true },
      },
      create: {
        orderId: order.id,
        provider: spec.paymentStatus === 'PENDING' ? 'manual' : 'demo',
        providerPaymentId: `demo-payment-${9 + index}`,
        method: spec.salesChannel === 'B2B' ? 'bank_transfer' : 'card',
        status: spec.paymentStatus,
        amountCents: totalCents,
        currency: 'EUR',
        idempotencyKey: `demo:payment:${9 + index}`,
        metadata: { demo: true },
      },
    });
    await findOrCreate(
      db.orderStatusHistory,
      {
        orderId: order.id,
        toStatus: spec.status,
        note: 'Estado demonstrativo.',
      },
      {
        orderId: order.id,
        fromStatus: null,
        toStatus: spec.status,
        authorId: staff.id,
        note: 'Estado demonstrativo.',
      },
    );
  }
}

async function seedProduction() {
  const responsible = await requiredUser('demo.operacoes@nsabores.pt');
  const specs = [
    ['DEMO-0003', 'IN_PROGRESS', 'HIGH', 2],
    ['DEMO-0004', 'READY', 'URGENT', 1],
    ['DEMO-0009', 'QUEUED', 'NORMAL', 3],
  ] as const;
  for (const [number, status, priority, targetOffset] of specs) {
    const order = await requiredOrder(number);
    await db.productionWorkOrder.upsert({
      where: { orderId: order.id },
      update: {
        status,
        priority,
        targetDate: day(targetOffset),
        responsibleUserId: responsible.id,
        productionNotes: 'Preparação criada pelo ambiente de demonstração.',
        startedAt: status === 'QUEUED' ? null : day(-1),
        readyAt: status === 'READY' ? day(-1) : null,
      },
      create: {
        orderId: order.id,
        status,
        priority,
        targetDate: day(targetOffset),
        responsibleUserId: responsible.id,
        productionNotes: 'Preparação criada pelo ambiente de demonstração.',
        startedAt: status === 'QUEUED' ? null : day(-1),
        readyAt: status === 'READY' ? day(-1) : null,
      },
    });
  }
}

async function seedReceivables() {
  const staff = await requiredUser('demo.staff@nsabores.pt');
  const specs = [
    ['DEMO-0001', 'TO_AGREE', 'multibanco', 3],
    ['DEMO-0002', 'PAID', 'bank_transfer', -1],
    ['DEMO-0009', 'AWAITING_PAYMENT', 'bank_transfer', 30],
  ] as const;
  for (const [index, [number, status, method, dueOffset]] of specs.entries()) {
    const order = await requiredOrder(number);
    const agreement = await db.paymentAgreement.upsert({
      where: { orderId: order.id },
      update: {
        status,
        method,
        expectedAmountCents: order.totalCents,
        dueAt: day(dueOffset),
        publicReference: `DEMO-${index + 1}-REF`,
        internalReference: `DEMO-AGR-${index + 1}`,
        responsibleUserId: staff.id,
        internalNotes: 'Acordo demonstrativo.',
        agreedAt: status === 'TO_AGREE' ? null : day(-2),
        paidAt: status === 'PAID' ? day(-1) : null,
      },
      create: {
        orderId: order.id,
        status,
        method,
        expectedAmountCents: order.totalCents,
        dueAt: day(dueOffset),
        publicReference: `DEMO-${index + 1}-REF`,
        internalReference: `DEMO-AGR-${index + 1}`,
        responsibleUserId: staff.id,
        internalNotes: 'Acordo demonstrativo.',
        agreedAt: status === 'TO_AGREE' ? null : day(-2),
        paidAt: status === 'PAID' ? day(-1) : null,
      },
    });
    await db.paymentContactEvent.upsert({
      where: { idempotencyKey: `demo:contact:${index + 1}` },
      update: {
        agreementId: agreement.id,
        type: status === 'PAID' ? 'PAYMENT_CONFIRMED' : 'INSTRUCTIONS_SENT',
        channel: 'EMAIL',
        note: 'Contacto demonstrativo.',
        authorId: staff.id,
        nextContactAt: status === 'PAID' ? null : day(2),
      },
      create: {
        agreementId: agreement.id,
        type: status === 'PAID' ? 'PAYMENT_CONFIRMED' : 'INSTRUCTIONS_SENT',
        channel: 'EMAIL',
        note: 'Contacto demonstrativo.',
        authorId: staff.id,
        nextContactAt: status === 'PAID' ? null : day(2),
        idempotencyKey: `demo:contact:${index + 1}`,
      },
    });
  }
}

async function seedShipmentsReturnsAndSupport() {
  const staff = await requiredUser('demo.staff@nsabores.pt');
  const specs = [
    ['DEMO-0005', 'IN_TRANSIT', false],
    ['DEMO-0006', 'DELIVERED', true],
    ['DEMO-0010', 'DELIVERED', true],
  ] as const;

  for (const [index, [number, shipmentStatus, delivered]] of specs.entries()) {
    const order = await requiredOrder(number);
    const items = await db.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    const shipment = await db.shipment.upsert({
      where: { number: `DEMO-SHP-${index + 1}` },
      update: {
        orderId: order.id,
        provider: 'mock',
        service: 'standard',
        trackingNumber: `NSDEMO${index + 1}`,
        trackingUrl: `https://tracking.invalid/NSDEMO${index + 1}`,
        status: shipmentStatus,
        weightGrams: 2500,
        costCents: order.shippingCents,
        labelUrl: `https://labels.invalid/NSDEMO${index + 1}.pdf`,
        providerShipmentId: `demo-shipment-${index + 1}`,
        shippedAt: day(-3),
        estimatedDeliveryAt: day(-1),
        deliveredAt: delivered ? day(-1) : null,
      },
      create: {
        orderId: order.id,
        number: `DEMO-SHP-${index + 1}`,
        provider: 'mock',
        service: 'standard',
        trackingNumber: `NSDEMO${index + 1}`,
        trackingUrl: `https://tracking.invalid/NSDEMO${index + 1}`,
        status: shipmentStatus,
        weightGrams: 2500,
        costCents: order.shippingCents,
        currency: 'EUR',
        labelUrl: `https://labels.invalid/NSDEMO${index + 1}.pdf`,
        providerShipmentId: `demo-shipment-${index + 1}`,
        idempotencyKey: `demo:shipment:${index + 1}`,
        shippedAt: day(-3),
        estimatedDeliveryAt: day(-1),
        deliveredAt: delivered ? day(-1) : null,
      },
    });
    for (const item of items) {
      await db.shipmentItem.upsert({
        where: {
          shipmentId_orderItemId: {
            shipmentId: shipment.id,
            orderItemId: item.id,
          },
        },
        update: { quantity: item.quantity },
        create: {
          shipmentId: shipment.id,
          orderItemId: item.id,
          quantity: item.quantity,
        },
      });
    }
    const events = [
      ['label', 'LABEL_CREATED', 'Etiqueta criada', -4],
      ['transit', 'IN_TRANSIT', 'Expedição em trânsito', -3],
      ...(delivered
        ? [['delivered', 'DELIVERED', 'Entrega concluída', -1]]
        : []),
    ] as const;
    for (const [eventCode, code, description, offset] of events) {
      await db.shipmentEvent.upsert({
        where: {
          shipmentId_providerEventId: {
            shipmentId: shipment.id,
            providerEventId: `demo-${eventCode}-${index + 1}`,
          },
        },
        update: {
          code,
          description,
          location: 'Alcobaça',
          occurredAt: day(offset),
          payload: { demo: true },
        },
        create: {
          shipmentId: shipment.id,
          providerEventId: `demo-${eventCode}-${index + 1}`,
          code,
          description,
          location: 'Alcobaça',
          occurredAt: day(offset),
          payload: { demo: true },
        },
      });
    }

    if (delivered && items[0]) {
      const rma = await db.returnRequest.upsert({
        where: { number: `DEMO-RMA-${index + 1}` },
        update: {
          orderId: order.id,
          userId: order.userId,
          status: index === 2 ? 'REFUNDED' : 'UNDER_REVIEW',
          resolution: 'REFUND',
          reason: 'Produto danificado durante o transporte.',
          customerNotes: 'Pedido de demonstração.',
          internalNotes: 'RMA criado pelo ambiente de demonstração.',
          requestedAt: day(-1),
          decidedAt: index === 2 ? new Date() : null,
          receivedAt: index === 2 ? new Date() : null,
          closedAt: index === 2 ? new Date() : null,
        },
        create: {
          number: `DEMO-RMA-${index + 1}`,
          orderId: order.id,
          userId: order.userId,
          status: index === 2 ? 'REFUNDED' : 'UNDER_REVIEW',
          resolution: 'REFUND',
          reason: 'Produto danificado durante o transporte.',
          customerNotes: 'Pedido de demonstração.',
          internalNotes: 'RMA criado pelo ambiente de demonstração.',
          requestedAt: day(-1),
          decidedAt: index === 2 ? new Date() : null,
          receivedAt: index === 2 ? new Date() : null,
          closedAt: index === 2 ? new Date() : null,
        },
      });
      await db.returnItem.upsert({
        where: {
          returnRequestId_orderItemId: {
            returnRequestId: rma.id,
            orderItemId: items[0].id,
          },
        },
        update: {
          quantity: 1,
          reason: 'Embalagem danificada.',
          declaredCondition: 'Danificado',
          receivedCondition: index === 2 ? 'Confirmado' : null,
          disposition: index === 2 ? 'RESTOCK' : null,
          eligibleRefundCents: items[0].unitPriceCents,
        },
        create: {
          returnRequestId: rma.id,
          orderItemId: items[0].id,
          quantity: 1,
          reason: 'Embalagem danificada.',
          declaredCondition: 'Danificado',
          receivedCondition: index === 2 ? 'Confirmado' : null,
          disposition: index === 2 ? 'RESTOCK' : null,
          eligibleRefundCents: items[0].unitPriceCents,
        },
      });
      await findOrCreate(
        db.returnEvent,
        {
          returnRequestId: rma.id,
          toStatus: rma.status,
          note: 'Evento demonstrativo.',
        },
        {
          returnRequestId: rma.id,
          fromStatus: null,
          toStatus: rma.status,
          authorId: staff.id,
          note: 'Evento demonstrativo.',
        },
      );

      const support = await db.supportCase.upsert({
        where: { number: `DEMO-SUP-${index + 1}` },
        update: {
          userId: order.userId,
          businessAccountId: order.businessAccountId,
          orderId: order.id,
          shipmentId: shipment.id,
          type: index === 2 ? 'DAMAGED_PRODUCT' : 'DELAY',
          priority: index === 2 ? 'HIGH' : 'NORMAL',
          status: index === 2 ? 'RESOLVED' : 'IN_PROGRESS',
          subject: 'Caso de apoio demonstrativo',
          description: 'Descrição do caso criado pelo seed.',
          resolution: index === 2 ? 'Reembolso processado.' : null,
          assignedToId: staff.id,
          dueAt: day(2),
          resolvedAt: index === 2 ? new Date() : null,
        },
        create: {
          number: `DEMO-SUP-${index + 1}`,
          userId: order.userId,
          businessAccountId: order.businessAccountId,
          orderId: order.id,
          shipmentId: shipment.id,
          type: index === 2 ? 'DAMAGED_PRODUCT' : 'DELAY',
          priority: index === 2 ? 'HIGH' : 'NORMAL',
          status: index === 2 ? 'RESOLVED' : 'IN_PROGRESS',
          subject: 'Caso de apoio demonstrativo',
          description: 'Descrição do caso criado pelo seed.',
          resolution: index === 2 ? 'Reembolso processado.' : null,
          assignedToId: staff.id,
          dueAt: day(2),
          resolvedAt: index === 2 ? new Date() : null,
        },
      });
      await findOrCreate(
        db.supportCaseComment,
        {
          supportCaseId: support.id,
          body: 'Comentário interno demonstrativo.',
        },
        {
          supportCaseId: support.id,
          authorId: staff.id,
          body: 'Comentário interno demonstrativo.',
          isInternal: true,
        },
      );
    }
  }
}

async function seedDiscountAudit() {
  const order = await requiredOrder('DEMO-0006');
  const promotion = await db.promotion.findUnique({
    where: { code: 'DEMO-VERAO-10' },
  });
  const coupon = await db.coupon.findUnique({ where: { code: 'DEMO10' } });
  if (!promotion || !coupon) throw new Error('Promoção demo em falta.');
  await db.orderDiscount.deleteMany({
    where: { orderId: order.id, source: 'DEMO_SEED' },
  });
  await db.orderDiscount.create({
    data: {
      orderId: order.id,
      promotionId: promotion.id,
      couponId: coupon.id,
      source: 'DEMO_SEED',
      code: coupon.code,
      label: 'Desconto Demo 10%',
      amountCents: 500,
      snapshot: { demo: true, percentage: 10 },
    },
  });
  await db.couponRedemption.upsert({
    where: { idempotencyKey: 'demo:coupon-redemption:1' },
    update: {
      couponId: coupon.id,
      orderId: order.id,
      userId: order.userId,
      amountCents: 500,
      redeemedAt: day(-2),
    },
    create: {
      couponId: coupon.id,
      orderId: order.id,
      userId: order.userId,
      amountCents: 500,
      idempotencyKey: 'demo:coupon-redemption:1',
      redeemedAt: day(-2),
    },
  });
}

async function main() {
  await ensureExtendedOrders();
  await seedProduction();
  await seedReceivables();
  await seedShipmentsReturnsAndSupport();
  await seedDiscountAudit();
  console.log(
    'Comércio, produção, fulfillment e recebimentos demo concluídos.',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
