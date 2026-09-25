'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

type AccountDocument = {
  id: string;
  type: string;
  label: string;
  reference?: string | null;
  documentDate?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  order: {
    id: string;
    number: string;
    createdAt: string;
  };
};

const labels: Record<string, string> = {
  INVOICE: 'Fatura',
  RECEIPT: 'Recibo',
  INVOICE_RECEIPT: 'Fatura-recibo',
  CREDIT_NOTE: 'Nota de crédito',
  DELIVERY_NOTE: 'Guia / documento de entrega',
  OTHER: 'Outro documento',
};

const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function AccountDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<AccountDocument | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void accountApi
      .get<AccountDocument>(`/v1/account/documents/${id}`)
      .then((value) => {
        if (active) setDocument(value);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar o documento.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main id="conteudo" className="account-page">
      <section className="account-card">
        {error && <p role="alert">{error}</p>}
        {!document ? (
          <p>A carregar…</p>
        ) : (
          <>
            <p className="eyebrow">{labels[document.type] ?? document.type}</p>
            <h1>{document.label}</h1>
            <p>
              Encomenda{' '}
              <Link href={`/conta/encomendas/${document.order.id}`}>
                {document.order.number}
              </Link>
            </p>
            {document.reference && <p>Referência: {document.reference}</p>}
            <p>
              Data:{' '}
              {new Date(
                document.documentDate ?? document.createdAt,
              ).toLocaleDateString('pt-PT')}
            </p>
            <p>
              Ficheiro: {document.fileName} · {size(document.sizeBytes)}
            </p>
            <p>
              <a
                className="button button-primary"
                href={`/v1/account/documents/${document.id}/download`}
              >
                Descarregar documento
              </a>
            </p>
            <Link href="/conta/documentos">Voltar aos documentos</Link>
          </>
        )}
      </section>
    </main>
  );
}
