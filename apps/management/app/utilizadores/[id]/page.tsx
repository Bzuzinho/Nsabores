import { UsersAdmin } from '@/components/users-admin';
export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UsersAdmin selectedId={id} />;
}
