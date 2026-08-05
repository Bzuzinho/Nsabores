'use client';

import { useState, type FormEvent } from 'react';
import { accountApi } from './auth-provider';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

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
          <button className="button button-primary" type="submit">
            {busy ? 'A registar…' : 'Subscrever'}
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
        <p id="newsletter-message" className="form-message" role="status">
          {message}
        </p>
      </form>
    </section>
  );
}
