import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/nsabores';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const demoProductSkus = [
  'COMP-ABO-NOZ',
  'MEL-MULTI',
  'AZE-VIRGEM',
  'ENC-PRESUNTO',
  'ENC-SALPICAO',
  'QUE-CABRA',
  'QUE-OVELHA',
  'VIN-BRANCO',
  'VIN-ESPUMANTE',
  'TAB-ESSENCIAL',
  'TAB-CELEBRACAO',
  'CAB-PORTUGAL',
] as const;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const demoOrders = await tx.order.findMany({
      where: { source: 'DEMO_SEED' },
      select: { id: true },
    });
    const orderIds = demoOrders.map((order) => order.id);

    if (orderIds.length > 0) {
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.orderStatusHistory.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    const demoUsers = await tx.user.findMany({
      where: { email: { startsWith: 'demo.' } },
      select: { id: true },
    });
    const userIds = demoUsers.map((user) => user.id);

    if (userIds.length > 0) {
      await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await tx.address.deleteMany({ where: { userId: { in: userIds } } });
      await tx.customerProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }

    const demoProducts = await tx.product.findMany({
      where: { sku: { in: [...demoProductSkus] } },
      select: { id: true },
    });
    const productIds = demoProducts.map((product) => product.id);

    if (productIds.length > 0) {
      await tx.stockItem.deleteMany({
        where: { productId: { in: productIds } },
      });
      await tx.product.deleteMany({ where: { id: { in: productIds } } });
    }

    return {
      orders: orderIds.length,
      users: userIds.length,
      products: productIds.length,
    };
  });

  console.log(
    `Demo removida: ${result.orders} encomendas, ${result.users} utilizadores e ${result.products} produtos.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
