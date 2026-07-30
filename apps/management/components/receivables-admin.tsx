'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );

type Agreement = {
  id: string;
  orderId: string;
  number: string;
  customerName: string;
  email: string;
  phone: string;
  status: string;
  method: string | null;
  expectedAmountCents: number;
  dueAt: string | null;
  paymentStatus: string;
  orderStatus: string;
  publicReference?: string | null;
  internalReference?: string | null;
  internalNotes?: string | null;
  events?: Array<{
    id: string;
    type: string;
    channel: string | null;
    note: string;
    createdAt: string;
    firstName?: string | null;
    lastName?: string | null;
  }>;
};

type Result = {
  data: Agreement[];
  metrics: {
    outstandingCents: number;
    overdueCents: number;
    toAgreeCount: number;
    overdueCount: number;
  };
};

export function ReceivablesAdmin() {
  const [result, setResult] = useState<Result | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    void managementApi.get<Result>(`/v1/admin/receivables?${query}`).then(setResult);
  }, [search, status]);

  const exportCsv = () => {
    if (!result) return;
    const rows = [
      ['Encomenda', 'Cliente', 'Estado', 'Método', 'Prazo', 'Valor'],
      ...result.data.map((item) => [
        item.number,
        item.customerName,
        item.status,
        item.method ?? '',
        item.dueAt ?? '',
        String(item.expectedAmountCents),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'recebimentos.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Recebimentos</h1>
          <p>Acordos, prazos, contactos e pagamentos manuais.</p>
        </div>
        <button className="admin-primary" onClick={exportCsv}>Exportar CSV</button>
      </header>
      {result && (
        <div className="admin-metrics">
          <article><strong>{money(result.metrics.outstandingCents)}</strong><span>Por receber</span></article>
          <article><strong>{money(result.metrics.overdueCents)}</strong><span>Vencido</span></article>
          <article><strong>{result.metrics.toAgreeCount}</strong><span>Sem acordo</span></article>
          <article><strong>{result.metrics.overdueCount}</strong><span>Em atraso</span></article>
        </div>
      )}
      <div className="admin-filters">
        <input placeholder="Encomenda, cliente ou email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os estados</option>
          {['TO_AGREE','AGREED','AWAITING_PAYMENT','PAID','OVERDUE','CANCELLED'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead><tr><th>Encomenda</th><th>Cliente</th><th>Acordo</th><th>Prazo</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {(result?.data ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.number}<small>{item.orderStatus} · {item.paymentStatus}</small></td>
                <td>{item.customerName}<small>{item.email}</small></td>
                <td>{item.status}<small>{item.method ?? 'Método por definir'}</small></td>
                <td>{item.dueAt ? new Date(item.dueAt).toLocaleDateString('pt-PT') : 'Por definir'}</td>
                <td>{money(item.expectedAmountCents)}</td>
                <td><Link href={`/recebimentos/${item.orderId}`}>Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ReceivableDetail({ orderId }: { orderId: string }) {
  const [item, setItem] = useState<Agreement | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => managementApi.get<Agreement>(`/v1/admin/receivables/${orderId}`).then(setItem), [orderId]);
  useEffect(() => { void reload(); }, [reload]);

  async function saveAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    try {
      await managementApi.patch(`/v1/admin/receivables/${orderId}`, {
        status: String(data.get('status')),
        method: String(data.get('method') ?? '') || undefined,
        dueAt: String(data.get('dueAt') ?? '') || undefined,
        publicReference: String(data.get('publicReference') ?? '') || undefined,
        internalReference: String(data.get('internalReference') ?? '') || undefined,
        internalNotes: String(data.get('internalNotes') ?? '') || undefined,
      });
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível guardar.');
    }
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    try {
      await managementApi.post(`/v1/admin/receivables/${orderId}/events`, {
        type: String(data.get('type')),
        channel: String(data.get('channel')),
        note: String(data.get('note')),
        nextContactAt: String(data.get('nextContactAt') ?? '') || undefined,
        promisedPaymentAt: String(data.get('promisedPaymentAt') ?? '') || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      event.currentTarget.reset();
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registar o contacto.');
    }
  }

  if (!item) return <div className="admin-state">A carregar…</div>;
  return (
    <>
      <header className="admin-header"><div><h1>{item.number}</h1><p>{item.customerName} · {item.email} · {item.phone}</p></div></header>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-grid">
        <form className="admin-card" onSubmit={saveAgreement}>
          <h2>Acordo de pagamento</h2>
          <label>Estado<select name="status" defaultValue={item.status}>{['TO_AGREE','AGREED','AWAITING_PAYMENT','PAID','OVERDUE','CANCELLED'].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Método<input name="method" defaultValue={item.method ?? ''} /></label>
          <label>Prazo<input name="dueAt" type="datetime-local" defaultValue={item.dueAt?.slice(0,16) ?? ''} /></label>
          <label>Referência para o cliente<input name="publicReference" defaultValue={item.publicReference ?? ''} /></label>
          <label>Referência interna<input name="internalReference" defaultValue={item.internalReference ?? ''} /></label>
          <label>Notas internas<textarea name="internalNotes" defaultValue={item.internalNotes ?? ''} /></label>
          <button className="admin-primary">Guardar acordo</button>
        </form>
        <form className="admin-card" onSubmit={addContact}>
          <h2>Registar contacto</h2>
          <label>Tipo<select name="type">{['CONTACT_ATTEMPT','CONTACT_COMPLETED','INSTRUCTIONS_SENT','PAYMENT_PROMISE','PROOF_RECEIVED'].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Canal<select name="channel">{['PHONE','EMAIL','WHATSAPP','IN_PERSON','OTHER'].map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Nota<textarea name="note" required /></label>
          <label>Próximo contacto<input name="nextContactAt" type="datetime-local" /></label>
          <label>Promessa de pagamento<input name="promisedPaymentAt" type="datetime-local" /></label>
          <button>Registar</button>
        </form>
      </div>
      <section className="admin-card">
        <h2>Histórico</h2>
        {(item.events ?? []).map((event) => (
          <p key={event.id}><strong>{event.type}</strong> · {new Date(event.createdAt).toLocaleString('pt-PT')}<br />{event.note}</p>
        ))}
      </section>
    </>
  );
}
