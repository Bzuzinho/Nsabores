'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

type FiscalSeries = {
  id: string;
  code: string;
  prefix: string;
  year: number;
};

type FiscalLine = {
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

type FiscalEvent = {
  id: string;
  type: string;
  note?: string | null;
  createdAt: string;
};

type FiscalDocument = {
  id: string;
  type: string;
  status: string;
  sourceType: string;
  sourceId?: string | null;
  number?: string | null;
  provider: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  issuedAt?: string | null;
  createdAt: string;
  customerSnapshot: Record<string, unknown>;
  billingSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  series?: FiscalSeries;
  lines?: FiscalLine[];
  events?: FiscalEvent[];
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function FiscalDocumentsAdmin() {
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [orderId, setOrderId] = useState('');
  const [documentType, setDocumentType] = useState('INVOICE_RECEIPT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setDocuments(
      await managementApi.get<FiscalDocument[]>('/v1/admin/fiscal/documents'),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void managementApi
      .get<FiscalDocument[]>('/v1/admin/fiscal/documents')
      .then((response) => {
        if (!cancelled) setDocuments(response);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar os documentos.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      documents.filter(
        (document) =>
          (!status || document.status === status) &&
          (!type || document.type === type) &&
          (!source || document.sourceType === source),
      ),
    [documents, source, status, type],
  );

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const issued = await managementApi.post<FiscalDocument>(
        `/v1/admin/fiscal/orders/${orderId.trim()}/issue`,
        { type: documentType },
      );
      setOrderId('');
      await reload();
      window.location.assign(`/documentos/${issued.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível emitir o documento.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Faturação</p>
          <h1>Documentos comerciais</h1>
          <p>
            Emissão manual auditável. Estes documentos não substituem faturação
            certificada.
          </p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card">
        <h2>Emitir a partir de encomenda paga</h2>
        <form className="admin-filters" onSubmit={issue}>
          <input
            aria-label="ID da encomenda"
            placeholder="UUID da encomenda"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            required
          />
          <select
            aria-label="Tipo de documento"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            <option value="INVOICE_RECEIPT">Fatura-recibo</option>
            <option value="INVOICE">Fatura</option>
            <option value="RECEIPT">Recibo</option>
            <option value="PROFORMA">Proforma</option>
          </select>
          <button className="admin-primary" disabled={busy || !orderId.trim()}>
            {busy ? 'A emitir…' : 'Emitir documento'}
          </button>
        </form>
      </section>

      <div className="admin-filters">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Todos os estados</option>
          {['DRAFT', 'ISSUED', 'CANCELLED', 'CREDITED', 'FAILED'].map(
            (value) => <option key={value}>{value}</option>,
          )}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Todos os tipos</option>
          {[
            'INVOICE',
            'INVOICE_RECEIPT',
            'RECEIPT',
            'CREDIT_NOTE',
            'PROFORMA',
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="">Todas as origens</option>
          {['ORDER', 'GIFT_CARD_PURCHASE', 'CLUB_CHARGE', 'MANUAL'].map(
            (value) => <option key={value}>{value}</option>,
          )}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Tipo</th>
              <th>Origem</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((document) => (
              <tr key={document.id}>
                <td>
                  {document.number ?? 'Sem número'}
                  <small>
                    {document.issuedAt
                      ? new Date(document.issuedAt).toLocaleString('pt-PT')
                      : new Date(document.createdAt).toLocaleString('pt-PT')}
                  </small>
                </td>
                <td>{document.type}</td>
                <td>
                  {document.sourceType}
                  <small>{document.sourceId ?? ''}</small>
                </td>
                <td>
                  {text(document.customerSnapshot.name) || 'Cliente'}
                  <small>{text(document.customerSnapshot.email)}</small>
                </td>
                <td>{money(document.totalCents, document.currency)}</td>
                <td>{document.status}</td>
                <td>
                  <Link href={`/documentos/${document.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="admin-state">
            Sem documentos para os filtros selecionados.
          </p>
        )}
      </div>
    </>
  );
}

export function FiscalDocumentDetail({ id }: { id: string }) {
  const [document, setDocument] = useState<FiscalDocument | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void managementApi
      .get<FiscalDocument>(`/v1/admin/fiscal/documents/${id}`)
      .then((response) => {
        if (!cancelled) setDocument(response);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar o documento.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="admin-error">{error}</p>;
  if (!document) return <div className="admin-state">A carregar…</div>;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Documento comercial</p>
          <h1>{document.number ?? 'Documento sem número'}</h1>
          <p>
            {document.type} · {document.status} · provider {document.provider}
          </p>
        </div>
      </header>

      <section className="admin-card">
        <h2>Resumo</h2>
        <p>
          Origem: {document.sourceType} · {document.sourceId ?? 'manual'}
        </p>
        <p>
          Série: {document.series?.code ?? '—'} ·{' '}
          {document.series?.year ?? '—'}
        </p>
        <p>
          Emitido em:{' '}
          {document.issuedAt
            ? new Date(document.issuedAt).toLocaleString('pt-PT')
            : 'Não emitido'}
        </p>
        <p>
          Subtotal {money(document.subtotalCents, document.currency)} · descontos{' '}
          {money(document.discountCents, document.currency)} · imposto{' '}
          {money(document.taxCents, document.currency)}
        </p>
        <p>
          <strong>
            Total: {money(document.totalCents, document.currency)}
          </strong>
        </p>
        <p className="admin-warning">
          Representação interna/manual. Não constitui documento certificado por
          software homologado.
        </p>
      </section>

      <section className="admin-card">
        <h2>Cliente</h2>
        <p>{text(document.customerSnapshot.name)}</p>
        <p>
          {text(document.customerSnapshot.email)} ·{' '}
          {text(document.customerSnapshot.phone)}
        </p>
        <pre>{JSON.stringify(document.billingSnapshot, null, 2)}</pre>
      </section>

      <section className="admin-card">
        <h2>Linhas</h2>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Descrição</th>
                <th>Qtd.</th>
                <th>Unitário</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(document.lines ?? []).map((line) => (
                <tr key={line.id}>
                  <td>{line.position}</td>
                  <td>
                    {line.description}
                    <small>{line.sku ?? ''}</small>
                  </td>
                  <td>{line.quantity}</td>
                  <td>{money(line.unitPriceCents, document.currency)}</td>
                  <td>{money(line.totalCents, document.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Auditoria</h2>
        {(document.events ?? []).map((event) => (
          <p key={event.id}>
            {new Date(event.createdAt).toLocaleString('pt-PT')} —{' '}
            <strong>{event.type}</strong>
            {event.note ? ` · ${event.note}` : ''}
          </p>
        ))}
      </section>

      <p>
        <Link href="/documentos">Voltar aos documentos</Link>
      </p>
    </>
  );
}
