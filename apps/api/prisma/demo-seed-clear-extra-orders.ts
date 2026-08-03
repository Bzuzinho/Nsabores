import { db, prisma } from './demo-shared';

async function main() {
  const orders = await db.order.findMany({
    where: { number: { in: ['DEMO-0009', 'DEMO-0010'] } },
    select: { id: true },
  });
  const orderIds = orders.map((order: any) => order.id);
  if (!orderIds.length) {
    console.log('Sem encomendas demo avançadas para remover.');
    return;
  }

  const supportCases = await db.supportCase.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const supportCaseIds = supportCases.map((support: any) => support.id);
  if (supportCaseIds.length) {
    await db.supportCaseComment.deleteMany({
      where: { supportCaseId: { in: supportCaseIds } },
    });
    await db.supportCase.deleteMany({ where: { id: { in: supportCaseIds } } });
  }

  const returns = await db.returnRequest.findMany({
    where: { orderId: { in: orderIds } },
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
    where: { orderId: { in: orderIds } },
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

  const agreements = await db.paymentAgreement.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const agreementIds = agreements.map((agreement: any) => agreement.id);
  if (agreementIds.length) {
    await db.paymentContactEvent.deleteMany({
      where: { agreementId: { in: agreementIds } },
    });
    await db.paymentAgreement.deleteMany({ where: { id: { in: agreementIds } } });
  }

  await db.productionWorkOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.orderDiscount.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.stockReservation.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });

  console.log(`Removidas ${orderIds.length} encomendas demo avançadas.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
