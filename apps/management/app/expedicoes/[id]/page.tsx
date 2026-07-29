'use client';

import { useParams } from 'next/navigation';
import { ShipmentAdminDetail } from '@/components/fulfillment-detail';

export default function ShipmentPage() {
  const { id } = useParams<{ id: string }>();
  return <ShipmentAdminDetail id={id} />;
}
