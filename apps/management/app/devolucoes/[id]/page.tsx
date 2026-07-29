'use client';

import { useParams } from 'next/navigation';
import { ReturnAdminDetail } from '@/components/fulfillment-detail';

export default function ReturnPage() {
  const { id } = useParams<{ id: string }>();
  return <ReturnAdminDetail id={id} />;
}
