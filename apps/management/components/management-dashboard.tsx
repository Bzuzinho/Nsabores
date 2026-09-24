'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type SalesSummary = {
  salesChannel: string;
  _sum: { totalCents: number | null };
  _count: number;
};

type DashboardData = {
  outOfStock: number;
  belowReorderPoint: number;
  reservedQuantity: number;
  estimatedStockValueCents: number;
  pendingPurchases: number;
  pendingApplications: number;
  activeResellers: number;
  sales: SalesSummary[];
};

const money = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

export function ManagementDashboard() {
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await managementApi.get<DashboardData>(
          '/v1/admin/operations/dashboard',
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o painel.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const salesTotal =
    data?.sales.reduce((sum, item) => sum + (item._sum.totalCents ?? 0), 0) ??
    0;
  const orderTotal =
    data?.sales.reduce((sum, item) => sum + Number(item._count), 0) ?? 0;
  const attention = [
    {
      label: 'Candidaturas B2B',
      value: data?.pendingApplications ?? 0,
      href: '/revendedores/candidaturas',
      tone: data?.pendingApplications ? 'info' : 'ok',
    },
  ];

  return (
    <div className="management-dashboard">
      <header className="dashboard-welcome">
        <div>
          <p className="eyebrow">Resumo operacional</p>
          <h1>Bom trabalho começa com prioridades claras.</h1>
          <p>
            Vendas, recebimentos e tarefas pendentes num único ponto de entrada.
          </p>
        </div>
        <div className="dashboard-actions">
          <Link className="admin-secondary" href="/catalogo/produtos/novo">
            Novo produto
          </Link>
          <Link className="admin-primary" href="/encomendas/nova">
            Nova encomenda
          </Link>
        </div>
      </header>

      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      )}

      <section className="dashboard-metrics" aria-busy={loading}>
        <article className="dashboard-metric dashboard-metric-featured">
          <span>Vendas registadas</span>
          <strong>{loading ? '—' : formatMoney(salesTotal)}</strong>
          <small>{orderTotal} encomendas no total</small>
        </article>
        <article className="dashboard-metric">
          <span>Revendedores ativos</span>
          <strong>{loading ? '—' : (data?.activeResellers ?? 0)}</strong>
          <small>contas comerciais aprovadas</small>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <header>
            <div>
              <p className="eyebrow">Acompanhamento</p>
              <h2>Precisa da sua atenção</h2>
            </div>
            <Link href="/operacoes">Ver operações</Link>
          </header>
          <div className="attention-list">
            {attention.map((item) => (
              <Link href={item.href} key={item.label}>
                <span className={`attention-dot ${item.tone}`} />
                <span>
                  <strong>{item.label}</strong>
                  <small>
                    {item.value === 0
                      ? 'Sem pendências neste momento'
                      : `${item.value} ${item.value === 1 ? 'registo' : 'registos'}`}
                  </small>
                </span>
                <b>{loading ? '—' : item.value}</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="dashboard-panel dashboard-quick-actions">
          <header>
            <div>
              <p className="eyebrow">Atalhos</p>
              <h2>Trabalho frequente</h2>
            </div>
          </header>
          <Link href="/encomendas">
            <strong>Gerir encomendas</strong>
            <small>Consultar, criar e acompanhar</small>
          </Link>
          <Link href="/recebimentos">
            <strong>Registar recebimento</strong>
            <small>Associar pagamentos manuais</small>
          </Link>
          <Link href="/recebimentos/reconciliacao">
            <strong>Reconciliar pagamentos</strong>
            <small>Associar recebimentos às encomendas</small>
          </Link>
        </section>
      </div>
    </div>
  );
}
