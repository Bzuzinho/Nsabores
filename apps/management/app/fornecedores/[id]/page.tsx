import { SuppliersAdmin } from '@/components/suppliers-admin';

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SuppliersAdmin supplierId={id} />;
}
