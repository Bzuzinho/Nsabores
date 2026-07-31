'use client';

import { useParams } from 'next/navigation';
import { FiscalDocumentDetail } from '../../../components/fiscal-documents-admin';

export default function FiscalDocumentPage() {
  const { id } = useParams<{ id: string }>();
  return <FiscalDocumentDetail id={id} />;
}
