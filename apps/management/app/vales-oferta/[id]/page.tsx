import { GiftCardDetail } from '../../../components/loyalty-detail';

export default async function GiftCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GiftCardDetail id={id} />;
}
