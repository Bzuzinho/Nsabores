'use client';

import { useParams } from 'next/navigation';
import { ReturnAdminDetail } from '@/components/fulfillment-detail';
import { ReturnRefundAction } from '@/components/return-refund-action';

export default function ReturnPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <ReturnAdminDetail id={id} />
      <ReturnRefundAction id={id} />
    </>
  );
}
