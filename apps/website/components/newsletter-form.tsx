'use client';

import { useState, type FormEvent } from 'react';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setMessage('Indique o seu email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Introduza um email válido.');
      return;
    }
    setMessage('Subscrição registada. Obrigado!');
    setEmail('');
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
            Subscrever
          </button>
        </div>
        <p id="newsletter-message" className="form-message" role="status">
          {message}
        </p>
      </form>
    </section>
  );
}
