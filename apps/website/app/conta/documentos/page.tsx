'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

type AccountDocument = {
  id: string;
  type: string;
  status: string;
  number?: string | null;
  currency: string;
  totalCents: number;
  issuedAt?: string | null;
  sourceType: string;
  externalDocumentUrl?: string | null;
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

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
        <p className="eyebrow">Documentos de demonstração</p>
        <h1>Os seus documentos comerciais</h1>
        <p role="alert">
          <strong>DEMONSTRAÇÃO — SEM VALOR FISCAL.</strong> Estes documentos
          simulam o fluxo de faturação da plataforma, mas não foram emitidos por
          software certificado e não devem ser usados para fins fiscais ou
          contabilísticos.
        </p>
        {error && <p role="alert">{error}</p>}
        {!documents ? (
          <p>A carregar…</p>
        ) : !documents.length ? (
          <p>Ainda não existem documentos disponíveis.</p>
        ) : (
          documents.map((document) => (
            <article key={document.id} className="account-card">
              <p>
                <strong>{document.number ?? 'Documento sem número'}</strong> ·{' '}
                {document.type} · {document.status}
              </p>
              <p>
                {money(document.totalCents, document.currency)} ·{' '}
                {document.issuedAt
                  ? new Date(document.issuedAt).toLocaleString('pt-PT')
                  : 'Sem data de emissão'}
              </p>
              <p>Origem: {document.sourceType}</p>
              <Link href={`/conta/documentos/${document.id}`}>
                Ver documento
              </Link>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
