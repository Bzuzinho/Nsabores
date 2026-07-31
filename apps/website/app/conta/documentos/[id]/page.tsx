'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

type DocumentLine = {
  id: string;
  position: number;
  description: string;
  sku?: string | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

type AccountDocument = {
  id: string;
  type: string;
  status: string;
  number?: string | null;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  customerSnapshot: Record<string, unknown>;
  billingSnapshot: Record<string, unknown>;
  issuedAt?: string | null;
  sourceType: string;
  externalDocumentUrl?: string | null;
  lines: DocumentLine[];
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

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
            <p className="eyebrow">Documento comercial</p>
            <h1>{document.number ?? 'Documento sem número'}</h1>
            <p>
              {document.type} · {document.status} ·{' '}
              {document.issuedAt
                ? new Date(document.issuedAt).toLocaleString('pt-PT')
                : 'Sem data de emissão'}
            </p>
            <p>
              Cliente: {text(document.customerSnapshot.name)} ·{' '}
              {text(document.customerSnapshot.email)}
            </p>
            <p>
              Subtotal {money(document.subtotalCents, document.currency)} · descontos{' '}
              {money(document.discountCents, document.currency)} · imposto{' '}
              {money(document.taxCents, document.currency)}
            </p>
            <p>
              <strong>Total: {money(document.totalCents, document.currency)}</strong>
            </p>

            <h2>Linhas</h2>
            {document.lines.map((line) => (
              <article key={line.id} className="account-card">
                <p>
                  <strong>{line.description}</strong>
                  {line.sku ? ` · ${line.sku}` : ''}
                </p>
                <p>
                  {line.quantity} × {money(line.unitPriceCents, document.currency)} ={' '}
                  {money(line.totalCents, document.currency)}
                </p>
              </article>
            ))}

            {document.externalDocumentUrl && (
              <p>
                <a href={document.externalDocumentUrl} rel="noreferrer">
                  Abrir documento externo associado
                </a>
              </p>
            )}
            <p>
              Esta visualização é uma representação interna e não substitui um
              documento emitido por software de faturação certificado.
            </p>
            <Link href="/conta/documentos">Voltar aos documentos</Link>
          </>
        )}
      </section>
    </main>
  );
}
