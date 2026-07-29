'use client';

import { useParams } from 'next/navigation';
import { ClubJoin } from '@/components/club-plans';

export default function ClubJoinPage() {
  const { code } = useParams<{ code: string }>();
  return (
    <main className="contact-page">
      <ClubJoin code={decodeURIComponent(code)} />
    </main>
  );
}
