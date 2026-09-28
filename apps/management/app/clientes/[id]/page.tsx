'use client';
import { useParams } from 'next/navigation';
import { CustomersAdmin } from '@/components/customers-admin';

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  return <CustomersAdmin selectedId={id} />;
}
