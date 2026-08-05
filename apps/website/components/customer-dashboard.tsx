'use client';

import type { AccountDashboard, AuthUser } from '@nsabores/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/data/site';
import { accountApi } from './auth-provider';

const labels = {
  PARTICULAR: {
    badge: 'Cliente particular',
    title: 'A sua Nsabores, num só lugar.',
    description: 'Compras, benefícios, documentos e dados pessoais.',
  },
  RESELLER: {
    badge: 'Revendedor',
    title: 'A sua operação profissional, sem atalhos escondidos.',
    description: 'Preços atribuídos, condições comerciais e encomendas B2B.',
  },
  B2B: {
    badge: 'Cliente empresarial',
    title: 'Compras e relação comercial numa única área.',
    description: 'Condições, catálogo profissional e histórico da empresa.',
  },
} as const;

const particularLinks = [
  ['/conta/encomendas', 'Encomendas', 'Acompanhar, repetir ou devolver.'],
  ['/conta/clube', 'Clube Nsabores', 'Plano, benefícios e cobranças.'],
  ['/conta/fidelizacao', 'Fidelização', 'Pontos disponíveis e movimentos.'],
  ['/conta/documentos', 'Documentos', 'Faturas, recibos e notas de crédito.'],
  ['/conta/apoio', 'Apoio', 'Pedidos e conversa com a equipa.'],
  ['/conta/perfil', 'Perfil', 'Dados pessoais e preferências.'],
  ['/conta/moradas', 'Moradas', 'Entrega e faturação.'],
  ['/conta/seguranca', 'Segurança', 'Password e sessões ativas.'],
] as const;

const businessLinks = [
  ['/conta/empresa', 'A minha empresa', 'Identificação e estado da conta.'],
  ['/conta/precos', 'Preços profissionais', 'Catálogo e tabela atribuída.'],
  [
    '/conta/condicoes-comerciais',
    'Condições comerciais',
    'Pagamento, mínimos, crédito e portes.',
  ],
  ['/conta/encomendas', 'Encomendas', 'Pedidos B2B e respetivo estado.'],
  ['/conta/documentos', 'Documentos', 'Histórico comercial e fiscal.'],
  ['/conta/apoio', 'Apoio', 'Pedidos e conversa com a equipa.'],
  ['/conta/perfil', 'Utilizador', 'Dados e contactos do seu acesso.'],
  ['/conta/seguranca', 'Segurança', 'Password e sessões ativas.'],
] as const;

export function CustomerDashboard({ user }: { user: AuthUser }) {
  const [data, setData] = useState<AccountDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void accountApi
      .get<AccountDashboard>('/v1/account/dashboard')
      .then((value) => active && setData(value))
      .catch(
        (reason: unknown) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar o painel.',
          ),
      );
    return () => {
      active = false;
    };
  }, []);

  if (error)
    return (
      <div className="account-dashboard-state" role="alert">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="account-dashboard-state" aria-busy="true">
        A preparar a sua área de cliente…
      </div>
    );

  const copy = labels[data.accountType];
  const links =
    data.accountType === 'PARTICULAR' ? particularLinks : businessLinks;
  return (
    <div className="customer-dashboard">
      <section className="customer-dashboard-hero">
        <div>
          <span>{copy.badge}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="customer-dashboard-identity">
          <strong>
            {data.businessAccount?.tradeName ??
              `${user.firstName} ${user.lastName}`}
          </strong>
          <small>{user.email}</small>
          {data.businessAccount && <em>{data.businessAccount.status}</em>}
        </div>
      </section>

      <section className="customer-metrics" aria-label="Resumo da conta">
        <article>
          <span>Encomendas</span>
          <strong>{data.orders.total}</strong>
          <small>{data.orders.active} em curso</small>
        </article>
        {data.accountType === 'PARTICULAR' ? (
          <>
            <article>
              <span>Pontos</span>
              <strong>{data.loyalty.availablePoints}</strong>
              <small>{data.loyalty.pendingPoints} pendentes</small>
            </article>
            <article>
              <span>Clube</span>
              <strong>{data.club.active ? 'Ativo' : '—'}</strong>
              <small>{data.club.planName ?? 'Sem plano'}</small>
            </article>
          </>
        ) : (
          <>
            <article>
              <span>Tabela</span>
              <strong>{data.businessAccount?.priceListName ?? '—'}</strong>
              <small>Preços profissionais</small>
            </article>
            <article>
              <span>Canal</span>
              <strong>
                {data.accountType === 'RESELLER' ? 'Revenda' : 'B2B'}
              </strong>
              <small>Conta profissional</small>
            </article>
          </>
        )}
        <article>
          <span>Documentos</span>
          <strong>{data.documents}</strong>
          <small>Disponíveis na conta</small>
        </article>
      </section>

      <section className="customer-dashboard-grid">
        {links.map(([href, title, description]) => (
          <Link href={href} key={href}>
            <span>↗</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </Link>
        ))}
      </section>

      <section className="customer-recent-orders">
        <header>
          <div>
            <p className="eyebrow">Atividade recente</p>
            <h2>Últimas encomendas</h2>
          </div>
          <Link href="/conta/encomendas">Ver todas</Link>
        </header>
        {data.orders.recent.length ? (
          data.orders.recent.map((order) => (
            <Link href={`/conta/encomendas/${order.id}`} key={order.id}>
              <span>
                <strong>{order.number}</strong>
                <small>
                  {new Date(order.createdAt).toLocaleDateString('pt-PT')}
                </small>
              </span>
              <span>{order.status.replaceAll('_', ' ')}</span>
              <strong>{formatPrice(order.totalCents)}</strong>
            </Link>
          ))
        ) : (
          <p>Ainda não existem encomendas nesta conta.</p>
        )}
      </section>
    </div>
  );
}
