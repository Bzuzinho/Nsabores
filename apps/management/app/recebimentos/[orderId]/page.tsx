'use client';

import { useParams } from 'next/navigation';
import { ReceivableDetail } from '../../../components/receivables-admin';

export default function ReceivablePage() {
  const { orderId } = useParams<{ orderId: string }>();
  return <ReceivableDetail orderId={orderId} />;
}
