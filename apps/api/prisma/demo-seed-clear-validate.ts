import { db, demoProductSkus, prisma } from './demo-shared';

async function main() {
  const counts = {
    products: await db.product.count({ where: { sku: { in: [...demoProductSkus] } } }),
    users: await db.user.count({ where: { email: { startsWith: 'demo.' } } }),
    orders: await db.order.count({ where: { source: 'DEMO_SEED' } }),
    suppliers: await db.supplier.count({
      where: { email: { contains: '.demo@nsabores.pt' } },
    }),
    purchases: await db.purchaseOrder.count({
      where: { number: { startsWith: 'DEMO-PO-' } },
    }),
    inventories: await db.inventoryCount.count({
      where: { number: { startsWith: 'DEMO-INV-' } },
    }),
    priceLists: await db.priceList.count({ where: { code: { startsWith: 'DEMO-' } } }),
    promotions: await db.promotion.count({ where: { code: { startsWith: 'DEMO-' } } }),
    shipments: await db.shipment.count({ where: { number: { startsWith: 'DEMO-SHP-' } } }),
    returns: await db.returnRequest.count({ where: { number: { startsWith: 'DEMO-RMA-' } } }),
    support: await db.supportCase.count({ where: { number: { startsWith: 'DEMO-SUP-' } } }),
    clubPlans: await db.clubPlan.count({ where: { code: { startsWith: 'DEMO-' } } }),
    giftPurchases: await db.giftCardPurchase.count({
      where: { idempotencyKey: { startsWith: 'demo:gift-card-purchase:' } },
    }),
    fiscal: await db.fiscalDocument.count({
      where: { idempotencyKey: { startsWith: 'demo:fiscal:' } },
    }),
  };

  const remaining = Object.entries(counts).filter(([, count]) => count !== 0);
  if (remaining.length) {
    throw new Error(
      `Limpeza demo incompleta: ${remaining.map(([key, count]) => `${key}=${count}`).join(', ')}`,
    );
  }
  console.log('Limpeza demo validada: nenhum dado identificável permaneceu.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
