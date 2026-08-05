import { PurchaseDetailAdmin } from '../../../components/purchase-detail-admin';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseDetailAdmin id={id} />;
}
