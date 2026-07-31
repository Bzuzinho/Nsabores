'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FiscalDocumentDetail } from '../../../components/fiscal-documents-admin';
import { FiscalProviderAdmin } from '../../../components/fiscal-provider-admin';

export default function FiscalDocumentPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <FiscalDocumentDetail id={id} />
      <FiscalProviderAdmin id={id} />
      <p>
        <Link className="admin-primary" href={`/documentos/${id}/nota-credito`}>
          Emitir nota de crédito
        </Link>
      </p>
    </>
  );
}
