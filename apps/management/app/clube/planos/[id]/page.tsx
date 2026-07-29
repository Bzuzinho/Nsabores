'use client';

import { useParams } from 'next/navigation';
import { ClubPlanDetail } from '../../../../components/club-detail';

export default function ClubPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ClubPlanDetail id={id} />;
}
