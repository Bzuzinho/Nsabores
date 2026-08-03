'use client';

import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

interface LoyaltyTransaction {
  id: string;
  type: string;
  status: string;
  points: number;
  note?: string | null;
  createdAt: string;
}

interface LoyaltyAccount {
  availablePoints: number;
  pendingPoints: number;
  reservedPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  tier?: string | null;
  transactions: LoyaltyTransaction[];
}

export default function LoyaltyAccountPage() {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void accountApi
      .get<LoyaltyAccount>('/v1/account/loyalty')
      .then((value) => {
        if (active) setAccount(value);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar a fidelização.',
          );
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="conteudo" className="account-page">
      <section className="account-card">
        <p className="eyebrow">Fidelização</p>
        <h1>Os seus pontos Nsabores</h1>
        {error && <p role="alert">{error}</p>}
        {!account ? (
          <p>A carregar…</p>
        ) : (
          <>
            <div className="editorial-grid editorial-grid-three">
              <article>
                <span>Disponíveis</span>
                <h2>{account.availablePoints}</h2>
                <p>Podem ser usados no checkout.</p>
              </article>
              <article>
                <span>Pendentes</span>
                <h2>{account.pendingPoints}</h2>
                <p>Aguardam o prazo de libertação.</p>
              </article>
              <article>
                <span>Reservados</span>
                <h2>{account.reservedPoints}</h2>
                <p>Associados a encomendas ainda em processamento.</p>
              </article>
            </div>
            <p>
              Total acumulado: <strong>{account.lifetimeEarnedPoints}</strong> ·
              Total utilizado: <strong>{account.lifetimeRedeemedPoints}</strong>
            </p>
            <h2>Movimentos</h2>
            {!account.transactions.length && (
              <p>Ainda não existem movimentos.</p>
            )}
            {account.transactions.map((movement) => (
              <article key={movement.id} className="account-card">
                <p>
                  <strong>{movement.type}</strong> · {movement.status}
                </p>
                <p>
                  {movement.points > 0 ? '+' : ''}
                  {movement.points} pontos ·{' '}
                  {new Date(movement.createdAt).toLocaleString('pt-PT')}
                </p>
                {movement.note && <p>{movement.note}</p>}
              </article>
            ))}
          </>
        )}
      </section>
    </main>
  );
}
