'use client';

import { useParams } from 'next/navigation';
import { CreditNoteAdmin } from '../../../../components/credit-note-admin';

export default function CreditNotePage() {
  const { id } = useParams<{ id: string }>();
  return <CreditNoteAdmin documentId={id} />;
}
