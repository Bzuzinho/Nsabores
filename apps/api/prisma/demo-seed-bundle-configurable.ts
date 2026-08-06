import { db, prisma, requiredProduct } from './demo-shared';

async function main() {
  const cabaz = await requiredProduct('CAB-PORTUGAL');
  const bundle = await db.productBundle.findUnique({
    where: { productId: cabaz.id },
  });

  if (!bundle) {
    throw new Error('Cabaz Portugal demo não encontrado.');
  }

  await db.productBundle.update({
    where: { id: bundle.id },
    data: {
      mode: 'CONFIGURABLE',
      pricingMode: 'COMPONENT_TOTAL',
      minimumSelections: 1,
      maximumSelections: 12,
      isActive: true,
    },
  });

  await db.productBundleItem.updateMany({
    where: { bundleId: bundle.id },
    data: {
      quantity: 1,
      isRequired: false,
      minimumQuantity: 0,
      maximumQuantity: 4,
      isActive: true,
    },
  });

  console.log('Cabaz Portugal demo configurado para adicionar, remover e alterar quantidades.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
