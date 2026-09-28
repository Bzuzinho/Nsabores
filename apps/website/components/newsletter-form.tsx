'use client';

import { useState, type FormEvent } from 'react';
import { accountApi } from './auth-provider';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function unsubscribe() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Indique o email que pretende retirar da newsletter.');
      return;
    }
    setBusy(true);
    try {
      await accountApi.post('/v1/newsletter/unsubscribe', { email });
      setMessage(
        'Pedido registado. Se o email estava subscrito, deixou de receber a newsletter.',
      );
      setConsent(false);
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível cancelar a subscrição.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setMessage('Indique o seu email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Introduza um email válido.');
      return;
    }
    if (!consent) {
      setMessage('Confirme o consentimento para subscrever.');
      return;
    }
    setBusy(true);
    try {
      await accountApi.post('/v1/newsletter', {
        email,
        consentAccepted: true,
        source: 'WEBSITE',
      });
      setMessage('Subscrição registada. Obrigado!');
      setEmail('');
      setConsent(false);
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível registar a subscrição.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <div>
        <p className="eyebrow">Receitas, novidades e sugestões</p>
        <h2 id="newsletter-title">Leve os melhores sabores para a sua mesa.</h2>
      </div>
      <form noValidate onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="newsletter-email">
          Email
        </label>
        <div className="newsletter-controls">
          <input
            id="newsletter-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="O seu email"
            value={email}
            aria-describedby="newsletter-message"
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? 'A processar…' : 'Subscrever'}
          </button>
        </div>
        <label className="newsletter-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />{' '}
          Aceito receber novidades e posso cancelar a qualquer momento.
        </label>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => void unsubscribe()}
        >
          Cancelar subscrição deste email
        </button>
        <p id="newsletter-message" className="form-message" role="status">
          {message}
        </p>
      </form>
    </section>
  );
}
