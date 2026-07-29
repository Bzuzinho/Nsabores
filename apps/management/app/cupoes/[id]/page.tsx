import { CouponDetailAdmin } from '../../../components/coupon-detail-admin';

export default async function CouponDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CouponDetailAdmin id={id} />;
}
