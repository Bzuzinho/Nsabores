'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { managementApi } from './management-auth';

type ClubPlan = {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  priceCents: number;
  currency: string;
  billingInterval: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  trialDays?: number | null;
  benefits: Record<string, unknown>;
  isPublic: boolean;
  sortOrder: number;
};

type ClubSubscription = {
  id: string;
  userId: string;
  status: string;
  email: string;
  firstName: string;
  lastName: string;
  planName: string;
  planCode: string;
  priceCentsSnapshot: number;
  currencySnapshot: string;
  currentPeriodEnd: string;
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export function ClubAdmin({
  mode,
}: {
  mode: 'dashboard' | 'plans' | 'subscriptions';
}) {
  const [plans, setPlans] = useState<ClubPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<ClubSubscription[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError('');
    try {
      const [planRows, subscriptionRows] = await Promise.all([
        managementApi.get<ClubPlan[]>('/v1/admin/club/plans'),
        managementApi.get<ClubSubscription[]>('/v1/admin/club/subscriptions'),
      ]);
      setPlans(planRows);
      setSubscriptions(subscriptionRows);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o Clube.',
      );
    }
  }, []);

  useEffect(() => {
    // Initial API hydration intentionally updates local component state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const metrics = useMemo(() => {
    const active = subscriptions.filter(
      (row) => row.status === 'ACTIVE',
    ).length;
    const trial = subscriptions.filter(
      (row) => row.status === 'TRIALING',
    ).length;
    const pastDue = subscriptions.filter(
      (row) => row.status === 'PAST_DUE',
    ).length;
    const cancelling = subscriptions.filter(
      (row) => row.status === 'CANCEL_AT_PERIOD_END',
    ).length;
    const monthlyEquivalent = subscriptions
      .filter((row) =>
        ['ACTIVE', 'TRIALING', 'CANCEL_AT_PERIOD_END'].includes(row.status),
      )
      .reduce((sum, row) => {
        const plan = plans.find((candidate) => candidate.code === row.planCode);
        if (!plan) return sum;
        if (plan.billingInterval === 'MONTHLY')
          return sum + row.priceCentsSnapshot;
        if (plan.billingInterval === 'QUARTERLY')
          return sum + Math.round(row.priceCentsSnapshot / 3);
        return sum + Math.round(row.priceCentsSnapshot / 12);
      }, 0);
    return { active, trial, pastDue, cancelling, monthlyEquivalent };
  }, [plans, subscriptions]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const discountPercent = Number(data.get('discountPercent') || 0);
      await managementApi.post('/v1/admin/club/plans', {
        name: String(data.get('name')),
        code: String(data.get('code')),
        description: String(data.get('description')),
        status: String(data.get('status')),
        priceCents: Number(data.get('priceCents')),
        billingInterval: String(data.get('billingInterval')),
        trialDays: data.get('trialDays')
          ? Number(data.get('trialDays'))
          : undefined,
        benefits: discountPercent > 0 ? { discountPercent } : {},
        isPublic: data.get('isPublic') === 'on',
        sortOrder: Number(data.get('sortOrder') || 0),
      });
      form.reset();
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar o plano.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Clube Nsabores</p>
          <h1>
            {mode === 'dashboard'
              ? 'Clube'
              : mode === 'plans'
                ? 'Planos'
                : 'Subscrições'}
          </h1>
        </div>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      {mode === 'dashboard' && (
        <>
          <section className="user-detail">
            <h2>Resumo</h2>
            <p>
              Ativas: <strong>{metrics.active}</strong> · Trial:{' '}
              <strong>{metrics.trial}</strong> · Past due:{' '}
              <strong>{metrics.pastDue}</strong> · Cancelamento agendado:{' '}
              <strong>{metrics.cancelling}</strong>
            </p>
            <p>
              MRR estimado: <strong>{money(metrics.monthlyEquivalent)}</strong>
            </p>
            <p>
              <Link href="/clube/planos">Gerir planos</Link> ·{' '}
              <Link href="/clube/subscricoes">Ver subscrições</Link>
            </p>
          </section>
        </>
      )}

      {mode === 'plans' && (
        <>
          <section className="user-detail">
            <h2>Novo plano</h2>
            <form className="auth-form" onSubmit={createPlan}>
              <label>
                Nome
                <input name="name" required maxLength={120} />
              </label>
              <label>
                Código
                <input name="code" required maxLength={60} />
              </label>
              <label>
                Descrição
                <textarea name="description" maxLength={1000} />
              </label>
              <label>
                Estado
                <select name="status" defaultValue="DRAFT">
                  <option>DRAFT</option>
                  <option>ACTIVE</option>
                  <option>PAUSED</option>
                </select>
              </label>
              <label>
                Preço (cêntimos)
                <input name="priceCents" type="number" min="0" required />
              </label>
              <label>
                Periodicidade
                <select name="billingInterval" defaultValue="MONTHLY">
                  <option>MONTHLY</option>
                  <option>QUARTERLY</option>
                  <option>YEARLY</option>
                </select>
              </label>
              <label>
                Trial (dias)
                <input name="trialDays" type="number" min="0" max="365" />
              </label>
              <label>
                Desconto Clube (%)
                <input name="discountPercent" type="number" min="0" max="100" />
              </label>
              <label>
                Ordem
                <input name="sortOrder" type="number" defaultValue="0" />
              </label>
              <label>
                <input name="isPublic" type="checkbox" defaultChecked /> Visível
                publicamente
              </label>
              <button className="admin-primary" disabled={busy}>
                Criar plano
              </button>
            </form>
          </section>
          <section className="user-detail">
            <h2>Planos existentes</h2>
            {plans.map((plan) => (
              <article key={plan.id}>
                <p>
                  <strong>{plan.name}</strong> · {plan.code} · {plan.status}
                </p>
                <p>
                  {money(plan.priceCents, plan.currency)} ·{' '}
                  {plan.billingInterval}
                </p>
                <Link href={`/clube/planos/${plan.id}`}>Editar</Link>
              </article>
            ))}
          </section>
        </>
      )}

      {mode === 'subscriptions' && (
        <section className="user-detail">
          <h2>Subscrições</h2>
          {!subscriptions.length && <p>Sem subscrições.</p>}
          {subscriptions.map((row) => (
            <article key={row.id}>
              <p>
                <strong>
                  {row.firstName} {row.lastName}
                </strong>{' '}
                · {row.email}
              </p>
              <p>
                {row.planName} · {row.status} · até{' '}
                {new Date(row.currentPeriodEnd).toLocaleDateString('pt-PT')}
              </p>
              <Link href={`/clube/subscricoes/${row.id}`}>Detalhe</Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
