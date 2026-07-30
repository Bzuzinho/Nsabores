'use client';

import type { CommerceOrder, OrderStatus, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );

export function OrdersAdmin() {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  useEffect(() => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    if (payment) query.set('paymentStatus', payment);
    void managementApi
      .get<Paginated<CommerceOrder>>(`/v1/admin/orders?${query}`)
      .then(({ data }) => setOrders(data));
  }, [payment, search, status]);

  function exportCsv() {
    const rows = [
      ['Número', 'Data', 'Cliente', 'Email', 'Estado', 'Pagamento', 'Total'],
      ...orders.map((order) => [
        order.number,
        order.createdAt,
        order.customerName,
        order.email,
        order.status,
        order.paymentStatus,
        String(order.totalCents),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','),
      )
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'encomendas.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Encomendas</h1>
          <p>Produção independente da confirmação manual do pagamento.</p>
        </div>
        <button className="admin-primary" onClick={exportCsv}>Exportar CSV</button>
      </header>
      <div className="admin-filters">
        <input aria-label="Pesquisar" placeholder="Número, cliente ou email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Estado" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os estados</option>
          {(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] satisfies OrderStatus[]).map((value) => <option key={value}>{value}</option>)}
        </select>
        <select aria-label="Pagamento" value={payment} onChange={(event) => setPayment(event.target.value)}>
          <option value="">Todos os pagamentos</option>
          {['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead><tr><th>Número</th><th>Cliente</th><th>Produção</th><th>Pagamento</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.number}<small>{new Date(order.createdAt).toLocaleString('pt-PT')}</small></td>
                <td>{order.customerName}<small>{order.email}</small></td>
                <td>{order.status}</td>
                <td>{order.paymentStatus}</td>
                <td>{money(order.totalCents)}</td>
                <td><Link href={`/encomendas/${order.id}`}>Abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function OrderAdmin({ id }: { id: string }) {
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(
    () => managementApi.get<CommerceOrder>(`/v1/admin/orders/${id}`).then(setOrder),
    [id],
  );
  useEffect(() => { void reload(); }, [reload]);

  if (!order) return <div className="admin-state">A carregar…</div>;

  const act = async (path: string, body?: unknown) => {
    if (!window.confirm('Confirma esta ação?')) return;
    setError('');
    try {
      setOrder(
        body === undefined
          ? await managementApi.post(path)
          : await managementApi.patch(path, body),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operação falhou.');
    }
  };

  const markPaid = async () => {
    const method = window.prompt('Método de pagamento (ex.: transferência, numerário, MB Way):', 'transferência');
    if (method === null) return;
    const reference = window.prompt('Referência/comprovativo (opcional):', '') ?? '';
    const note = window.prompt('Nota interna (opcional):', '') ?? '';
    if (!window.confirm('Confirmar que o pagamento foi recebido?')) return;
    setError('');
    try {
      setOrder(await managementApi.post(`/v1/admin/orders/${id}/mark-paid`, { method, reference, note }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível confirmar o pagamento.');
    }
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>{order.number}</h1>
          <p>{order.customerName} · {order.email} · {order.phone}</p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <section className="user-detail">
        <p>Produção: <strong>{order.status}</strong> · Pagamento: <strong>{order.paymentStatus}</strong></p>
        {order.paymentStatus === 'PENDING' && (
          <p>
            <button className="admin-primary" onClick={() => void markPaid()}>
              Marcar pagamento como recebido
            </button>
          </p>
        )}
        {order.items.map((item) => (
          <p key={item.id}>{item.quantity} × {item.productName} ({item.sku}) — {money(item.totalCents)}</p>
        ))}
        <p>Entrega: {order.deliveryMethod.name}<br />Morada: {JSON.stringify(order.shippingAddress)}</p>
        <p><strong>Total a receber: {money(order.totalCents)}</strong></p>
        <label>
          Novo estado de produção
          <select
            defaultValue=""
            onChange={(event) => event.target.value && void act(`/v1/admin/orders/${id}/status`, { status: event.target.value })}
          >
            <option value="">Selecionar…</option>
            {['PROCESSING', 'READY', 'SHIPPED', 'DELIVERED'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          Nota interna
          <textarea
            defaultValue={order.internalNotes ?? ''}
            onBlur={(event) => void managementApi.patch(`/v1/admin/orders/${id}/notes`, { note: event.target.value })}
          />
        </label>
        <button onClick={() => void act(`/v1/admin/orders/${id}/cancel`)}>Cancelar encomenda</button>
        {order.paymentStatus === 'PAID' && (
          <button onClick={() => void act(`/v1/admin/orders/${id}/refund`)}>Registar reembolso</button>
        )}
        <h2>Histórico de produção</h2>
        {order.statusHistory.map((item) => (
          <p key={item.id}>{new Date(item.createdAt).toLocaleString('pt-PT')} — {item.toStatus} {item.note}</p>
        ))}
      </section>
    </>
  );
}
