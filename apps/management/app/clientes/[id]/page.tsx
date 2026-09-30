import { CustomersAdmin } from '@/components/customers-admin';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomersAdmin selectedId={id} />;
}
