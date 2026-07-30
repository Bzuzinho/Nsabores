'use client';

import { ApiClient } from '@nsabores/api-client';
import { useState, type FormEvent } from 'react';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export default function GiftCardLookupPage() {
  const [result, setResult] = useState<{
    codeLast4: string;
    status: string;
    balanceCents: number;
    reservedCents: number;
    currency: string;
    expiresAt?: string | null;
  } | null>(null);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    const data = new FormData(event.currentTarget);
    try {
      setResult(
        await api.post('/v1/gift-cards/lookup', {
          code: String(data.get('code')),
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível consultar o vale.',
      );
    }
  }

  return (
    <main id="conteudo" className="account-page">
      <form className="account-card auth-form" onSubmit={submit}>
        <p className="eyebrow">Vales-oferta</p>
        <h1>Consultar saldo</h1>
        <label>
          Código do vale
          <input name="code" autoComplete="off" required maxLength={120} />
        </label>
        <button className="button button-primary">Consultar</button>
        {error && <p role="alert">{error}</p>}
        {result && (
          <section>
            <p>
              Vale terminado em <strong>{result.codeLast4}</strong>
            </p>
            <p>Estado: {result.status}</p>
            <p>Saldo disponível: {money(result.balanceCents, result.currency)}</p>
            {result.reservedCents > 0 && (
              <p>Montante reservado: {money(result.reservedCents, result.currency)}</p>
            )}
            {result.expiresAt && (
              <p>Validade: {new Date(result.expiresAt).toLocaleDateString('pt-PT')}</p>
            )}
          </section>
        )}
      </form>
    </main>
  );
}
