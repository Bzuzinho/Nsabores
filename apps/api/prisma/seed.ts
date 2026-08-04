import { PrismaPg } from '@prisma/adapter-pg';
import {
  DeliveryMethodType,
  PriceListType,
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

const categories = [
  ['Tábuas', 'tabuas'],
  ['Queijos', 'queijos'],
  ['Enchidos', 'enchidos'],
  ['Cabazes', 'cabazes'],
  ['Vinhos', 'vinhos'],
  ['Outros sabores', 'outros-sabores'],
] as const;

const products = [
  [
    'Tábua Premium',
    'tabua-premium',
    'TAB-PREMIUM',
    3490,
    '/images/prod1.jpg',
    'tabuas',
    'Seleção de queijos, enchidos, compota e frutos secos.',
  ],
  [
    'Queijo Serra da Estrela',
    'queijo-serra-da-estrela',
    'QUE-SERRA',
    1250,
    '/images/prod2.jpg',
    'queijos',
    'Queijo de pasta amanteigada, intenso e tradicional.',
  ],
  [
    'Chouriço Regional',
    'chourico-regional',
    'ENC-CHOURICO',
    690,
    '/images/prod3.jpg',
    'enchidos',
    'Enchido português selecionado, ideal para petiscar.',
  ],
  [
    'Cabaz Gourmet',
    'cabaz-gourmet',
    'CAB-GOURMET',
    4990,
    '/images/product-hamper-clean.jpg',
    'cabazes',
    'Uma oferta completa, elegante e personalizável.',
  ],
  [
    'Vinho Tinto Reserva',
    'vinho-tinto-reserva',
    'VIN-RESERVA',
    1490,
    '/images/product-wine-clean.jpg',
    'vinhos',
    'Um tinto estruturado para acompanhar sabores intensos.',
  ],
] as const;

async function main() {
  const ids = new Map<string, string>();
  for (const [index, [name, slug]] of categories.entries()) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name, sortOrder: index, isActive: true },
      create: { name, slug, sortOrder: index },
    });
    ids.set(slug, category.id);
  }

  for (const [
    name,
    slug,
    sku,
    priceCents,
    imageUrl,
    categorySlug,
    shortDescription,
  ] of products) {
    const data = {
      name,
      slug,
      sku,
      priceCents,
      imageUrl,
      shortDescription,
      categoryId: ids.get(categorySlug)!,
      isFeatured: true,
      stockStatus: StockStatus.IN_STOCK,
    };
    const product = await prisma.product.upsert({
      where: { sku },
      update: data,
      create: data,
    });
    await prisma.stockItem.upsert({
      where: { productId: product.id },
      update: { trackStock: true },
      create: {
        productId: product.id,
        onHandQuantity: 100,
        reorderPoint: 15,
        reorderQuantity: 50,
      },
    });
  }

  const retail = await prisma.priceList.upsert({
    where: { code: 'RETAIL' },
    update: { name: 'Preço de venda ao público', isActive: true },
    create: {
      code: 'RETAIL',
      name: 'Preço de venda ao público',
      type: PriceListType.RETAIL,
      priority: 100,
    },
  });
  const reseller = await prisma.priceList.upsert({
    where: { code: 'RESELLER-BASE' },
    update: { name: 'Revendedores — base', isActive: true },
    create: {
      code: 'RESELLER-BASE',
      name: 'Revendedores — base',
      type: PriceListType.RESELLER,
      priority: 50,
      includesTax: false,
    },
  });
  const seededProducts = await prisma.product.findMany();
  for (const product of seededProducts) {
    await prisma.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: retail.id,
          productId: product.id,
        },
      },
      update: { priceCents: product.priceCents },
      create: {
        priceListId: retail.id,
        productId: product.id,
        priceCents: product.priceCents,
      },
    });
    await prisma.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: reseller.id,
          productId: product.id,
        },
      },
      update: { priceCents: Math.round(product.priceCents * 0.7) },
      create: {
        priceListId: reseller.id,
        productId: product.id,
        priceCents: Math.round(product.priceCents * 0.7),
        minimumQuantity: 6,
      },
    });
  }

  const supplier = await prisma.supplier.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: { tradeName: 'Fornecedor de demonstração', isActive: true },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      tradeName: 'Fornecedor de demonstração',
      legalName: 'Fornecedor de demonstração, Lda.',
      email: 'fornecedor@example.invalid',
      phone: '+351000000000',
      address: {
        line1: 'Morada de demonstração',
        postalCode: '0000-000',
        city: 'Lisboa',
        countryCode: 'PT',
      },
    },
  });
  for (const product of seededProducts) {
    await prisma.supplierProduct.upsert({
      where: {
        supplierId_productId: {
          supplierId: supplier.id,
          productId: product.id,
        },
      },
      update: { purchaseCostCents: Math.round(product.priceCents * 0.45) },
      create: {
        supplierId: supplier.id,
        productId: product.id,
        supplierSku: `SUP-${product.sku}`,
        purchaseCostCents: Math.round(product.priceCents * 0.45),
        isPreferred: true,
      },
    });
  }

  await prisma.deliveryMethod.upsert({
    where: { code: 'standard-pt' },
    update: {
      name: 'Entrega standard — desativada',
      type: DeliveryMethodType.STANDARD,
      isActive: false,
      priceCents: 0,
      freeShippingAboveCents: null,
    },
    create: {
      code: 'standard-pt',
      name: 'Entrega standard — desativada',
      type: DeliveryMethodType.STANDARD,
      isActive: false,
      priceCents: 0,
    },
  });
  await prisma.deliveryMethod.upsert({
    where: { code: 'case-by-case' },
    update: {
      name: 'Transporte a combinar com o cliente',
      type: DeliveryMethodType.STANDARD,
      isActive: true,
      priceCents: 0,
      freeShippingAboveCents: null,
    },
    create: {
      code: 'case-by-case',
      name: 'Transporte a combinar com o cliente',
      type: DeliveryMethodType.STANDARD,
      isActive: true,
      priceCents: 0,
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
      priceCents: 0,
    },
  });

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const adminFirstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim();
  const adminLastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim();
  if (adminEmail && adminPassword && adminFirstName && adminLastName) {
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: await argon2.hash(adminPassword, {
            type: argon2.argon2id,
          }),
          firstName: adminFirstName,
          lastName: adminLastName,
          role: UserRole.ADMIN,
          emailVerifiedAt: new Date(),
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
