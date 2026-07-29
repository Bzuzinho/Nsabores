import { BundleDetailAdmin } from '../../../components/bundle-detail-admin';

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BundleDetailAdmin id={id} />;
}
