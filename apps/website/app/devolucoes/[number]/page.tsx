'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

type ReturnSummary = {
  id: string;
  number: string;
  status: string;
  resolution: string;
  reason: string;
  createdAt: string;
};
type ReturnDetail = ReturnSummary & {
  customerNotes?: string | null;
  internalNotes?: string | null;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    reason: string;
    declaredCondition?: string | null;
    receivedCondition?: string | null;
    disposition?: string | null;
    eligibleRefundCents: number;
  }>;
  events: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    note?: string | null;
    createdAt: string;
  }>;
};

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );

export default function ReturnStatusPage() {
  const { number } = useParams<{ number: string }>();
  const [request, setRequest] = useState<ReturnDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void accountApi
      .get<ReturnSummary[]>('/v1/account/returns')
      .then((rows) => {
        const match = rows.find((row) => row.number === number);
        if (!match) throw new Error('Pedido de devolução não encontrado.');
        return accountApi.get<ReturnDetail>(`/v1/account/returns/${match.id}`);
      })
      .then(setRequest)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível carregar a devolução.',
        ),
      );
  }, [number]);

  if (error)
    return (
      <section className="account-card">
        <h1>Devolução</h1>
        <p role="alert">{error}</p>
      </section>
    );
  if (!request) return <section className="account-card">A carregar…</section>;

  return (
    <section className="account-card">
      <p className="eyebrow">Devolução</p>
      <h1>{request.number}</h1>
      <p>
        {request.status} · {request.resolution}
      </p>
      <p>{request.reason}</p>
      {request.customerNotes && <p>{request.customerNotes}</p>}
      <h2>Artigos</h2>
      {request.items.map((item) => (
        <article key={item.id}>
          <p>
            <strong>
              {item.quantity} × {item.productName}
            </strong>{' '}
            ({item.sku})
          </p>
          <p>
            {item.reason}
            {item.declaredCondition
              ? ` · Condição declarada: ${item.declaredCondition}`
              : ''}
          </p>
          {item.receivedCondition && (
            <p>Condição recebida: {item.receivedCondition}</p>
          )}
          {item.disposition && <p>Decisão: {item.disposition}</p>}
          {item.eligibleRefundCents > 0 && (
            <p>Elegível para reembolso: {money(item.eligibleRefundCents)}</p>
          )}
        </article>
      ))}
      <h2>Histórico</h2>
      {request.events.map((event) => (
        <p key={event.id}>
          {new Date(event.createdAt).toLocaleString('pt-PT')} — {event.toStatus}
          {event.note ? ` · ${event.note}` : ''}
        </p>
      ))}
      <p>
        <Link href="/conta/encomendas">Voltar às encomendas</Link>
      </p>
    </section>
  );
}
