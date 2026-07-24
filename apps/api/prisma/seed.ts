import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, StockStatus } from '@prisma/client';

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
    await prisma.product.upsert({ where: { sku }, update: data, create: data });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
