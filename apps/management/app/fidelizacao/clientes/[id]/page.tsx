import { LoyaltyCustomerDetail } from '../../../../components/loyalty-detail';

export default async function LoyaltyCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LoyaltyCustomerDetail userId={id} />;
}
