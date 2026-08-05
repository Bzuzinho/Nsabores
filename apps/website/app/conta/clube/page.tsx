'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

type Charge = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt?: string | null;
};

type ClubPlan = {
  id: string;
  name: string;
  code: string;
  priceCents: number;
  currency: string;
  billingInterval: string;
};

type Subscription = {
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
  benefits?: Record<string, unknown>;
  charges: Charge[];
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export default function AccountClubPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<ClubPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [current, planRows] = await Promise.all([
        accountApi.get<Subscription | null>('/v1/account/club'),
        accountApi.get<ClubPlan[]>('/v1/club/plans'),
      ]);
      setSubscription(current);
      setPlans(planRows);
      setSelectedPlan(current?.planCode ?? '');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o Clube.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial API hydration intentionally updates local component state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function mutate(path: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    try {
      await accountApi.post(path, body);
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

  if (loading) return <section className="account-card">A carregar…</section>;
  if (!subscription) {
    return (
      <section className="account-card">
        <p className="eyebrow">Clube Nsabores</p>
        <h1>Ainda não tem uma subscrição ativa.</h1>
        <p>
          <Link className="button button-primary" href="/clube/planos">
            Ver planos
          </Link>
        </p>
      </section>
    );
  }

  const alternatePlans = plans.filter(
    (plan) => plan.code !== subscription.planCode,
  );

  return (
    <section className="account-card">
      <p className="eyebrow">Clube Nsabores</p>
      <h1>{subscription.planName}</h1>
      <p>
        Estado: <strong>{subscription.status}</strong>
      </p>
      <p>
        {money(subscription.priceCentsSnapshot, subscription.currencySnapshot)}{' '}
        · {subscription.billingIntervalSnapshot}
      </p>
      {subscription.trialEndsAt && (
        <p>
          Período experimental até{' '}
          {new Date(subscription.trialEndsAt).toLocaleDateString('pt-PT')}.
        </p>
      )}
      <p>
        Período atual:{' '}
        {new Date(subscription.currentPeriodStart).toLocaleDateString('pt-PT')}{' '}
        — {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-PT')}.
      </p>

      {alternatePlans.length > 0 && !subscription.cancelAtPeriodEnd && (
        <div>
          <h2>Alterar plano</h2>
          <p>
            A alteração é imediata e não existe acerto proporcional do período
            atual. O novo preço fica como referência para a renovação seguinte.
          </p>
          <label>
            Novo plano
            <select
              value={selectedPlan}
              onChange={(event) => setSelectedPlan(event.target.value)}
            >
              <option value={subscription.planCode}>
                {subscription.planName} · atual
              </option>
              {alternatePlans.map((plan) => (
                <option key={plan.id} value={plan.code}>
                  {plan.name} · {money(plan.priceCents, plan.currency)} ·{' '}
                  {plan.billingInterval}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-primary"
            disabled={busy || selectedPlan === subscription.planCode}
            onClick={() =>
              void mutate('/v1/account/club/change-plan', {
                planCode: selectedPlan,
              })
            }
          >
            Alterar plano
          </button>
        </div>
      )}

      {subscription.cancelAtPeriodEnd ? (
        <>
          <p>
            O cancelamento está agendado para o fim do período atual. Até essa
            data, os benefícios mantêm-se ativos.
          </p>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void mutate('/v1/account/club/resume')}
          >
            Retomar subscrição
          </button>
        </>
      ) : (
        <button
          disabled={busy}
          onClick={() => void mutate('/v1/account/club/cancel')}
        >
          Cancelar no fim do período
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <h2>Cobranças</h2>
      {!subscription.charges.length && (
        <p>Ainda não existem cobranças concluídas.</p>
      )}
      {subscription.charges.map((charge) => (
        <p key={charge.id}>
          {new Date(charge.periodStart).toLocaleDateString('pt-PT')} —{' '}
          {money(charge.amountCents, charge.currency)} · {charge.status}
        </p>
      ))}
    </section>
  );
}
