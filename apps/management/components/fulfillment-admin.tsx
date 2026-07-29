'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Mode = 'preparation' | 'shipments' | 'returns' | 'support';

type PreparationOrder = {
  id: string;
  number: string;
  customerName: string;
  status: string;
  createdAt: string;
  items: Array<{ id: string; productName: string; sku: string; quantity: number }>;
};

type Shipment = {
  id: string;
  number: string;
  orderId: string;
  provider: string;
  service: string;
  status: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  createdAt: string;
};

type ReturnRequest = {
  id: string;
  number: string;
  orderId: string;
  status: string;
  resolution: string;
  reason: string;
  createdAt: string;
};

type SupportCase = {
  id: string;
  number: string;
  orderId?: string | null;
  type: string;
  priority: string;
  status: string;
  subject: string;
  createdAt: string;
};

const titles: Record<Mode, { title: string; subtitle: string }> = {
  preparation: {
    title: 'Preparação',
    subtitle: 'Encomendas pagas e prontas para picking e expedição.',
  },
  shipments: {
    title: 'Expedições',
    subtitle: 'Etiquetas, tracking e estado das entregas.',
  },
  returns: {
    title: 'Devoluções',
    subtitle: 'Pedidos, decisão, receção, inspeção e reembolso.',
  },
  support: {
    title: 'Pós-venda',
    subtitle: 'Casos de apoio ligados a encomendas e expedições.',
  },
};

export function FulfillmentAdmin({ mode }: { mode: Mode }) {
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path =
        mode === 'preparation'
          ? '/v1/admin/operations/preparation'
          : mode === 'shipments'
            ? '/v1/admin/shipments'
            : mode === 'returns'
              ? '/v1/admin/returns'
              : '/v1/admin/support-cases';
      setData(await managementApi.get<unknown[]>(path));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const { title, subtitle } = titles[mode];

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="admin-primary" onClick={() => void reload()}>
          Atualizar
        </button>
      </header>
      {loading && <div className="admin-state">A carregar…</div>}
      {error && <p className="admin-error">{error}</p>}
      {!loading && !error && mode === 'preparation' && (
        <PreparationTable rows={data as PreparationOrder[]} />
      )}
      {!loading && !error && mode === 'shipments' && (
        <ShipmentsTable rows={data as Shipment[]} onChange={reload} />
      )}
      {!loading && !error && mode === 'returns' && (
        <ReturnsTable rows={data as ReturnRequest[]} />
      )}
      {!loading && !error && mode === 'support' && (
        <SupportTable rows={data as SupportCase[]} />
      )}
    </>
  );
}

function Empty() {
  return <div className="admin-state">Sem registos neste momento.</div>;
}

function PreparationTable({ rows }: { rows: PreparationOrder[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr><th>Encomenda</th><th>Cliente</th><th>Estado</th><th>Artigos</th><th>Data</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.number}</td>
              <td>{row.customerName}</td>
              <td>{row.status}</td>
              <td>{row.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</td>
              <td>{new Date(row.createdAt).toLocaleString('pt-PT')}</td>
              <td><Link href={`/encomendas/${row.id}`}>Abrir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShipmentsTable({ rows, onChange }: { rows: Shipment[]; onChange: () => Promise<void> }) {
  if (!rows.length) return <Empty />;
  const action = async (path: string) => {
    await managementApi.post(path);
    await onChange();
  };
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr><th>Expedição</th><th>Transportadora</th><th>Estado</th><th>Tracking</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link href={`/expedicoes/${row.id}`}>{row.number}</Link><small>{new Date(row.createdAt).toLocaleString('pt-PT')}</small></td>
              <td>{row.provider} · {row.service}</td>
              <td>{row.status}</td>
              <td>{row.trackingUrl ? <a href={row.trackingUrl} target="_blank" rel="noreferrer">{row.trackingNumber ?? 'Abrir tracking'}</a> : row.trackingNumber ?? '—'}</td>
              <td>
                {!row.trackingNumber && <button onClick={() => void action(`/v1/admin/shipments/${row.id}/label`)}>Criar etiqueta</button>}
                {['READY', 'LABEL_CREATED'].includes(row.status) && <button onClick={() => void action(`/v1/admin/shipments/${row.id}/dispatch`)}>Expedir</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReturnsTable({ rows }: { rows: ReturnRequest[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr><th>RMA</th><th>Motivo</th><th>Resolução</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link href={`/devolucoes/${row.id}`}>{row.number}</Link><small>{new Date(row.createdAt).toLocaleString('pt-PT')}</small></td>
              <td>{row.reason}</td>
              <td>{row.resolution}</td>
              <td>{row.status}</td>
              <td><Link href={`/devolucoes/${row.id}`}>Gerir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupportTable({ rows }: { rows: SupportCase[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr><th>Caso</th><th>Assunto</th><th>Tipo</th><th>Prioridade</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link href={`/apoio/${row.id}`}>{row.number}</Link><small>{new Date(row.createdAt).toLocaleString('pt-PT')}</small></td>
              <td>{row.subject}</td>
              <td>{row.type}</td>
              <td>{row.priority}</td>
              <td>{row.status}</td>
              <td><Link href={`/apoio/${row.id}`}>Abrir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
