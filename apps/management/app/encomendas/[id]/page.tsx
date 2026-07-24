'use client';
import { useParams } from 'next/navigation';
import { OrderAdmin } from '@/components/orders-admin';
export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  return <OrderAdmin id={id} />;
}
