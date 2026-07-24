import { randomUUID } from 'node:crypto';
import {
  BusinessAccountUserRole,
  OrderStatus,
  PaymentStatus,
  PriceListType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../src/prisma.service';
import { OperationsService } from '../src/operations/operations.service';

const prisma = new PrismaService();
const operations = new OperationsService(prisma);
const address = {
  line1: 'Rua de validação, 18',
  postalCode: '1000-018',
  city: 'Lisboa',
  countryCode: 'PT',
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const product = await prisma.product.findFirstOrThrow();
  const delivery = await prisma.deliveryMethod.findFirstOrThrow({
    where: { isActive: true },
  });
  const admin = await prisma.user.create({
    data: {
      email: `admin-${randomUUID()}@example.invalid`,
      passwordHash: 'validation-only-not-a-real-password',
      firstName: 'Validação',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  const supplier = await operations.createSupplier({
    tradeName: 'Fornecedor fluxo 18',
    email: 'supplier-flow@example.invalid',
    phone: '+351000000018',
    address,
  });
  const purchase = await operations.createPurchase(
    {
      supplierId: supplier.id,
      items: [
        {
          productId: product.id,
          supplierSku: 'FLOW-18',
          description: product.name,
          orderedQuantity: 10,
          unitCostCents: 100,
        },
      ],
    },
    admin.id,
  );
  const beforeReceipt = await prisma.stockItem.findUniqueOrThrow({
    where: { productId: product.id },
  });
  await operations.receivePurchase(
    purchase.id,
    {
      idempotencyKey: `receipt-${randomUUID()}`,
      items: [{ purchaseOrderItemId: purchase.items[0]!.id, quantity: 10 }],
    },
    admin.id,
  );
  const afterReceipt = await prisma.stockItem.findUniqueOrThrow({
    where: { productId: product.id },
  });
  assert(
    afterReceipt.onHandQuantity === beforeReceipt.onHandQuantity + 10,
    'Compra → receção → entrada de stock falhou.',
  );

  async function order() {
    return prisma.order.create({
      data: {
        number: `FLOW-${randomUUID()}`,
        email: 'flow@example.invalid',
        customerName: 'Fluxo completo',
        phone: '+351000000018',
        subtotalCents: product.priceCents * 2,
        shippingCents: 0,
        totalCents: product.priceCents * 2,
        billingAddress: address,
        shippingAddress: address,
        deliveryMethodId: delivery.id,
        idempotencyKey: randomUUID(),
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitPriceCents: product.priceCents,
            quantity: 2,
            totalCents: product.priceCents * 2,
          },
        },
      },
    });
  }

  const fulfilledOrder = await order();
  await operations.reserveOrder(fulfilledOrder.id);
  await prisma.order.update({
    where: { id: fulfilledOrder.id },
    data: { status: OrderStatus.PAID, paymentStatus: PaymentStatus.PAID },
  });
  await operations.fulfillOrder(fulfilledOrder.id);
  const consumed = await prisma.stockReservation.findFirstOrThrow({
    where: { orderId: fulfilledOrder.id },
  });
  assert(consumed.status === 'CONSUMED', 'Encomenda → expedição falhou.');

  const cancelledOrder = await order();
  await operations.reserveOrder(cancelledOrder.id);
  await operations.releaseOrder(cancelledOrder.id);
  const released = await prisma.stockReservation.findFirstOrThrow({
    where: { orderId: cancelledOrder.id },
  });
  assert(released.status === 'RELEASED', 'Cancelamento → libertação falhou.');

  const priceList = await operations.createPriceList({
    name: 'Tabela validação B2B',
    code: `FLOW-${randomUUID()}`,
    type: PriceListType.RESELLER,
    items: [{ productId: product.id, priceCents: 123, minimumQuantity: 2 }],
  });
  const application = await operations.apply({
    tradeName: 'Revendedor fluxo 18',
    legalName: 'Revendedor fluxo 18, Lda.',
    taxNumber: `${Math.floor(100000000 + Math.random() * 899999999)}`,
    contactName: 'Pessoa de validação',
    email: 'b2b-flow@example.invalid',
    phone: '+351000000018',
    address,
    activity: 'Retalho alimentar',
  });
  const account = await operations.decideApplication(
    application.id,
    { approved: true, priceListId: priceList.id },
    admin.id,
  );
  const buyer = await prisma.user.create({
    data: {
      email: `buyer-${randomUUID()}@example.invalid`,
      passwordHash: 'validation-only-not-a-real-password',
      firstName: 'Comprador',
      lastName: 'B2B',
    },
  });
  await prisma.businessAccountUser.create({
    data: {
      businessAccountId: account.id,
      userId: buyer.id,
      role: BusinessAccountUserRole.OWNER,
    },
  });
  const b2bOrder = await operations.createB2BOrder(
    buyer.id,
    product.id,
    2,
    'REF-FLOW-18',
  );
  assert(
    b2bOrder.salesChannel === 'B2B' &&
      b2bOrder.priceListId === priceList.id &&
      b2bOrder.items[0]?.unitPriceCents === 123,
    'Candidatura → aprovação → preço → encomenda B2B falhou.',
  );

  const results: Record<string, string> = {
    purchaseReceiptStock: 'ok',
    orderReservePaymentShipment: 'ok',
    cancellationRelease: 'ok',
    applicationApprovalPricingB2BOrder: 'ok',
  };
  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
