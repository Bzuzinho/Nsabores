'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accountApi, useAuth } from './auth-provider';

type ClubPlan = {
  id: string;
  name: string;
  code: string;
  description: string;
  priceCents: number;
  currency: string;
  billingInterval: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  trialDays?: number | null;
  benefits: Record<string, unknown>;
};

const intervalLabel = {
  MONTHLY: 'mês',
  QUARTERLY: 'trimestre',
  YEARLY: 'ano',
} as const;

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100);

export function ClubPlans({ compact = false }: { compact?: boolean }) {
  const [plans, setPlans] = useState<ClubPlan[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void accountApi
      .get<ClubPlan[]>('/v1/club/plans')
      .then(setPlans)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os planos.'),
      );
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!plans.length) return <p>Os planos do Clube serão disponibilizados em breve.</p>;

  return (
    <div className="editorial-grid editorial-grid-three">
      {plans.slice(0, compact ? 3 : undefined).map((plan) => (
        <article key={plan.id}>
          <p className="eyebrow">{plan.trialDays ? `${plan.trialDays} dias de experiência` : 'Clube Nsabores'}</p>
          <h3>{plan.name}</h3>
          <p>{plan.description}</p>
          <p><strong>{money(plan.priceCents, plan.currency)}</strong> / {intervalLabel[plan.billingInterval]}</p>
          <Link className="button button-primary" href={`/clube/aderir/${encodeURIComponent(plan.code)}`}>Escolher plano</Link>
        </article>
      ))}
    </div>
  );
}

export function ClubJoin({ code }: { code: string }) {
  const auth = useAuth();
  const [plan, setPlan] = useState<ClubPlan | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void accountApi.get<ClubPlan[]>('/v1/club/plans').then((rows) => {
      const match = rows.find((row) => row.code === code);
      if (match) setPlan(match);
      else setError('Plano indisponível.');
    });
  }, [code]);

  if (error) return <section className="account-card"><p role="alert">{error}</p></section>;
  if (!plan) return <section className="account-card">A carregar…</section>;

  async function join() {
    if (!auth.user) {
      window.location.href = `/login?next=${encodeURIComponent(`/clube/aderir/${code}`)}`;
      return;
    }
    setBusy(true);
    setError('');
    try {
      await accountApi.post('/v1/account/club/join', {
        planCode: plan.code,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage('Adesão concluída. O Clube já está disponível na sua conta.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a adesão.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-card">
      <p className="eyebrow">Clube Nsabores</p>
      <h1>{plan.name}</h1>
      <p>{plan.description}</p>
      <p><strong>{money(plan.priceCents, plan.currency)}</strong> / {intervalLabel[plan.billingInterval]}</p>
      {plan.trialDays ? <p>Inclui {plan.trialDays} dias de período experimental.</p> : null}
      {message && <p role="status">{message} <Link href="/conta/clube">Ver subscrição</Link></p>}
      {error && <p role="alert">{error}</p>}
      {!message && <button className="button button-primary" disabled={busy} onClick={() => void join()}>{busy ? 'A processar…' : auth.user ? 'Aderir ao Clube' : 'Entrar para aderir'}</button>}
    </section>
  );
}
