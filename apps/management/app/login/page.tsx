'use client';

import { useManagementAuth } from '@/components/management-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const websiteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const auth = useManagementAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.user) {
      router.replace(auth.user.role === 'CUSTOMER' ? '/sem-acesso' : '/');
    }
  }, [auth.loading, auth.user, router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      const user = await auth.login(
        String(data.get('email')),
        String(data.get('password')),
      );
      router.replace(user.role === 'CUSTOMER' ? '/sem-acesso' : '/');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível entrar.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="management-login">
      <section className="management-login-story">
        <Link className="management-login-brand" href={websiteUrl}>
          <span>N</span>
          <strong>Nsabores</strong>
        </Link>
        <div>
          <p className="eyebrow">Gestão integrada</p>
          <h1>O negócio por dentro, com a mesma atenção ao detalhe.</h1>
          <p>
            Um espaço reservado à equipa para gerir a loja, as operações e as
            relações que fazem a Nsabores crescer.
          </p>
        </div>
        <small>Produtos com origem. Gestão com direção.</small>
      </section>
      <section className="management-login-panel">
        <form onSubmit={(event) => void submit(event)}>
          <div>
            <p className="eyebrow">Área reservada</p>
            <h2>Bem-vindo de volta</h2>
            <p>Entre com a conta atribuída à equipa Nsabores.</p>
          </div>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              required
              type="email"
              name="email"
              placeholder="nome@nsabores.pt"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              required
              type="password"
              name="password"
              placeholder="A sua password"
            />
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <button className="admin-primary" disabled={submitting}>
            {submitting ? 'A entrar…' : 'Entrar na gestão'}
          </button>
          <Link href={websiteUrl} className="management-login-help">
            Voltar ao website
          </Link>
        </form>
      </section>
    </main>
  );
}
