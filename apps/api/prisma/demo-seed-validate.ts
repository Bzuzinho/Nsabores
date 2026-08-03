import { db, demoProductSkus, prisma } from './demo-shared';

async function main() {
  const demoUsers = await db.user.findMany({
    where: { email: { startsWith: 'demo.' } },
    select: { id: true },
  });
  const userIds = demoUsers.map((user: any) => user.id);
  const demoProducts = await db.product.findMany({
    where: { sku: { in: [...demoProductSkus] } },
    select: { id: true },
  });
  const productIds = demoProducts.map((product: any) => product.id);

  const counts = {
    categories: await db.category.count({
      where: {
        slug: {
          in: [
            'tabuas',
            'queijos',
            'enchidos',
            'cabazes',
            'vinhos',
            'outros-sabores',
          ],
        },
      },
    }),
    products: demoProducts.length,
    users: demoUsers.length,
    orders: await db.order.count({ where: { source: 'DEMO_SEED' } }),
    stockItems: await db.stockItem.count({
      where: { productId: { in: productIds } },
    }),
    stockMovements: await db.stockMovement.count({
      where: { idempotencyKey: { startsWith: 'demo:' } },
    }),
    suppliers: await db.supplier.count({
      where: { email: { contains: '.demo@nsabores.pt' } },
    }),
    purchases: await db.purchaseOrder.count({
      where: { number: { startsWith: 'DEMO-PO-' } },
    }),
    purchaseReceipts: await db.purchaseReceipt.count({
      where: { number: { startsWith: 'DEMO-REC-' } },
    }),
    inventories: await db.inventoryCount.count({
      where: { number: { startsWith: 'DEMO-INV-' } },
    }),
    priceLists: await db.priceList.count({
      where: { code: { startsWith: 'DEMO-' } },
    }),
    businessAccounts: await db.businessAccount.count({
      where: { taxNumber: { startsWith: '509990' } },
    }),
    resellerApplications: await db.resellerApplication.count({
      where: { email: { contains: '.demo@nsabores.pt' } },
    }),
    promotions: await db.promotion.count({
      where: { code: { startsWith: 'DEMO-' } },
    }),
    coupons: await db.coupon.count({ where: { code: { startsWith: 'DEMO' } } }),
    bundles: await db.productBundle.count({
      where: { productId: { in: productIds } },
    }),
    shipments: await db.shipment.count({
      where: { number: { startsWith: 'DEMO-SHP-' } },
    }),
    returns: await db.returnRequest.count({
      where: { number: { startsWith: 'DEMO-RMA-' } },
    }),
    supportCases: await db.supportCase.count({
      where: { number: { startsWith: 'DEMO-SUP-' } },
    }),
    production: await db.productionWorkOrder.count({
      where: { productionNotes: { contains: 'ambiente de demonstração' } },
    }),
    receivables: await db.paymentAgreement.count({
      where: { internalReference: { startsWith: 'DEMO-AGR-' } },
    }),
    clubPlans: await db.clubPlan.count({
      where: { code: { startsWith: 'DEMO-' } },
    }),
    clubSubscriptions: await db.clubSubscription.count({
      where: {
        providerSubscriptionId: { startsWith: 'demo-club-subscription-' },
      },
    }),
    clubCharges: await db.clubSubscriptionCharge.count({
      where: { idempotencyKey: { startsWith: 'demo:club-charge:' } },
    }),
    loyaltyAccounts: await db.loyaltyAccount.count({
      where: { userId: { in: userIds } },
    }),
    loyaltyTransactions: await db.loyaltyTransaction.count({
      where: { idempotencyKey: { startsWith: 'demo:loyalty:' } },
    }),
    giftCards: await db.giftCard.count({
      where: { recipientEmail: { contains: '.demo@' } },
    }),
    giftCardPurchases: await db.giftCardPurchase.count({
      where: { idempotencyKey: { startsWith: 'demo:gift-card-purchase:' } },
    }),
    fiscalDocuments: await db.fiscalDocument.count({
      where: { idempotencyKey: { startsWith: 'demo:fiscal:' } },
    }),
  };

  const minima: Record<keyof typeof counts, number> = {
    categories: 6,
    products: 12,
    users: 9,
    orders: 10,
    stockItems: 12,
    stockMovements: 12,
    suppliers: 3,
    purchases: 3,
    purchaseReceipts: 2,
    inventories: 2,
    priceLists: 2,
    businessAccounts: 2,
    resellerApplications: 3,
    promotions: 3,
    coupons: 2,
    bundles: 1,
    shipments: 3,
    returns: 2,
    supportCases: 2,
    production: 3,
    receivables: 3,
    clubPlans: 3,
    clubSubscriptions: 4,
    clubCharges: 3,
    loyaltyAccounts: 5,
    loyaltyTransactions: 5,
    giftCards: 3,
    giftCardPurchases: 2,
    fiscalDocuments: 8,
  };

  const failures = Object.entries(minima)
    .filter(([key, minimum]) => counts[key as keyof typeof counts] < minimum)
    .map(
      ([key, minimum]) =>
        `${key}: ${counts[key as keyof typeof counts]} < ${minimum}`,
    );

  if (failures.length) {
    throw new Error(`Ambiente demo incompleto: ${failures.join('; ')}`);
  }

  console.log(JSON.stringify({ ok: true, counts }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
