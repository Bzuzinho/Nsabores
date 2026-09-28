'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

export default function NewsletterUnsubscribePage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await accountApi.post<{ message: string }>(
        '/v1/newsletter/unsubscribe',
        { email: String(data.get('email')) },
      );
      setMessage(result.message);
      event.currentTarget.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível cancelar a subscrição.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="conteudo" className="account-page">
      <article className="account-card">
        <p className="eyebrow">Newsletter</p>
        <h1>Cancelar subscrição</h1>
        <p>
          Indique o email utilizado na newsletter. O pedido não confirma se o
          endereço existia na lista, protegendo assim a privacidade dos
          subscritores.
        </p>
        <form className="account-form" onSubmit={submit}>
          <label>
            Email
            <input required type="email" name="email" />
          </label>
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy}>
            {busy ? 'A processar…' : 'Cancelar subscrição'}
          </button>
        </form>
        <p>
          <Link href="/">Voltar ao website</Link>
        </p>
      </article>
    </main>
  );
}
