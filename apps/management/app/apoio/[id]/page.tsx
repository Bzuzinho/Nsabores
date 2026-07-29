'use client';

import { useParams } from 'next/navigation';
import { SupportAdminDetail } from '@/components/fulfillment-detail';

export default function SupportCasePage() {
  const { id } = useParams<{ id: string }>();
  return <SupportAdminDetail id={id} />;
}
