import { db, demoProductSkus, prisma } from './demo-shared';

async function main() {
  const demoOrders = await db.order.findMany({
    where: { source: 'DEMO_SEED' },
    select: { id: true },
  });
  const orderIds = demoOrders.map((order: any) => order.id);
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

  const documents = await db.fiscalDocument.findMany({
    where: { idempotencyKey: { startsWith: 'demo:fiscal:' } },
    select: { id: true },
  });
  const documentIds = documents.map((document: any) => document.id);
  if (documentIds.length) {
    await db.fiscalDocumentEvent.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await db.fiscalDocumentLine.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await db.fiscalDocument.deleteMany({ where: { id: { in: documentIds } } });
  }
  await db.fiscalSeries.deleteMany({
    where: { code: { startsWith: 'DEMO-' } },
  });

  const giftCards = await db.giftCard.findMany({
    where: { recipientEmail: { contains: '.demo@' } },
    select: { id: true },
  });
  const giftCardIds = giftCards.map((card: any) => card.id);
  await db.giftCardPurchase.deleteMany({
    where: { idempotencyKey: { startsWith: 'demo:gift-card-purchase:' } },
  });
  if (giftCardIds.length) {
    await db.giftCardTransaction.deleteMany({
      where: { giftCardId: { in: giftCardIds } },
    });
    await db.giftCard.deleteMany({ where: { id: { in: giftCardIds } } });
  }

  const loyaltyAccounts = await db.loyaltyAccount.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const loyaltyAccountIds = loyaltyAccounts.map((account: any) => account.id);
  if (loyaltyAccountIds.length) {
    await db.loyaltyTransaction.deleteMany({
      where: { accountId: { in: loyaltyAccountIds } },
    });
    await db.loyaltyAccount.deleteMany({
      where: { id: { in: loyaltyAccountIds } },
    });
  }
  await db.loyaltyRule.deleteMany({ where: { code: { startsWith: 'DEMO-' } } });

  const subscriptions = await db.clubSubscription.findMany({
    where: {
      providerSubscriptionId: { startsWith: 'demo-club-subscription-' },
    },
    select: { id: true },
  });
  const subscriptionIds = subscriptions.map(
    (subscription: any) => subscription.id,
  );
  if (subscriptionIds.length) {
    await db.clubSubscriptionCharge.deleteMany({
      where: { subscriptionId: { in: subscriptionIds } },
    });
    await db.clubSubscriptionEvent.deleteMany({
      where: { subscriptionId: { in: subscriptionIds } },
    });
    await db.clubSubscription.deleteMany({
      where: { id: { in: subscriptionIds } },
    });
  }
  await db.clubPlan.deleteMany({ where: { code: { startsWith: 'DEMO-' } } });

  const agreements = await db.paymentAgreement.findMany({
    where: { internalReference: { startsWith: 'DEMO-AGR-' } },
    select: { id: true },
  });
  const agreementIds = agreements.map((agreement: any) => agreement.id);
  if (agreementIds.length) {
    await db.paymentContactEvent.deleteMany({
      where: { agreementId: { in: agreementIds } },
    });
    await db.paymentAgreement.deleteMany({
      where: { id: { in: agreementIds } },
    });
  }
  await db.productionWorkOrder.deleteMany({
    where: { productionNotes: { contains: 'ambiente de demonstração' } },
  });

  if (orderIds.length) {
    await db.couponRedemption.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await db.orderDiscount.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.stockReservation.deleteMany({
      where: { orderId: { in: orderIds } },
    });

    const supportCases = await db.supportCase.findMany({
      where: { number: { startsWith: 'DEMO-SUP-' } },
      select: { id: true },
    });
    const supportCaseIds = supportCases.map((support: any) => support.id);
    if (supportCaseIds.length) {
      await db.supportCaseComment.deleteMany({
        where: { supportCaseId: { in: supportCaseIds } },
      });
      await db.supportCase.deleteMany({
        where: { id: { in: supportCaseIds } },
      });
    }

    const returns = await db.returnRequest.findMany({
      where: { number: { startsWith: 'DEMO-RMA-' } },
      select: { id: true },
    });
    const returnIds = returns.map((request: any) => request.id);
    if (returnIds.length) {
      await db.returnEvent.deleteMany({
        where: { returnRequestId: { in: returnIds } },
      });
      await db.returnItem.deleteMany({
        where: { returnRequestId: { in: returnIds } },
      });
      await db.returnRequest.deleteMany({ where: { id: { in: returnIds } } });
    }

    const shipments = await db.shipment.findMany({
      where: { number: { startsWith: 'DEMO-SHP-' } },
      select: { id: true },
    });
    const shipmentIds = shipments.map((shipment: any) => shipment.id);
    if (shipmentIds.length) {
      await db.shipmentEvent.deleteMany({
        where: { shipmentId: { in: shipmentIds } },
      });
      await db.shipmentItem.deleteMany({
        where: { shipmentId: { in: shipmentIds } },
      });
      await db.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
    }
  }

  if (productIds.length) {
    await db.productPersonalization.deleteMany({
      where: { productId: { in: productIds } },
    });
    const bundles = await db.productBundle.findMany({
      where: { productId: { in: productIds } },
      select: { id: true },
    });
    const bundleIds = bundles.map((bundle: any) => bundle.id);
    if (bundleIds.length) {
      await db.productBundleItem.deleteMany({
        where: { bundleId: { in: bundleIds } },
      });
      await db.productBundleGroup.deleteMany({
        where: { bundleId: { in: bundleIds } },
      });
      await db.productBundle.deleteMany({ where: { id: { in: bundleIds } } });
    }
  }

  const promotions = await db.promotion.findMany({
    where: { code: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const promotionIds = promotions.map((promotion: any) => promotion.id);
  if (promotionIds.length) {
    await db.coupon.deleteMany({
      where: { promotionId: { in: promotionIds } },
    });
    await db.promotionTarget.deleteMany({
      where: { promotionId: { in: promotionIds } },
    });
    await db.promotion.deleteMany({ where: { id: { in: promotionIds } } });
  }

  const businessAccounts = await db.businessAccount.findMany({
    where: { taxNumber: { startsWith: '509990' } },
    select: { id: true },
  });
  const businessAccountIds = businessAccounts.map((account: any) => account.id);
  if (businessAccountIds.length) {
    await db.businessAccountUser.deleteMany({
      where: { businessAccountId: { in: businessAccountIds } },
    });
    await db.businessAccount.deleteMany({
      where: { id: { in: businessAccountIds } },
    });
  }
  await db.resellerApplication.deleteMany({
    where: { email: { contains: '.demo@nsabores.pt' } },
  });

  const priceLists = await db.priceList.findMany({
    where: { code: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const priceListIds = priceLists.map((list: any) => list.id);
  if (priceListIds.length) {
    await db.priceListItem.deleteMany({
      where: { priceListId: { in: priceListIds } },
    });
    await db.priceList.deleteMany({ where: { id: { in: priceListIds } } });
  }

  const inventories = await db.inventoryCount.findMany({
    where: { number: { startsWith: 'DEMO-INV-' } },
    select: { id: true },
  });
  const inventoryIds = inventories.map((inventory: any) => inventory.id);
  if (inventoryIds.length) {
    await db.inventoryCountItem.deleteMany({
      where: { inventoryCountId: { in: inventoryIds } },
    });
    await db.inventoryCount.deleteMany({ where: { id: { in: inventoryIds } } });
  }

  const receipts = await db.purchaseReceipt.findMany({
    where: { number: { startsWith: 'DEMO-REC-' } },
    select: { id: true },
  });
  const receiptIds = receipts.map((receipt: any) => receipt.id);
  if (receiptIds.length) {
    await db.purchaseReceiptItem.deleteMany({
      where: { purchaseReceiptId: { in: receiptIds } },
    });
    await db.purchaseReceipt.deleteMany({ where: { id: { in: receiptIds } } });
  }
  const purchases = await db.purchaseOrder.findMany({
    where: { number: { startsWith: 'DEMO-PO-' } },
    select: { id: true },
  });
  const purchaseIds = purchases.map((purchase: any) => purchase.id);
  if (purchaseIds.length) {
    await db.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: { in: purchaseIds } },
    });
    await db.purchaseOrder.deleteMany({ where: { id: { in: purchaseIds } } });
  }

  const suppliers = await db.supplier.findMany({
    where: { email: { contains: '.demo@nsabores.pt' } },
    select: { id: true },
  });
  const supplierIds = suppliers.map((supplier: any) => supplier.id);
  if (supplierIds.length) {
    await db.supplierProduct.deleteMany({
      where: { supplierId: { in: supplierIds } },
    });
    await db.supplier.deleteMany({ where: { id: { in: supplierIds } } });
  }

  await db.stockMovement.deleteMany({
    where: { idempotencyKey: { startsWith: 'demo:' } },
  });

  console.log('Dependências e módulos avançados de demonstração removidos.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
