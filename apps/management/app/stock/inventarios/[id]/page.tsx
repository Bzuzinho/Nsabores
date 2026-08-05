import { InventoryAdmin } from '../../../../components/inventory-admin';

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InventoryAdmin inventoryId={id} />;
}
