import { PrismaPg } from '@prisma/adapter-pg';
import {
  DeliveryMethodType,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  StockStatus,
  UserRole,
} from '@prisma/client';
import argon2 from 'argon2';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/nsabores';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const demoPassword = process.env.DEMO_USER_PASSWORD;
const configuredPasswordHash =
  process.env.DEMO_USER_PASSWORD_HASH ??
  process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH;

const demoCategories = [
  ['Tábuas', 'tabuas'],
  ['Queijos', 'queijos'],
  ['Enchidos', 'enchidos'],
  ['Cabazes', 'cabazes'],
  ['Vinhos', 'vinhos'],
  ['Outros sabores', 'outros-sabores'],
] as const;

const demoProducts = [
  ['Compota de Abóbora e Noz', 'compota-abobora-noz', 'COMP-ABO-NOZ', 590, 'outros-sabores'],
  ['Mel Multifloral', 'mel-multifloral', 'MEL-MULTI', 790, 'outros-sabores'],
  ['Azeite Virgem Extra', 'azeite-virgem-extra', 'AZE-VIRGEM', 990, 'outros-sabores'],
  ['Presunto Reserva', 'presunto-reserva', 'ENC-PRESUNTO', 1890, 'enchidos'],
  ['Salpicão Tradicional', 'salpicao-tradicional', 'ENC-SALPICAO', 990, 'enchidos'],
  ['Queijo de Cabra Curado', 'queijo-cabra-curado', 'QUE-CABRA', 890, 'queijos'],
  ['Queijo de Ovelha Amanteigado', 'queijo-ovelha-amanteigado', 'QUE-OVELHA', 1390, 'queijos'],
  ['Vinho Branco Reserva', 'vinho-branco-reserva', 'VIN-BRANCO', 1290, 'vinhos'],
  ['Espumante Bruto', 'espumante-bruto', 'VIN-ESPUMANTE', 1590, 'vinhos'],
  ['Tábua Essencial', 'tabua-essencial', 'TAB-ESSENCIAL', 2490, 'tabuas'],
  ['Tábua Celebração', 'tabua-celebracao', 'TAB-CELEBRACAO', 4490, 'tabuas'],
  ['Cabaz Portugal', 'cabaz-portugal', 'CAB-PORTUGAL', 5990, 'cabazes'],
] as const;

const demoUsers = [
  ['demo.staff@nsabores.pt', 'Marta', 'Operações', UserRole.STAFF],
  ['demo.cliente1@nsabores.pt', 'Ana', 'Martins', UserRole.CUSTOMER],
  ['demo.cliente2@nsabores.pt', 'João', 'Santos', UserRole.CUSTOMER],
  ['demo.cliente3@nsabores.pt', 'Sofia', 'Ferreira', UserRole.CUSTOMER],
  ['demo.cliente4@nsabores.pt', 'Miguel', 'Costa', UserRole.CUSTOMER],
  ['demo.cliente5@nsabores.pt', 'Inês', 'Rodrigues', UserRole.CUSTOMER],
] as const;

const orderStates = [
  [OrderStatus.PENDING_PAYMENT, PaymentStatus.PENDING],
  [OrderStatus.PAID, PaymentStatus.PAID],
  [OrderStatus.PROCESSING, PaymentStatus.PAID],
  [OrderStatus.READY, PaymentStatus.PAID],
  [OrderStatus.SHIPPED, PaymentStatus.PAID],
  [OrderStatus.DELIVERED, PaymentStatus.PAID],
  [OrderStatus.CANCELLED, PaymentStatus.CANCELLED],
  [OrderStatus.REFUNDED, PaymentStatus.REFUNDED],
] as const;

function demoAddress(name: string) {
  return {
    firstName: name,
    lastName: 'Demonstração',
    line1: 'Rua da Demonstração, 10',
    postalCode: '2460-000',
    city: 'Alcobaça',
    countryCode: 'PT',
    phone: '+351 910 000 000',
  };
}

async function seedFoundation() {
  for (const [index, [name, slug]] of demoCategories.entries()) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, isActive: true, sortOrder: index },
      create: { name, slug, isActive: true, sortOrder: index },
    });
  }

  await prisma.deliveryMethod.upsert({
    where: { code: 'standard-pt' },
    update: {
      name: 'Entrega standard — Portugal Continental',
      type: DeliveryMethodType.STANDARD,
      isActive: true,
      priceCents: 490,
      freeShippingAboveCents: 5000,
    },
    create: {
      code: 'standard-pt',
      name: 'Entrega standard — Portugal Continental',
      type: DeliveryMethodType.STANDARD,
      isActive: true,
      priceCents: 490,
      freeShippingAboveCents: 5000,
    },
  });

  await prisma.deliveryMethod.upsert({
    where: { code: 'local-pickup' },
    update: {
      name: 'Recolha local',
      type: DeliveryMethodType.LOCAL_PICKUP,
      isActive: true,
      priceCents: 0,
      freeShippingAboveCents: null,
    },
    create: {
      code: 'local-pickup',
      name: 'Recolha local',
      type: DeliveryMethodType.LOCAL_PICKUP,
      isActive: true,
      priceCents: 0,
    },
  });
}

async function seedProducts() {
  const categories = await prisma.category.findMany({
    where: { slug: { in: demoCategories.map(([, slug]) => slug) } },
  });
  const categoryIds = new Map(
    categories.map((category) => [category.slug, category.id]),
  );

  for (const [name, slug, sku, priceCents, categorySlug] of demoProducts) {
    const categoryId = categoryIds.get(categorySlug);
    if (!categoryId) {
      throw new Error(`Categoria demo em falta: ${categorySlug}`);
    }

    const product = await prisma.product.upsert({
      where: { sku },
      update: {
        name,
        slug,
        priceCents,
        categoryId,
        imageUrl: '/images/product-hamper-clean.jpg',
        shortDescription: 'Produto de demonstração para validação funcional.',
        isActive: true,
        isFeatured: true,
        stockStatus: StockStatus.IN_STOCK,
      },
      create: {
        name,
        slug,
        sku,
        priceCents,
        imageUrl: '/images/product-hamper-clean.jpg',
        shortDescription: 'Produto de demonstração para validação funcional.',
        categoryId,
        isActive: true,
        isFeatured: true,
        stockStatus: StockStatus.IN_STOCK,
      },
    });

    await prisma.stockItem.upsert({
      where: { productId: product.id },
      update: {
        onHandQuantity: 40 + (priceCents % 37),
        reservedQuantity: 0,
        reorderPoint: 10,
        reorderQuantity: 30,
        trackStock: true,
      },
      create: {
        productId: product.id,
        onHandQuantity: 40 + (priceCents % 37),
        reservedQuantity: 0,
        reorderPoint: 10,
        reorderQuantity: 30,
        trackStock: true,
      },
    });
  }
}

async function seedUsers() {
  const passwordHash = demoPassword
    ? await argon2.hash(demoPassword, { type: argon2.argon2id })
    : configuredPasswordHash;

  if (!passwordHash) {
    throw new Error(
      'Defina DEMO_USER_PASSWORD, DEMO_USER_PASSWORD_HASH ou BOOTSTRAP_ADMIN_PASSWORD_HASH para criar utilizadores demo.',
    );
  }

  for (const [email, firstName, lastName, role] of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        firstName,
        lastName,
        role,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    if (role === UserRole.CUSTOMER) {
      await prisma.customerProfile.upsert({
        where: { userId: user.id },
        update: {
          marketingConsent: true,
          marketingConsentAt: new Date(),
          notes: 'Conta de demonstração.',
        },
        create: {
          userId: user.id,
          marketingConsent: true,
          marketingConsentAt: new Date(),
          notes: 'Conta de demonstração.',
        },
      });
    }
  }
}

async function seedOrders() {
  const customers = await prisma.user.findMany({
    where: { email: { startsWith: 'demo.cliente' } },
    orderBy: { email: 'asc' },
  });
  const products = await prisma.product.findMany({
    where: { sku: { in: demoProducts.map(([, , sku]) => sku) } },
    orderBy: { sku: 'asc' },
  });
  const delivery = await prisma.deliveryMethod.findUnique({
    where: { code: 'standard-pt' },
  });

  if (!customers.length || products.length < 2 || !delivery) {
    throw new Error('Fundação insuficiente para criar encomendas demo.');
  }

  for (const [index, [status, paymentStatus]] of orderStates.entries()) {
    const customer = customers[index % customers.length]!;
    const first = products[index % products.length]!;
    const second = products[(index + 1) % products.length]!;
    const subtotalCents = first.priceCents + second.priceCents * 2;
    const shippingCents = subtotalCents >= 5000 ? 0 : 490;
    const number = `DEMO-${String(index + 1).padStart(4, '0')}`;

    const order = await prisma.order.upsert({
      where: { number },
      update: {
        userId: customer.id,
        email: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`,
        status,
        paymentStatus,
        subtotalCents,
        shippingCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: subtotalCents + shippingCents,
        source: 'DEMO_SEED',
        deliveryMethodId: delivery.id,
        internalNotes: 'Encomenda de demonstração gerada automaticamente.',
      },
      create: {
        number,
        userId: customer.id,
        email: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`,
        phone: '+351 910 000 000',
        status,
        paymentStatus,
        subtotalCents,
        shippingCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: subtotalCents + shippingCents,
        billingAddress: demoAddress(customer.firstName),
        shippingAddress: demoAddress(customer.firstName),
        source: 'DEMO_SEED',
        deliveryMethodId: delivery.id,
        idempotencyKey: `demo-order-${index + 1}`,
        internalNotes: 'Encomenda de demonstração gerada automaticamente.',
      },
    });

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order.id,
          productId: first.id,
          productName: first.name,
          sku: first.sku,
          unitPriceCents: first.priceCents,
          quantity: 1,
          totalCents: first.priceCents,
          imageUrl: first.imageUrl,
        },
        {
          orderId: order.id,
          productId: second.id,
          productName: second.name,
          sku: second.sku,
          unitPriceCents: second.priceCents,
          quantity: 2,
          totalCents: second.priceCents * 2,
          imageUrl: second.imageUrl,
        },
      ],
    });

    await prisma.payment.upsert({
      where: { providerPaymentId: `demo-payment-${index + 1}` },
      update: {
        orderId: order.id,
        status: paymentStatus,
        amountCents: subtotalCents + shippingCents,
      },
      create: {
        orderId: order.id,
        provider: 'demo',
        providerPaymentId: `demo-payment-${index + 1}`,
        method: index % 2 === 0 ? 'card' : 'bank_transfer',
        status: paymentStatus,
        amountCents: subtotalCents + shippingCents,
        idempotencyKey: `demo-payment-idempotency-${index + 1}`,
        metadata: { demo: true },
      },
    });

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id, toStatus: status },
    });
    if (!history) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          toStatus: status,
          note: 'Estado criado pelo seed de demonstração.',
        },
      });
    }
  }
}

async function main() {
  await seedFoundation();
  await seedProducts();
  await seedUsers();
  await seedOrders();

  const [categories, products, users, orders] = await Promise.all([
    prisma.category.count({
      where: { slug: { in: demoCategories.map(([, slug]) => slug) } },
    }),
    prisma.product.count({
      where: { sku: { in: demoProducts.map(([, , sku]) => sku) } },
    }),
    prisma.user.count({ where: { email: { startsWith: 'demo.' } } }),
    prisma.order.count({ where: { source: 'DEMO_SEED' } }),
  ]);

  if (
    categories !== demoCategories.length ||
    products !== demoProducts.length ||
    users !== demoUsers.length ||
    orders !== orderStates.length
  ) {
    throw new Error(
      `Seed demo incompleto: ${categories} categorias, ${products} produtos, ${users} utilizadores, ${orders} encomendas.`,
    );
  }

  console.log(
    `Demo seed concluído: ${categories} categorias, ${products} produtos, ${users} utilizadores e ${orders} encomendas demo.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
