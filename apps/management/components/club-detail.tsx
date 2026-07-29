'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

type SubscriptionEvent = {
  id: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
};

type SubscriptionCharge = {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  currency: string;
  status: string;
  providerPaymentId?: string | null;
  paidAt?: string | null;
};

type SubscriptionDetail = {
  id: string;
  status: string;
  planName: string;
  planCode: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd: boolean;
  priceCentsSnapshot: number;
  currencySnapshot: string;
  billingIntervalSnapshot: string;
  events: SubscriptionEvent[];
  charges: SubscriptionCharge[];
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export function ClubPlanDetail({ id }: { id: string }) {
  const [plan, setPlan] = useState<ClubPlan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setPlan(
        await managementApi.get<ClubPlan>(`/v1/admin/club/plans/${id}`),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o plano.',
      );
    }
  }, [id]);

  useEffect(() => void reload(), [reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await managementApi.patch(`/v1/admin/club/plans/${id}`, {
        name: String(data.get('name')),
        code: String(data.get('code')),
        description: String(data.get('description')),
        status: String(data.get('status')),
        priceCents: Number(data.get('priceCents')),
        billingInterval: String(data.get('billingInterval')),
        trialDays: data.get('trialDays')
          ? Number(data.get('trialDays'))
          : undefined,
        benefits: {
          ...plan.benefits,
          discountPercent: Number(data.get('discountPercent') || 0),
        },
        isPublic: data.get('isPublic') === 'on',
        sortOrder: Number(data.get('sortOrder') || 0),
      });
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível guardar o plano.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!plan) return <div className="admin-state">A carregar…</div>;
  const discountPercent =
    typeof plan.benefits?.discountPercent === 'number'
      ? plan.benefits.discountPercent
      : 0;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Clube Nsabores</p>
          <h1>{plan.name}</h1>
          <p>{plan.code}</p>
        </div>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <section className="user-detail">
        <form className="auth-form" onSubmit={save}>
          <label>
            Nome<input name="name" defaultValue={plan.name} required />
          </label>
          <label>
            Código<input name="code" defaultValue={plan.code} required />
          </label>
          <label>
            Descrição
            <textarea name="description" defaultValue={plan.description} />
          </label>
          <label>
            Estado
            <select name="status" defaultValue={plan.status}>
              <option>DRAFT</option>
              <option>ACTIVE</option>
              <option>PAUSED</option>
              <option>ARCHIVED</option>
            </select>
          </label>
          <label>
            Preço (cêntimos)
            <input
              name="priceCents"
              type="number"
              min="0"
              defaultValue={plan.priceCents}
              required
            />
          </label>
          <label>
            Periodicidade
            <select name="billingInterval" defaultValue={plan.billingInterval}>
              <option>MONTHLY</option>
              <option>QUARTERLY</option>
              <option>YEARLY</option>
            </select>
          </label>
          <label>
            Trial (dias)
            <input
              name="trialDays"
              type="number"
              min="0"
              max="365"
              defaultValue={plan.trialDays ?? ''}
            />
          </label>
          <label>
            Desconto Clube (%)
            <input
              name="discountPercent"
              type="number"
              min="0"
              max="100"
              defaultValue={discountPercent}
            />
          </label>
          <label>
            Ordem
            <input name="sortOrder" type="number" defaultValue={plan.sortOrder} />
          </label>
          <label>
            <input
              name="isPublic"
              type="checkbox"
              defaultChecked={plan.isPublic}
            />{' '}
            Visível publicamente
          </label>
          <button className="admin-primary" disabled={busy}>
            {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </form>
      </section>
      <p>
        <Link href="/clube/planos">Voltar aos planos</Link>
      </p>
    </>
  );
}

export function ClubSubscriptionDetail({ id }: { id: string }) {
  const [subscription, setSubscription] =
    useState<SubscriptionDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSubscription(
        await managementApi.get<SubscriptionDetail>(
          `/v1/admin/club/subscriptions/${id}`,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar a subscrição.',
      );
    }
  }, [id]);

  useEffect(() => void reload(), [reload]);

  async function action(path: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    try {
      await managementApi.post(path, body);
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível alterar a subscrição.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!subscription) return <div className="admin-state">A carregar…</div>;

  const canRenew = ['ACTIVE', 'PAST_DUE', 'TRIALING'].includes(
    subscription.status,
  );
  const canScheduleCancel = ![
    'CANCELLED',
    'EXPIRED',
    'CANCEL_AT_PERIOD_END',
  ].includes(subscription.status);
  const canResume = subscription.status === 'CANCEL_AT_PERIOD_END';

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Subscrição</p>
          <h1>{subscription.planName}</h1>
          <p>{subscription.status}</p>
        </div>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <section className="user-detail">
        <p>
          Plano: <strong>{subscription.planCode}</strong>
        </p>
        <p>
          Preço snapshot:{' '}
          <strong>
            {money(
              subscription.priceCentsSnapshot,
              subscription.currencySnapshot,
            )}
          </strong>{' '}
          · {subscription.billingIntervalSnapshot}
        </p>
        <p>
          Período:{' '}
          {new Date(subscription.currentPeriodStart).toLocaleString('pt-PT')} —{' '}
          {new Date(subscription.currentPeriodEnd).toLocaleString('pt-PT')}
        </p>
        {subscription.trialEndsAt && (
          <p>
            Trial até{' '}
            {new Date(subscription.trialEndsAt).toLocaleString('pt-PT')}
          </p>
        )}
        <p>
          Cancelamento no fim do período:{' '}
          {subscription.cancelAtPeriodEnd ? 'Sim' : 'Não'}
        </p>
        <div>
          <button
            className="admin-primary"
            disabled={busy || !canRenew}
            onClick={() =>
              void action(`/v1/admin/club/subscriptions/${id}/renew`)
            }
          >
            Forçar renovação mock
          </button>{' '}
          {canScheduleCancel && (
            <button
              disabled={busy}
              onClick={() =>
                void action(`/v1/admin/club/subscriptions/${id}/cancel`, {
                  reason: 'Cancelamento agendado pelo management.',
                })
              }
            >
              Agendar cancelamento
            </button>
          )}{' '}
          {canResume && (
            <button
              disabled={busy}
              onClick={() =>
                void action(`/v1/admin/club/subscriptions/${id}/resume`, {
                  reason: 'Cancelamento removido pelo management.',
                })
              }
            >
              Retomar subscrição
            </button>
          )}
        </div>
      </section>
      <section className="user-detail">
        <h2>Cobranças</h2>
        {!subscription.charges.length && <p>Sem cobranças.</p>}
        {subscription.charges.map((charge) => (
          <article key={charge.id}>
            <p>
              <strong>{money(charge.amountCents, charge.currency)}</strong> ·{' '}
              {charge.status}
            </p>
            <p>
              {new Date(charge.periodStart).toLocaleDateString('pt-PT')} —{' '}
              {new Date(charge.periodEnd).toLocaleDateString('pt-PT')} ·{' '}
              {charge.providerPaymentId ?? 'sem referência'}
            </p>
          </article>
        ))}
      </section>
      <section className="user-detail">
        <h2>Histórico</h2>
        {subscription.events.map((event) => (
          <p key={event.id}>
            {new Date(event.createdAt).toLocaleString('pt-PT')} —{' '}
            <strong>{event.type}</strong>
            {event.note ? ` · ${event.note}` : ''}
          </p>
        ))}
      </section>
      <p>
        <Link href="/clube/subscricoes">Voltar às subscrições</Link>
      </p>
    </>
  );
}
