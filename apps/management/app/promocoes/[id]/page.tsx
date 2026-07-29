import { PromotionDetailAdmin } from '../../../components/promotion-detail-admin';

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PromotionDetailAdmin id={id} />;
}
