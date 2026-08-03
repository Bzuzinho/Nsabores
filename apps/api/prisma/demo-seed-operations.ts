import {
  db,
  day,
  demoAddress,
  demoPasswordHash,
  demoProductSkus,
  findOrCreate,
  now,
  prisma,
  requiredProduct,
  requiredUser,
} from './demo-shared';

async function seedAdditionalUsers() {
  const passwordHash = await demoPasswordHash();
  const users = [
    ['demo.admin@nsabores.pt', 'Ricardo', 'Administração', 'ADMIN'],
    ['demo.operacoes@nsabores.pt', 'Luís', 'Armazém', 'STAFF'],
    ['demo.revendedor@nsabores.pt', 'Carla', 'Revenda', 'CUSTOMER'],
  ] as const;

  for (const [email, firstName, lastName, role] of users) {
    const user = await db.user.upsert({
      where: { email },
      update: {
        passwordHash,
        firstName,
        lastName,
        phone: '+351 910 000 000',
        role,
        isActive: true,
        emailVerifiedAt: now,
      },
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone: '+351 910 000 000',
        role,
        isActive: true,
        emailVerifiedAt: now,
      },
    });

    if (role === 'CUSTOMER') {
      await db.customerProfile.upsert({
        where: { userId: user.id },
        update: {
          taxNumber: '245000001',
          marketingConsent: true,
          marketingConsentAt: now,
          notes: 'Conta B2B do ambiente de demonstração.',
        },
        create: {
          userId: user.id,
          taxNumber: '245000001',
          marketingConsent: true,
          marketingConsentAt: now,
          notes: 'Conta B2B do ambiente de demonstração.',
        },
      });
      await findOrCreate(
        db.address,
        { userId: user.id, label: 'Morada Demo' },
        {
          userId: user.id,
          label: 'Morada Demo',
          firstName,
          lastName,
          company: 'Mercearia Parceira Demo',
          taxNumber: '509990001',
          line1: 'Rua da Demonstração, 10',
          postalCode: '2460-000',
          city: 'Alcobaça',
          countryCode: 'PT',
          phone: '+351 910 000 000',
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      );
    }
  }
}

async function seedStockHistory() {
  const author = await requiredUser('demo.operacoes@nsabores.pt');
  const products = await db.product.findMany({
    where: { sku: { in: [...demoProductSkus] } },
    orderBy: { sku: 'asc' },
  });

  for (const [index, product] of products.entries()) {
    await db.stockMovement.upsert({
      where: { idempotencyKey: `demo:stock:opening:${product.sku}` },
      update: {
        productId: product.id,
        type: 'ADJUSTMENT_IN',
        quantity: 30 + index,
        referenceType: 'DEMO_SEED',
        referenceId: product.sku,
        note: 'Saldo inicial demonstrativo.',
        authorId: author.id,
      },
      create: {
        productId: product.id,
        type: 'ADJUSTMENT_IN',
        quantity: 30 + index,
        referenceType: 'DEMO_SEED',
        referenceId: product.sku,
        idempotencyKey: `demo:stock:opening:${product.sku}`,
        note: 'Saldo inicial demonstrativo.',
        authorId: author.id,
      },
    });
  }
}

async function seedSuppliersAndPurchases() {
  const admin = await requiredUser('demo.admin@nsabores.pt');
  const suppliers = [
    {
      tradeName: 'Queijaria Serra Demo',
      legalName: 'Queijaria Serra Demonstração, Lda.',
      taxNumber: '509900001',
      email: 'fornecedor.queijos.demo@nsabores.pt',
      phone: '+351 262 000 001',
      primaryContact: 'Helena Serra',
      paymentTerms: '30 dias',
      averageLeadTimeDays: 5,
    },
    {
      tradeName: 'Enchidos Tradicionais Demo',
      legalName: 'Enchidos Tradicionais Demonstração, Lda.',
      taxNumber: '509900002',
      email: 'fornecedor.enchidos.demo@nsabores.pt',
      phone: '+351 262 000 002',
      primaryContact: 'Paulo Tradição',
      paymentTerms: '15 dias',
      averageLeadTimeDays: 3,
    },
    {
      tradeName: 'Adega Reserva Demo',
      legalName: 'Adega Reserva Demonstração, S.A.',
      taxNumber: '509900003',
      email: 'fornecedor.vinhos.demo@nsabores.pt',
      phone: '+351 262 000 003',
      primaryContact: 'Teresa Vinha',
      paymentTerms: 'Pronto pagamento',
      averageLeadTimeDays: 7,
    },
  ];

  const supplierRows: any[] = [];
  for (const supplier of suppliers) {
    supplierRows.push(
      await findOrCreate(
        db.supplier,
        { email: supplier.email },
        {
          ...supplier,
          address: demoAddress(supplier.primaryContact, supplier.tradeName),
          defaultCurrency: 'EUR',
          internalNotes: 'Fornecedor do ambiente de demonstração.',
          isActive: true,
        },
      ),
    );
  }

  const products = await db.product.findMany({
    where: { sku: { in: [...demoProductSkus] } },
    orderBy: { sku: 'asc' },
  });

  for (const [index, product] of products.entries()) {
    const supplier = supplierRows[index % supplierRows.length];
    await db.supplierProduct.upsert({
      where: {
        supplierId_productId: {
          supplierId: supplier.id,
          productId: product.id,
        },
      },
      update: {
        supplierSku: `SUP-${product.sku}`,
        purchaseCostCents: Math.round(product.priceCents * 0.55),
        minimumQuantity: 5,
        purchaseMultiple: 5,
        leadTimeDays: supplier.averageLeadTimeDays,
        isPreferred: true,
        isActive: true,
      },
      create: {
        supplierId: supplier.id,
        productId: product.id,
        supplierSku: `SUP-${product.sku}`,
        purchaseCostCents: Math.round(product.priceCents * 0.55),
        minimumQuantity: 5,
        purchaseMultiple: 5,
        leadTimeDays: supplier.averageLeadTimeDays,
        isPreferred: true,
        isActive: true,
      },
    });
  }

  const purchaseSpecs = [
    ['DEMO-PO-0001', 'RECEIVED', -20, -14],
    ['DEMO-PO-0002', 'PARTIALLY_RECEIVED', -8, 2],
    ['DEMO-PO-0003', 'SUBMITTED', -2, 5],
  ] as const;

  for (const [poIndex, [number, status, issuedOffset, expectedOffset]] of purchaseSpecs.entries()) {
    const supplier = supplierRows[poIndex];
    const selected = products.slice(poIndex * 3, poIndex * 3 + 3);
    const subtotalCents = selected.reduce(
      (sum: number, product: any) =>
        sum + Math.round(product.priceCents * 0.55) * 20,
      0,
    );
    const taxCents = Math.round(subtotalCents * 0.23);
    const purchase = await db.purchaseOrder.upsert({
      where: { number },
      update: {
        supplierId: supplier.id,
        status,
        issuedAt: day(issuedOffset),
        expectedAt: day(expectedOffset),
        receivedAt: status === 'RECEIVED' ? day(-14) : null,
        subtotalCents,
        taxCents,
        totalCents: subtotalCents + taxCents,
        currency: 'EUR',
        paymentTermsSnapshot: supplier.paymentTerms,
        notes: 'Compra criada pelo ambiente de demonstração.',
        authorId: admin.id,
      },
      create: {
        number,
        supplierId: supplier.id,
        status,
        issuedAt: day(issuedOffset),
        expectedAt: day(expectedOffset),
        receivedAt: status === 'RECEIVED' ? day(-14) : null,
        subtotalCents,
        taxCents,
        totalCents: subtotalCents + taxCents,
        currency: 'EUR',
        paymentTermsSnapshot: supplier.paymentTerms,
        notes: 'Compra criada pelo ambiente de demonstração.',
        authorId: admin.id,
      },
    });

    const itemRows: any[] = [];
    for (const product of selected) {
      const unitCostCents = Math.round(product.priceCents * 0.55);
      const existing = await db.purchaseOrderItem.findFirst({
        where: { purchaseOrderId: purchase.id, productId: product.id },
      });
      const data = {
        purchaseOrderId: purchase.id,
        productId: product.id,
        supplierSku: `SUP-${product.sku}`,
        description: product.name,
        orderedQuantity: 20,
        receivedQuantity:
          status === 'RECEIVED' ? 20 : status === 'PARTIALLY_RECEIVED' ? 10 : 0,
        unitCostCents,
        taxRateBasisPoints: 2300,
        totalCents: unitCostCents * 20,
      };
      itemRows.push(
        existing
          ? await db.purchaseOrderItem.update({ where: { id: existing.id }, data })
          : await db.purchaseOrderItem.create({ data }),
      );
    }

    if (status !== 'SUBMITTED') {
      const receiptNumber = `DEMO-REC-${poIndex + 1}`;
      const receipt = await db.purchaseReceipt.upsert({
        where: { number: receiptNumber },
        update: {
          purchaseOrderId: purchase.id,
          receivedAt: status === 'RECEIVED' ? day(-14) : day(-1),
          authorId: admin.id,
          note: 'Receção demonstrativa.',
        },
        create: {
          purchaseOrderId: purchase.id,
          number: receiptNumber,
          receivedAt: status === 'RECEIVED' ? day(-14) : day(-1),
          authorId: admin.id,
          note: 'Receção demonstrativa.',
          idempotencyKey: `demo:purchase-receipt:${poIndex + 1}`,
        },
      });

      for (const item of itemRows) {
        const quantity = status === 'RECEIVED' ? 20 : 10;
        const movement = await db.stockMovement.upsert({
          where: { idempotencyKey: `demo:purchase:${receiptNumber}:${item.id}` },
          update: {
            productId: item.productId,
            type: 'PURCHASE_RECEIPT',
            quantity,
            referenceType: 'PURCHASE_RECEIPT',
            referenceId: receipt.id,
            authorId: admin.id,
            note: 'Entrada de compra demonstrativa.',
          },
          create: {
            productId: item.productId,
            type: 'PURCHASE_RECEIPT',
            quantity,
            referenceType: 'PURCHASE_RECEIPT',
            referenceId: receipt.id,
            idempotencyKey: `demo:purchase:${receiptNumber}:${item.id}`,
            authorId: admin.id,
            note: 'Entrada de compra demonstrativa.',
          },
        });
        await db.purchaseReceiptItem.upsert({
          where: {
            purchaseReceiptId_purchaseOrderItemId: {
              purchaseReceiptId: receipt.id,
              purchaseOrderItemId: item.id,
            },
          },
          update: { quantity, stockMovementId: movement.id },
          create: {
            purchaseReceiptId: receipt.id,
            purchaseOrderItemId: item.id,
            quantity,
            stockMovementId: movement.id,
          },
        });
      }
    }
  }
}

async function seedInventories() {
  const admin = await requiredUser('demo.admin@nsabores.pt');
  const products = await db.product.findMany({
    where: { sku: { in: [...demoProductSkus] } },
    orderBy: { sku: 'asc' },
  });

  const specs = [
    ['DEMO-INV-0001', 'COMPLETED', -10],
    ['DEMO-INV-0002', 'IN_PROGRESS', 0],
  ] as const;

  for (const [index, [number, status, offset]] of specs.entries()) {
    const inventory = await db.inventoryCount.upsert({
      where: { number },
      update: {
        status,
        referenceAt: day(offset),
        authorId: admin.id,
        notes: 'Inventário do ambiente de demonstração.',
      },
      create: {
        number,
        status,
        referenceAt: day(offset),
        authorId: admin.id,
        notes: 'Inventário do ambiente de demonstração.',
      },
    });

    for (const product of products.slice(index * 4, index * 4 + 4)) {
      const stock = await db.stockItem.findUnique({ where: { productId: product.id } });
      const expected = stock?.onHandQuantity ?? 0;
      const counted = status === 'COMPLETED' ? Math.max(0, expected - 1) : null;
      let movementId: string | null = null;
      if (counted !== null && counted !== expected) {
        const movement = await db.stockMovement.upsert({
          where: { idempotencyKey: `demo:inventory:${number}:${product.sku}` },
          update: {
            productId: product.id,
            type: 'INVENTORY_CORRECTION',
            quantity: counted - expected,
            referenceType: 'INVENTORY',
            referenceId: inventory.id,
            authorId: admin.id,
            note: 'Correção de inventário demonstrativa.',
          },
          create: {
            productId: product.id,
            type: 'INVENTORY_CORRECTION',
            quantity: counted - expected,
            referenceType: 'INVENTORY',
            referenceId: inventory.id,
            idempotencyKey: `demo:inventory:${number}:${product.sku}`,
            authorId: admin.id,
            note: 'Correção de inventário demonstrativa.',
          },
        });
        movementId = movement.id;
      }
      const existing = await db.inventoryCountItem.findFirst({
        where: { inventoryCountId: inventory.id, productId: product.id },
      });
      const data = {
        inventoryCountId: inventory.id,
        productId: product.id,
        expectedQuantity: expected,
        countedQuantity: counted,
        reason: status === 'COMPLETED' ? 'Quebra demonstrativa.' : null,
        stockMovementId: movementId,
      };
      if (existing) {
        await db.inventoryCountItem.update({ where: { id: existing.id }, data });
      } else {
        await db.inventoryCountItem.create({ data });
      }
    }
  }
}

async function seedB2B() {
  const admin = await requiredUser('demo.admin@nsabores.pt');
  const reseller = await requiredUser('demo.revendedor@nsabores.pt');
  const products = await db.product.findMany({
    where: { sku: { in: [...demoProductSkus] } },
  });

  const resellerList = await db.priceList.upsert({
    where: { code: 'DEMO-REVENDA' },
    update: {
      name: 'Tabela Revenda Demo',
      type: 'RESELLER',
      currency: 'EUR',
      includesTax: false,
      priority: 20,
      isActive: true,
      validFrom: day(-30),
      validUntil: day(365),
    },
    create: {
      name: 'Tabela Revenda Demo',
      code: 'DEMO-REVENDA',
      type: 'RESELLER',
      currency: 'EUR',
      includesTax: false,
      priority: 20,
      isActive: true,
      validFrom: day(-30),
      validUntil: day(365),
    },
  });

  const vipList = await db.priceList.upsert({
    where: { code: 'DEMO-VIP' },
    update: {
      name: 'Tabela Cliente VIP Demo',
      type: 'CUSTOM',
      currency: 'EUR',
      includesTax: true,
      priority: 10,
      isActive: true,
    },
    create: {
      name: 'Tabela Cliente VIP Demo',
      code: 'DEMO-VIP',
      type: 'CUSTOM',
      currency: 'EUR',
      includesTax: true,
      priority: 10,
      isActive: true,
    },
  });

  for (const [index, product] of products.entries()) {
    await db.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: resellerList.id,
          productId: product.id,
        },
      },
      update: {
        priceCents: Math.round(product.priceCents * 0.72),
        minimumQuantity: 2,
      },
      create: {
        priceListId: resellerList.id,
        productId: product.id,
        priceCents: Math.round(product.priceCents * 0.72),
        minimumQuantity: 2,
      },
    });
    if (index < 8) {
      await db.priceListItem.upsert({
        where: {
          priceListId_productId: {
            priceListId: vipList.id,
            productId: product.id,
          },
        },
        update: { priceCents: Math.round(product.priceCents * 0.9) },
        create: {
          priceListId: vipList.id,
          productId: product.id,
          priceCents: Math.round(product.priceCents * 0.9),
        },
      });
    }
  }

  const account = await db.businessAccount.upsert({
    where: { taxNumber: '509990001' },
    update: {
      tradeName: 'Mercearia Parceira Demo',
      legalName: 'Mercearia Parceira Demonstração, Lda.',
      businessEmail: 'empresa.demo@nsabores.pt',
      phone: '+351 262 111 111',
      billingAddress: demoAddress('Carla', 'Mercearia Parceira Demo'),
      status: 'APPROVED',
      priceListId: resellerList.id,
      paymentTerms: 'NET_30',
      allowedPaymentMethods: ['BANK_TRANSFER'],
      creditLimitCents: 100000,
      minimumOrderCents: 10000,
      requiresApproval: false,
      shippingCents: 0,
      managerId: admin.id,
      internalNotes: 'Conta B2B demonstrativa.',
    },
    create: {
      type: 'RESELLER',
      tradeName: 'Mercearia Parceira Demo',
      legalName: 'Mercearia Parceira Demonstração, Lda.',
      taxNumber: '509990001',
      businessEmail: 'empresa.demo@nsabores.pt',
      phone: '+351 262 111 111',
      billingAddress: demoAddress('Carla', 'Mercearia Parceira Demo'),
      status: 'APPROVED',
      priceListId: resellerList.id,
      paymentTerms: 'NET_30',
      allowedPaymentMethods: ['BANK_TRANSFER'],
      creditLimitCents: 100000,
      minimumOrderCents: 10000,
      requiresApproval: false,
      shippingCents: 0,
      managerId: admin.id,
      internalNotes: 'Conta B2B demonstrativa.',
    },
  });

  await db.businessAccountUser.upsert({
    where: {
      businessAccountId_userId: {
        businessAccountId: account.id,
        userId: reseller.id,
      },
    },
    update: { role: 'OWNER', isActive: true },
    create: {
      businessAccountId: account.id,
      userId: reseller.id,
      role: 'OWNER',
      isActive: true,
    },
  });

  await db.businessAccount.upsert({
    where: { taxNumber: '509990002' },
    update: {
      tradeName: 'Loja Candidata Demo',
      legalName: 'Loja Candidata Demonstração, Unipessoal Lda.',
      businessEmail: 'candidata.demo@nsabores.pt',
      phone: '+351 262 222 222',
      billingAddress: demoAddress('Paula', 'Loja Candidata Demo'),
      status: 'PENDING',
      paymentTerms: 'IMMEDIATE',
      allowedPaymentMethods: ['CARD'],
      managerId: admin.id,
      internalNotes: 'Conta B2B pendente demonstrativa.',
    },
    create: {
      type: 'RESELLER',
      tradeName: 'Loja Candidata Demo',
      legalName: 'Loja Candidata Demonstração, Unipessoal Lda.',
      taxNumber: '509990002',
      businessEmail: 'candidata.demo@nsabores.pt',
      phone: '+351 262 222 222',
      billingAddress: demoAddress('Paula', 'Loja Candidata Demo'),
      status: 'PENDING',
      paymentTerms: 'IMMEDIATE',
      allowedPaymentMethods: ['CARD'],
      managerId: admin.id,
      internalNotes: 'Conta B2B pendente demonstrativa.',
    },
  });

  const applications = [
    ['509990001', 'Mercearia Parceira Demo', 'empresa.demo@nsabores.pt', 'APPROVED', account.id],
    ['509990003', 'Empório Pendente Demo', 'emporio.demo@nsabores.pt', 'PENDING', null],
    ['509990004', 'Loja Rejeitada Demo', 'rejeitada.demo@nsabores.pt', 'REJECTED', null],
  ] as const;
  for (const [taxNumber, tradeName, email, status, businessAccountId] of applications) {
    await findOrCreate(
      db.resellerApplication,
      { taxNumber, email },
      {
        tradeName,
        legalName: `${tradeName}, Lda.`,
        taxNumber,
        contactName: 'Contacto Demo',
        email,
        phone: '+351 262 333 333',
        address: demoAddress('Contacto', tradeName),
        website: 'https://example.invalid',
        socialMedia: '@demo',
        activity: 'Comércio a retalho de produtos gourmet',
        estimatedVolume: '5.000 € / mês',
        message: 'Candidatura gerada pelo ambiente de demonstração.',
        status,
        decidedAt: status === 'PENDING' ? null : day(-5),
        decidedBy: status === 'PENDING' ? null : admin.id,
        internalReason: status === 'REJECTED' ? 'Dados insuficientes.' : null,
        businessAccountId,
      },
    );
  }

  return { account, resellerList };
}

async function seedPromotionsAndBundles(b2b: { account: any; resellerList: any }) {
  const promotions = [
    {
      code: 'DEMO-VERAO-10',
      name: 'Verão Demo — 10%',
      status: 'ACTIVE',
      benefitType: 'PERCENTAGE',
      benefitValue: 1000,
      channel: 'BOTH',
      startsAt: day(-30),
      endsAt: day(60),
      priority: 30,
      stackable: true,
      globalUsageLimit: 1000,
      perCustomerLimit: 5,
      minimumCartCents: 2000,
      maximumDiscountCents: 2000,
    },
    {
      code: 'DEMO-LEVE3-PAGUE2',
      name: 'Leve 3, pague 2 Demo',
      status: 'ACTIVE',
      benefitType: 'QUANTITY_DEAL',
      benefitValue: 0,
      channel: 'B2C',
      startsAt: day(-10),
      endsAt: day(90),
      priority: 20,
      stackable: false,
      quantityBuy: 3,
      quantityPay: 2,
    },
    {
      code: 'DEMO-PORTES',
      name: 'Portes grátis Demo',
      status: 'PAUSED',
      benefitType: 'FREE_SHIPPING',
      benefitValue: 0,
      channel: 'BOTH',
      priority: 10,
      stackable: false,
      minimumCartCents: 3500,
    },
  ];

  const rows = new Map<string, any>();
  for (const promotion of promotions) {
    rows.set(
      promotion.code,
      await db.promotion.upsert({
        where: { code: promotion.code },
        update: promotion,
        create: promotion,
      }),
    );
  }

  const cabaz = await requiredProduct('CAB-PORTUGAL');
  const compota = await requiredProduct('COMP-ABO-NOZ');
  for (const target of [
    {
      promotionId: rows.get('DEMO-VERAO-10').id,
      productId: cabaz.id,
      minimumQuantity: 1,
    },
    {
      promotionId: rows.get('DEMO-VERAO-10').id,
      priceListId: b2b.resellerList.id,
      businessAccountId: b2b.account.id,
      minimumQuantity: 1,
    },
    {
      promotionId: rows.get('DEMO-LEVE3-PAGUE2').id,
      productId: compota.id,
      minimumQuantity: 3,
    },
  ]) {
    await findOrCreate(
      db.promotionTarget,
      {
        promotionId: target.promotionId,
        productId: target.productId ?? null,
        priceListId: target.priceListId ?? null,
        businessAccountId: target.businessAccountId ?? null,
      },
      {
        promotionId: target.promotionId,
        productId: target.productId ?? null,
        priceListId: target.priceListId ?? null,
        businessAccountId: target.businessAccountId ?? null,
        minimumQuantity: target.minimumQuantity,
      },
    );
  }

  for (const coupon of [
    {
      promotionId: rows.get('DEMO-VERAO-10').id,
      code: 'DEMO10',
      isActive: true,
      validFrom: day(-30),
      validUntil: day(60),
      usageLimit: 100,
      perUserLimit: 2,
      channel: 'BOTH',
      minimumCartCents: 2500,
    },
    {
      promotionId: rows.get('DEMO-PORTES').id,
      code: 'DEMOPORTES',
      isActive: true,
      validFrom: day(-5),
      validUntil: day(90),
      usageLimit: 50,
      perUserLimit: 1,
      channel: 'B2C',
      minimumCartCents: 3500,
    },
  ]) {
    await db.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
  }

  const fixedBundle = await db.productBundle.upsert({
    where: { productId: cabaz.id },
    update: {
      mode: 'FIXED',
      pricingMode: 'PRODUCT_PRICE',
      minimumSelections: 4,
      maximumSelections: 4,
      isActive: true,
    },
    create: {
      productId: cabaz.id,
      mode: 'FIXED',
      pricingMode: 'PRODUCT_PRICE',
      minimumSelections: 4,
      maximumSelections: 4,
      isActive: true,
    },
  });
  const componentSkus = ['QUE-CABRA', 'ENC-SALPICAO', 'VIN-BRANCO', 'COMP-ABO-NOZ'];
  for (const [index, sku] of componentSkus.entries()) {
    const product = await requiredProduct(sku);
    await findOrCreate(
      db.productBundleItem,
      { bundleId: fixedBundle.id, productId: product.id, groupId: null },
      {
        bundleId: fixedBundle.id,
        productId: product.id,
        groupId: null,
        quantity: 1,
        isRequired: true,
        minimumQuantity: 1,
        maximumQuantity: 1,
        priceDeltaCents: 0,
        sortOrder: index,
        isActive: true,
      },
    );
  }

  await db.productPersonalization.upsert({
    where: { productId: cabaz.id },
    update: {
      allowGiftMessage: true,
      allowRecipientName: true,
      allowSpecialPackaging: true,
      specialPackagingCents: 450,
      allowRequestedDate: true,
      allowNotes: true,
      allowHidePrice: true,
      messageMaxLength: 300,
      notesMaxLength: 500,
    },
    create: {
      productId: cabaz.id,
      allowGiftMessage: true,
      allowRecipientName: true,
      allowSpecialPackaging: true,
      specialPackagingCents: 450,
      allowRequestedDate: true,
      allowNotes: true,
      allowHidePrice: true,
      messageMaxLength: 300,
      notesMaxLength: 500,
    },
  });
}

async function main() {
  await seedAdditionalUsers();
  await seedStockHistory();
  await seedSuppliersAndPurchases();
  await seedInventories();
  const b2b = await seedB2B();
  await seedPromotionsAndBundles(b2b);
  console.log('Operações, B2B, promoções e cabazes demo concluídos.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
