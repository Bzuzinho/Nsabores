'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

interface LoyaltyMovement {
  id: string;
  type: string;
  status: string;
  points: number;
  note?: string | null;
  createdAt: string;
}

interface LoyaltyAccount {
  userId: string;
  status: string;
  availablePoints: number;
  pendingPoints: number;
  reservedPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  tier?: string | null;
  transactions: LoyaltyMovement[];
}

interface GiftCardMovement {
  id: string;
  type: string;
  status: string;
  amountCents: number;
  balanceAfterCents: number;
  reservedAfterCents: number;
  note?: string | null;
  createdAt: string;
}

interface GiftCardDetailData {
  id: string;
  codeLast4: string;
  status: string;
  initialAmountCents: number;
  balanceCents: number;
  reservedCents: number;
  currency: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  message?: string | null;
  expiresAt?: string | null;
  blockReason?: string | null;
  transactions: GiftCardMovement[];
}

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export function LoyaltyCustomerDetail({ userId }: { userId: string }) {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function reloadAccount() {
    setAccount(
      await managementApi.get<LoyaltyAccount>(
        `/v1/admin/loyalty/accounts/${userId}`,
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;
    void managementApi
      .get<LoyaltyAccount>(`/v1/admin/loyalty/accounts/${userId}`)
      .then((response) => {
        if (!cancelled) setAccount(response);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar o ledger.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await managementApi.post(
        `/v1/admin/loyalty/accounts/${userId}/adjust`,
        {
          points: Number(data.get('points')),
          note: String(data.get('note')),
          idempotencyKey: crypto.randomUUID(),
        },
      );
      form.reset();
      await reloadAccount();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível ajustar os pontos.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !account) {
    return <p className="admin-error">{error}</p>;
  }
  if (!account) return <div className="admin-state">A carregar…</div>;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Fidelização</p>
          <h1>Ledger do cliente</h1>
          <p>{userId}</p>
        </div>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <section className="user-detail">
        <h2>Saldos</h2>
        <p>
          Disponíveis: <strong>{account.availablePoints}</strong> · Pendentes:{' '}
          <strong>{account.pendingPoints}</strong> · Reservados:{' '}
          <strong>{account.reservedPoints}</strong>
        </p>
        <p>
          Acumulados: {account.lifetimeEarnedPoints} · utilizados:{' '}
          {account.lifetimeRedeemedPoints}
        </p>
      </section>
      <section className="user-detail">
        <h2>Ajuste administrativo</h2>
        <form className="auth-form" onSubmit={adjust}>
          <label>
            Pontos
            <input name="points" type="number" required />
          </label>
          <label>
            Justificação
            <textarea name="note" maxLength={500} required />
          </label>
          <button className="admin-primary" disabled={busy}>
            Registar ajuste
          </button>
        </form>
      </section>
      <section className="user-detail">
        <h2>Movimentos</h2>
        {account.transactions.map((movement) => (
          <article key={movement.id}>
            <p>
              <strong>{movement.type}</strong> · {movement.status} ·{' '}
              {movement.points > 0 ? '+' : ''}
              {movement.points}
            </p>
            <p>
              {new Date(movement.createdAt).toLocaleString('pt-PT')}
              {movement.note ? ` · ${movement.note}` : ''}
            </p>
          </article>
        ))}
      </section>
      <p>
        <Link href="/fidelizacao">Voltar</Link>
      </p>
    </>
  );
}

export function GiftCardDetail({ id }: { id: string }) {
  const [card, setCard] = useState<GiftCardDetailData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function reloadCard() {
    setCard(
      await managementApi.get<GiftCardDetailData>(
        `/v1/admin/loyalty/gift-cards/${id}`,
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;
    void managementApi
      .get<GiftCardDetailData>(`/v1/admin/loyalty/gift-cards/${id}`)
      .then((response) => {
        if (!cancelled) setCard(response);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar o vale.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function block(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await managementApi.patch(
        `/v1/admin/loyalty/gift-cards/${id}/block`,
        { reason: String(data.get('reason')) },
      );
      await reloadCard();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível bloquear o vale.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !card) {
    return <p className="admin-error">{error}</p>;
  }
  if (!card) return <div className="admin-state">A carregar…</div>;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Vale-oferta</p>
          <h1>•••• {card.codeLast4}</h1>
          <p>{card.status}</p>
        </div>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <section className="user-detail">
        <p>
          Valor inicial:{' '}
          <strong>{money(card.initialAmountCents, card.currency)}</strong>
        </p>
        <p>
          Saldo: <strong>{money(card.balanceCents, card.currency)}</strong> ·
          reservado: {money(card.reservedCents, card.currency)}
        </p>
        <p>
          Destinatário: {card.recipientName ?? '—'} ·{' '}
          {card.recipientEmail ?? '—'}
        </p>
        {card.expiresAt && (
          <p>
            Validade: {new Date(card.expiresAt).toLocaleDateString('pt-PT')}
          </p>
        )}
        {card.blockReason && <p>Motivo do bloqueio: {card.blockReason}</p>}
      </section>
      {card.status === 'ACTIVE' && (
        <section className="user-detail">
          <h2>Bloquear vale</h2>
          <form className="auth-form" onSubmit={block}>
            <label>
              Motivo
              <textarea name="reason" maxLength={500} required />
            </label>
            <button disabled={busy}>Bloquear</button>
          </form>
        </section>
      )}
      <section className="user-detail">
        <h2>Movimentos</h2>
        {card.transactions.map((movement) => (
          <article key={movement.id}>
            <p>
              <strong>{movement.type}</strong> · {movement.status} ·{' '}
              {money(movement.amountCents, card.currency)}
            </p>
            <p>
              Saldo após: {money(movement.balanceAfterCents, card.currency)} ·
              reservado: {money(movement.reservedAfterCents, card.currency)} ·{' '}
              {new Date(movement.createdAt).toLocaleString('pt-PT')}
            </p>
          </article>
        ))}
      </section>
      <p>
        <Link href="/vales-oferta">Voltar</Link>
      </p>
    </>
  );
}
