'use client';

import { useParams } from 'next/navigation';
import { ClubSubscriptionDetail } from '../../../../components/club-detail';

export default function ClubSubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ClubSubscriptionDetail id={id} />;
}
