'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Row = {
  id: string;
  orderId: string;
  number: string;
  customerName: string;
  email: string;
  orderStatus: string;
  status: string;
  priority: string;
  paymentStatus: string;
  targetDate: string | null;
  itemCount: number;
  unitCount: number;
  createdAt: string;
};

type Detail = Row & {
  phone: string;
  customerNotes: string | null;
  productionNotes: string | null;
  responsibleUserId: string | null;
  shippingAddress: Record<string, unknown>;
  items: Array<{
    id: string;
    quantity: number;
    productName: string;
    sku: string;
    personalization: string | null;
  }>;
};

function formatPersonalization(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function ProductionAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    void managementApi.get<Row[]>('/v1/admin/production').then(setRows);
  }, []);

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Produção</h1>
          <p>Fila operacional independente do estado financeiro.</p>
        </div>
      </header>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Encomenda</th>
              <th>Cliente</th>
              <th>Prioridade</th>
              <th>Produção</th>
              <th>Pagamento</th>
              <th>Itens</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.orderId}>
                <td>
                  {row.number}
                  <small>
                    {new Date(row.createdAt).toLocaleString('pt-PT')}
                  </small>
                </td>
                <td>
                  {row.customerName}
                  <small>{row.email}</small>
                </td>
                <td>
                  {row.priority}
                  <small>
                    {row.targetDate
                      ? new Date(row.targetDate).toLocaleDateString('pt-PT')
                      : 'Sem data definida'}
                  </small>
                </td>
                <td>
                  {row.status}
                  <small>{row.orderStatus}</small>
                </td>
                <td>{row.paymentStatus}</td>
                <td>
                  {row.itemCount} linhas · {row.unitCount} unidades
                </td>
                <td>
                  <Link href={`/operacoes/producao/${row.orderId}`}>
                    Preparar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ProductionDetail({ orderId }: { orderId: string }) {
  const [work, setWork] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void managementApi
      .get<Detail>(`/v1/admin/production/${orderId}`)
      .then((result) => {
        if (!cancelled) setWork(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar a produção.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function save(payload: Record<string, unknown>) {
    setError('');
    try {
      setWork(
        await managementApi.patch(`/v1/admin/production/${orderId}`, payload),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar a produção.',
      );
    }
  }

  async function complete() {
    if (!window.confirm('Confirmar que a preparação está concluída?')) return;
    setWork(
      await managementApi.post(`/v1/admin/production/${orderId}/complete`, {}),
    );
  }

  if (!work) return <div className="admin-state">A carregar…</div>;
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Produção</p>
          <h1>{work.number}</h1>
          <p>
            {work.customerName} · {work.email} · {work.phone}
          </p>
        </div>
        <Link href="/operacoes/producao">Voltar à fila</Link>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <section className="user-detail">
        <p>
          Produção: <strong>{work.status}</strong> · Encomenda:{' '}
          <strong>{work.orderStatus}</strong> · Pagamento:{' '}
          <strong>{work.paymentStatus}</strong>
        </p>
        <label>
          Prioridade
          <select
            value={work.priority}
            onChange={(event) => void save({ priority: event.target.value })}
          >
            {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Estado operacional
          <select
            value={work.status}
            onChange={(event) => void save({ status: event.target.value })}
          >
            {['QUEUED', 'IN_PROGRESS', 'READY'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Data pretendida
          <input
            type="date"
            defaultValue={work.targetDate?.slice(0, 10) ?? ''}
            onBlur={(event) =>
              event.target.value &&
              void save({ targetDate: event.target.value })
            }
          />
        </label>
        <label>
          Notas de produção
          <textarea
            defaultValue={work.productionNotes ?? ''}
            onBlur={(event) =>
              void save({ productionNotes: event.target.value })
            }
          />
        </label>
        {work.customerNotes && (
          <p>
            <strong>Observações do cliente:</strong> {work.customerNotes}
          </p>
        )}
        <p>
          <strong>Morada:</strong> {JSON.stringify(work.shippingAddress)}
        </p>
        <h2>Itens a preparar</h2>
        {work.items.map((item) => {
          const personalization = formatPersonalization(item.personalization);
          return (
            <div key={item.id} className="account-card">
              <strong>
                {item.quantity} × {item.productName}
              </strong>
              <small>{item.sku}</small>
              {personalization ? <pre>{personalization}</pre> : null}
            </div>
          );
        })}
        <button className="admin-primary" onClick={() => void complete()}>
          Preparação concluída
        </button>
      </section>
    </>
  );
}
