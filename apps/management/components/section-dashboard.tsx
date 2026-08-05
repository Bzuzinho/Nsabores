'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type Section =
  'sales' | 'operations' | 'purchasing' | 'customers' | 'administration';

type Group = {
  status?: string;
  role?: string;
  salesChannel?: string;
  _count: number;
  _sum?: { totalCents: number | null };
};

type DashboardData = {
  outOfStock: number;
  belowReorderPoint: number;
  reservedQuantity: number;
  estimatedStockValueCents: number;
  pendingPurchases: number;
  pendingApplications: number;
  activeResellers: number;
  sales: Group[];
  ordersByStatus: Group[];
  purchasesByStatus: Group[];
  supportByStatus: Group[];
  usersByRole: Group[];
  blogByStatus: Group[];
  catalog: {
    products: number;
    activeProducts: number;
    featuredProducts: number;
    categories: number;
  };
};

const money = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

const sectionCopy = {
  sales: {
    eyebrow: 'Vendas',
    title: 'Desempenho comercial',
    description: 'Canais, valor vendido e encomendas que exigem atenção.',
    action: ['/encomendas', 'Ver encomendas'],
  },
  operations: {
    eyebrow: 'Operações',
    title: 'Fluxo operacional',
    description: 'Trabalho em curso, reservas e incidências abertas.',
    action: ['/operacoes/preparacao', 'Abrir preparação'],
  },
  purchasing: {
    eyebrow: 'Compras e stock',
    title: 'Abastecimento e disponibilidade',
    description:
      'Compras pendentes, valor de stock e necessidade de reposição.',
    action: ['/compras/nova', 'Nova compra'],
  },
  customers: {
    eyebrow: 'Clientes',
    title: 'Relações e canais de cliente',
    description: 'Clientes particulares, revendedores e candidaturas B2B.',
    action: ['/revendedores/candidaturas', 'Ver candidaturas'],
  },
  administration: {
    eyebrow: 'Administração',
    title: 'Controlo da plataforma',
    description: 'Utilizadores, conteúdos e elementos estruturais do sistema.',
    action: ['/utilizadores', 'Gerir utilizadores'],
  },
} as const;

export function SectionDashboard({ section }: { section: Section }) {
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void managementApi
      .get<DashboardData>('/v1/admin/operations/dashboard')
      .then((value) => active && setData(value))
      .catch(
        (reason: unknown) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar o dashboard.',
          ),
      );
    return () => {
      active = false;
    };
  }, []);

  const view = useMemo(() => buildView(section, data), [data, section]);
  const copy = sectionCopy[section];
  return (
    <section className="section-dashboard">
      <header className="dashboard-welcome section-dashboard-head">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <Link className="admin-primary" href={copy.action[0]}>
          {copy.action[1]}
        </Link>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {!data ? (
        <div className="admin-state" aria-busy="true">
          A carregar indicadores…
        </div>
      ) : (
        <>
          <div className="section-dashboard-metrics">
            {view.metrics.map(([label, value, note]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>
          <div className="section-dashboard-layout">
            <section className="section-chart">
              <header>
                <div>
                  <p className="eyebrow">Distribuição</p>
                  <h2>{view.chartTitle}</h2>
                </div>
              </header>
              <div className="section-chart-bars">
                {view.bars.length ? (
                  view.bars.map((bar) => (
                    <article key={bar.label}>
                      <div>
                        <span>{bar.label}</span>
                        <strong>{bar.formatted}</strong>
                      </div>
                      <i>
                        <b style={{ width: `${bar.width}%` }} />
                      </i>
                    </article>
                  ))
                ) : (
                  <p>Ainda não existem dados suficientes para este gráfico.</p>
                )}
              </div>
            </section>
            <aside className="section-dashboard-links">
              <p className="eyebrow">Acesso rápido</p>
              <h2>Continuar o trabalho</h2>
              {view.links.map(([href, label, note]) => (
                <Link href={href} key={href}>
                  <span>
                    <strong>{label}</strong>
                    <small>{note}</small>
                  </span>
                  <b>→</b>
                </Link>
              ))}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function buildView(section: Section, data?: DashboardData) {
  if (!data)
    return { metrics: [], bars: [], chartTitle: '', links: [] } as View;
  const userCount = (role: string) =>
    data.usersByRole.find((item) => item.role === role)?._count ?? 0;
  const views: Record<
    Section,
    Omit<View, 'bars'> & { source: Group[]; moneyBars?: boolean }
  > = {
    sales: {
      metrics: [
        [
          'Vendas registadas',
          formatMoney(
            data.sales.reduce(
              (sum, item) => sum + (item._sum?.totalCents ?? 0),
              0,
            ),
          ),
          'Todos os canais',
        ],
        [
          'Encomendas',
          String(data.sales.reduce((sum, item) => sum + item._count, 0)),
          'B2C e B2B',
        ],
        ['Ticket médio', averageTicket(data.sales), 'Sobre vendas registadas'],
        [
          'Canais ativos',
          String(data.sales.filter((item) => item._count > 0).length),
          'Com vendas',
        ],
      ],
      chartTitle: 'Valor por canal',
      source: data.sales,
      moneyBars: true,
      links: [
        ['/encomendas', 'Encomendas', 'Estados, detalhe e operação'],
        ['/recebimentos', 'Recebimentos', 'Valores por liquidar'],
        ['/documentos', 'Documentos', 'Faturas, recibos e notas'],
      ],
    },
    operations: {
      metrics: [
        ['Reservas', String(data.reservedQuantity), 'Unidades comprometidas'],
        ['Sem stock', String(data.outOfStock), 'Produtos indisponíveis'],
        [
          'Reposição',
          String(data.belowReorderPoint),
          'Abaixo do ponto definido',
        ],
        [
          'Incidências',
          String(
            data.supportByStatus.reduce((sum, item) => sum + item._count, 0),
          ),
          'Casos de apoio registados',
        ],
      ],
      chartTitle: 'Encomendas por estado',
      source: data.ordersByStatus,
      links: [
        ['/operacoes/preparacao', 'Preparação', 'Separação de encomendas'],
        ['/operacoes/producao', 'Produção', 'Ordens e componentes'],
        ['/expedicoes', 'Expedições', 'Envios e tracking'],
        ['/apoio', 'Apoio', 'Incidências de cliente'],
      ],
    },
    purchasing: {
      metrics: [
        [
          'Valor estimado',
          formatMoney(data.estimatedStockValueCents),
          'Stock a preço de venda',
        ],
        ['Compras pendentes', String(data.pendingPurchases), 'Por receber'],
        ['Sem stock', String(data.outOfStock), 'Exigem decisão'],
        ['Reposição', String(data.belowReorderPoint), 'Abaixo do mínimo'],
      ],
      chartTitle: 'Compras por estado',
      source: data.purchasesByStatus,
      links: [
        ['/stock', 'Stock', 'Disponível e reservado'],
        ['/compras', 'Compras', 'Ordens e receções'],
        ['/fornecedores', 'Fornecedores', 'Parceiros e condições'],
        ['/stock/inventarios', 'Inventários', 'Contagens e correções'],
      ],
    },
    customers: {
      metrics: [
        ['Particulares', String(userCount('CUSTOMER')), 'Contas de cliente'],
        ['Revendedores', String(data.activeResellers), 'Contas aprovadas'],
        ['Candidaturas', String(data.pendingApplications), 'Aguardam decisão'],
        ['Documentos', 'CRM', 'Relação e histórico'],
      ],
      chartTitle: 'Utilizadores por perfil',
      source: data.usersByRole,
      links: [
        ['/revendedores', 'Revendedores', 'Contas e condições B2B'],
        ['/clube', 'Clube', 'Planos e membros'],
        ['/fidelizacao', 'Fidelização', 'Pontos e regras'],
        ['/vales-oferta', 'Vales-oferta', 'Emissão e saldos'],
      ],
    },
    administration: {
      metrics: [
        [
          'Utilizadores',
          String(data.usersByRole.reduce((s, i) => s + i._count, 0)),
          'Todos os perfis',
        ],
        ['Equipa', String(userCount('STAFF')), 'Utilizadores STAFF'],
        ['Administradores', String(userCount('ADMIN')), 'Acesso total'],
        [
          'Artigos',
          String(data.blogByStatus.reduce((s, i) => s + i._count, 0)),
          'Blog e rascunhos',
        ],
      ],
      chartTitle: 'Artigos por estado',
      source: data.blogByStatus,
      links: [
        ['/utilizadores', 'Utilizadores', 'Perfis e acessos'],
        ['/blog', 'Blog', 'Conteúdo editorial'],
        ['/catalogo/categorias', 'Categorias', 'Estrutura do catálogo'],
      ],
    },
  };
  const selected = views[section];
  const values = selected.source.map((item) =>
    selected.moneyBars ? (item._sum?.totalCents ?? 0) : item._count,
  );
  const max = Math.max(...values, 1);
  return {
    metrics: selected.metrics,
    chartTitle: selected.chartTitle,
    links: selected.links,
    bars: selected.source.map((item, index) => ({
      label: humanize(item.salesChannel ?? item.status ?? item.role ?? 'Outro'),
      formatted: selected.moneyBars
        ? formatMoney(values[index] ?? 0)
        : String(values[index] ?? 0),
      width: Math.max(4, Math.round(((values[index] ?? 0) / max) * 100)),
    })),
  };
}

type View = {
  metrics: Array<[string, string, string]>;
  chartTitle: string;
  links: Array<readonly [string, string, string]>;
  bars: Array<{ label: string; formatted: string; width: number }>;
};

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

function averageTicket(groups: Group[]) {
  const total = groups.reduce(
    (sum, item) => sum + (item._sum?.totalCents ?? 0),
    0,
  );
  const count = groups.reduce((sum, item) => sum + item._count, 0);
  return count ? formatMoney(Math.round(total / count)) : formatMoney(0);
}

function humanize(value: string) {
  return value
    .toLocaleLowerCase('pt-PT')
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toLocaleUpperCase('pt-PT'));
}
