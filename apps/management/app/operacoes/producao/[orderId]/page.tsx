'use client';

import { useParams } from 'next/navigation';
import { ProductionDetail } from '@/components/production-admin';

export default function ProductionOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  return <ProductionDetail orderId={orderId} />;
}
