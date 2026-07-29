import { BundleCustomizer } from '@/components/bundle-customizer';

export default async function BundlePersonalizePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BundleCustomizer slug={slug} />;
}
