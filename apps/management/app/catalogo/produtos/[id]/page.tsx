import { CatalogAdmin } from '@/components/catalog-admin';
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CatalogAdmin mode="product-form" productId={id} />;
}
