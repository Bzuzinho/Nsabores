'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type ShipmentDetail = {
  id: string;
  number: string;
  orderId: string;
  provider: string;
  service: string;
  status: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  shippedAt?: string | null;
  estimatedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  items: Array<{ id: string; productName: string; sku: string; quantity: number }>;
  events: Array<{ id: string; code: string; description: string; location?: string | null; occurredAt: string }>;
};

type ReturnItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  reason: string;
  declaredCondition?: string | null;
  receivedCondition?: string | null;
  disposition?: string | null;
  eligibleRefundCents: number;
  unitPriceCents: number;
};

type ReturnDetail = {
  id: string;
  number: string;
  orderId: string;
  status: string;
  resolution: string;
  reason: string;
  customerNotes?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  items: ReturnItem[];
  events: Array<{ id: string; fromStatus?: string | null; toStatus: string; note?: string | null; createdAt: string }>;
};

type SupportDetail = {
  id: string;
  number: string;
  orderId?: string | null;
  shipmentId?: string | null;
  type: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  resolution?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  comments: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    firstName?: string | null;
    lastName?: string | null;
    createdAt: string;
  }>;
};

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

export function ShipmentAdminDetail({ id }: { id: string }) {
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setShipment(await managementApi.get(`/v1/admin/shipments/${id}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a expedição.');
    }
  }, [id]);

  useEffect(() => void reload(), [reload]);

  async function action(path: string) {
    if (!window.confirm('Confirma esta ação?')) return;
    setError('');
    try {
      await managementApi.post(path);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A operação falhou.');
    }
  }

  if (!shipment) return <div className="admin-state">{error || 'A carregar…'}</div>;

  return (
    <>
      <header className="admin-header">
        <div><p><Link href="/expedicoes">← Expedições</Link></p><h1>{shipment.number}</h1><p>{shipment.provider} · {shipment.service} · {shipment.status}</p></div>
        <div>
          {!shipment.trackingNumber && <button className="admin-primary" onClick={() => void action(`/v1/admin/shipments/${id}/label`)}>Criar etiqueta</button>}
          {['READY', 'LABEL_CREATED'].includes(shipment.status) && <button className="admin-primary" onClick={() => void action(`/v1/admin/shipments/${id}/dispatch`)}>Confirmar expedição</button>}
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <section className="user-detail">
        <h2>Tracking</h2>
        <p>Número: {shipment.trackingNumber ?? 'Ainda não atribuído'}</p>
        {shipment.trackingUrl && <p><a href={shipment.trackingUrl} target="_blank" rel="noreferrer">Abrir tracking da transportadora</a></p>}
        {shipment.labelUrl && <p><a href={shipment.labelUrl} target="_blank" rel="noreferrer">Abrir etiqueta</a></p>}
        <p>Expedida: {shipment.shippedAt ? new Date(shipment.shippedAt).toLocaleString('pt-PT') : '—'}</p>
        <p>Entrega prevista: {shipment.estimatedDeliveryAt ? new Date(shipment.estimatedDeliveryAt).toLocaleString('pt-PT') : '—'}</p>
        <p>Entregue: {shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleString('pt-PT') : '—'}</p>
        <h2>Artigos</h2>
        {shipment.items.map((item) => <p key={item.id}>{item.quantity} × {item.productName} ({item.sku})</p>)}
        <h2>Eventos</h2>
        {!shipment.events.length && <p>Sem eventos de tracking.</p>}
        {shipment.events.map((event) => <p key={event.id}>{new Date(event.occurredAt).toLocaleString('pt-PT')} — {event.code}: {event.description}{event.location ? ` · ${event.location}` : ''}</p>)}
      </section>
    </>
  );
}

export function ReturnAdminDetail({ id }: { id: string }) {
  const [request, setRequest] = useState<ReturnDetail | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [decisions, setDecisions] = useState<Record<string, { disposition: string; receivedCondition: string; eligibleRefundCents: number }>>({});

  const reload = useCallback(async () => {
    try {
      const result = await managementApi.get<ReturnDetail>(`/v1/admin/returns/${id}`);
      setRequest(result);
      setNotes(result.internalNotes ?? '');
      setDecisions(Object.fromEntries(result.items.map((item) => [item.id, {
        disposition: item.disposition ?? 'RESTOCK',
        receivedCondition: item.receivedCondition ?? '',
        eligibleRefundCents: item.eligibleRefundCents || item.unitPriceCents * item.quantity,
      }])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a devolução.');
    }
  }, [id]);

  useEffect(() => void reload(), [reload]);

  const refundTotal = useMemo(() => Object.values(decisions).reduce((sum, item) => sum + item.eligibleRefundCents, 0), [decisions]);

  async function decide(approved: boolean) {
    if (!window.confirm(approved ? 'Aprovar esta devolução?' : 'Rejeitar esta devolução?')) return;
    setError('');
    try {
      await managementApi.post(`/v1/admin/returns/${id}/decision`, {
        approved,
        internalNotes: notes || undefined,
        items: approved ? Object.entries(decisions).map(([returnItemId, item]) => ({ returnItemId, ...item })) : undefined,
      });
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A decisão falhou.');
    }
  }

  async function setStatus(status: string) {
    if (!window.confirm(`Alterar a devolução para ${status}?`)) return;
    try {
      await managementApi.patch(`/v1/admin/returns/${id}/status`, { status, note: notes || undefined });
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A alteração falhou.');
    }
  }

  if (!request) return <div className="admin-state">{error || 'A carregar…'}</div>;
  const canDecide = ['REQUESTED', 'UNDER_REVIEW'].includes(request.status);

  return (
    <>
      <header className="admin-header"><div><p><Link href="/devolucoes">← Devoluções</Link></p><h1>{request.number}</h1><p>{request.status} · {request.resolution}</p></div></header>
      {error && <p className="admin-error">{error}</p>}
      <section className="user-detail">
        <p><strong>Motivo:</strong> {request.reason}</p>
        {request.customerNotes && <p><strong>Notas do cliente:</strong> {request.customerNotes}</p>}
        <h2>Artigos</h2>
        {request.items.map((item) => {
          const decision = decisions[item.id];
          return <div key={item.id}>
            <p><strong>{item.quantity} × {item.productName}</strong> ({item.sku}) — comprado a {money(item.unitPriceCents)} / un.</p>
            <p>Motivo: {item.reason}{item.declaredCondition ? ` · Condição declarada: ${item.declaredCondition}` : ''}</p>
            {canDecide && decision && <>
              <label>Destino do artigo<select value={decision.disposition} onChange={(event) => setDecisions((current) => ({ ...current, [item.id]: { ...decision, disposition: event.target.value } }))}>{['RESTOCK', 'UNSELLABLE', 'RETURN_TO_SUPPLIER', 'DESTROY'].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Condição recebida<input value={decision.receivedCondition} onChange={(event) => setDecisions((current) => ({ ...current, [item.id]: { ...decision, receivedCondition: event.target.value } }))} /></label>
              <label>Elegível para reembolso (€)<input type="number" min="0" step="0.01" value={(decision.eligibleRefundCents / 100).toFixed(2)} onChange={(event) => setDecisions((current) => ({ ...current, [item.id]: { ...decision, eligibleRefundCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) } }))} /></label>
            </>}
          </div>;
        })}
        <p><strong>Total elegível: {money(refundTotal)}</strong></p>
        <label>Notas internas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {canDecide && <div><button className="admin-primary" onClick={() => void decide(true)}>Aprovar</button><button onClick={() => void decide(false)}>Rejeitar</button></div>}
        {!canDecide && <label>Novo estado<select defaultValue="" onChange={(event) => event.target.value && void setStatus(event.target.value)}><option value="">Selecionar…</option>{['IN_TRANSIT', 'RECEIVED', 'INSPECTED', 'REFUND_PENDING', 'REFUNDED', 'CLOSED', 'CANCELLED'].map((value) => <option key={value}>{value}</option>)}</select></label>}
        <h2>Histórico</h2>
        {request.events.map((event) => <p key={event.id}>{new Date(event.createdAt).toLocaleString('pt-PT')} — {event.fromStatus ? `${event.fromStatus} → ` : ''}{event.toStatus}{event.note ? ` · ${event.note}` : ''}</p>)}
      </section>
    </>
  );
}

export function SupportAdminDetail({ id }: { id: string }) {
  const [support, setSupport] = useState<SupportDetail | null>(null);
  const [comment, setComment] = useState('');
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const result = await managementApi.get<SupportDetail>(`/v1/admin/support-cases/${id}`);
      setSupport(result);
      setResolution(result.resolution ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o caso.');
    }
  }, [id]);

  useEffect(() => void reload(), [reload]);

  async function update(status: string) {
    if (!window.confirm(`Alterar o caso para ${status}?`)) return;
    try {
      await managementApi.patch(`/v1/admin/support-cases/${id}`, { status, resolution: resolution || undefined });
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A atualização falhou.');
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    try {
      await managementApi.post(`/v1/admin/support-cases/${id}/comments`, { body: comment.trim(), isInternal: true });
      setComment('');
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o comentário.');
    }
  }

  if (!support) return <div className="admin-state">{error || 'A carregar…'}</div>;

  return (
    <>
      <header className="admin-header"><div><p><Link href="/apoio">← Pós-venda</Link></p><h1>{support.number}</h1><p>{support.priority} · {support.status}</p></div></header>
      {error && <p className="admin-error">{error}</p>}
      <section className="user-detail">
        <h2>{support.subject}</h2><p>{support.description}</p>
        <p>Tipo: {support.type}</p>
        {support.orderId && <p>Encomenda: <Link href={`/encomendas/${support.orderId}`}>{support.orderId}</Link></p>}
        {support.shipmentId && <p>Expedição: <Link href={`/expedicoes/${support.shipmentId}`}>{support.shipmentId}</Link></p>}
        <label>Resolução<textarea value={resolution} onChange={(event) => setResolution(event.target.value)} /></label>
        <label>Estado<select value={support.status} onChange={(event) => void update(event.target.value)}>{['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_CARRIER', 'RESOLVED', 'CLOSED'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <h2>Comentários</h2>
        {!support.comments.length && <p>Sem comentários.</p>}
        {support.comments.map((item) => <p key={item.id}>{new Date(item.createdAt).toLocaleString('pt-PT')} — {item.firstName ? `${item.firstName} ${item.lastName ?? ''}: ` : ''}{item.body}{item.isInternal ? ' · interno' : ''}</p>)}
        <label>Novo comentário interno<textarea value={comment} onChange={(event) => setComment(event.target.value)} /></label>
        <button className="admin-primary" onClick={() => void addComment()}>Adicionar comentário</button>
      </section>
    </>
  );
}
