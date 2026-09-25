'use client';

import Link from 'next/link';
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

export default function AccountDocumentsPage() {
  const [documents, setDocuments] = useState<AccountDocument[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void accountApi
      .get<AccountDocument[]>('/v1/account/documents')
      .then((value) => {
        if (active) setDocuments(value);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar os documentos.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="conteudo" className="account-page">
      <section className="account-card">
        <p className="eyebrow">Documentos</p>
        <h1>Documentos dos seus pedidos</h1>
        <p>
          Aqui ficam os documentos reais que a Nsabores disponibiliza depois de
          os emitir ou receber. Cada documento permanece associado à respetiva
          encomenda.
        </p>

        {error && <p role="alert">{error}</p>}
        {!documents ? (
          <p>A carregar…</p>
        ) : !documents.length ? (
          <p>
            Ainda não existem documentos disponíveis. Pode continuar a consultar
            os pedidos em <Link href="/conta/encomendas">Encomendas</Link>.
          </p>
        ) : (
          documents.map((document) => (
            <article key={document.id} className="account-card">
              <p>
                <strong>{document.label}</strong> ·{' '}
                {labels[document.type] ?? document.type}
              </p>
              <p>
                Encomenda{' '}
                <Link href={`/conta/encomendas/${document.order.id}`}>
                  {document.order.number}
                </Link>
                {document.reference ? ` · ${document.reference}` : ''}
              </p>
              <p>
                {new Date(
                  document.documentDate ?? document.createdAt,
                ).toLocaleDateString('pt-PT')}
              </p>
              <p>
                <Link href={`/conta/documentos/${document.id}`}>
                  Ver documento
                </Link>{' '}
                ·{' '}
                <a href={`/v1/account/documents/${document.id}/download`}>
                  Descarregar
                </a>
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
