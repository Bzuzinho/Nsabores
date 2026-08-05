'use client';
import { useParams } from 'next/navigation';
import { OrderDraftAdmin } from '@/components/order-draft-admin';
export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  return <OrderDraftAdmin id={id} />;
}
