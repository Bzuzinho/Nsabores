'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useManagementAuth } from '@/components/management-auth';

export default function LoginPage() {
  const auth = useManagementAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const user = await auth.login(
        String(data.get('email')),
        String(data.get('password')),
      );
      router.replace(user.role === 'CUSTOMER' ? '/sem-acesso' : '/catalogo');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível entrar.',
      );
    }
  };
  return (
    <main className="management-login">
      <form onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">Nsabores Gestão</p>
        <h1>Entrar</h1>
        <label>
          Email
          <input required type="email" name="email" />
        </label>
        <label>
          Password
          <input required type="password" name="password" />
        </label>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <button className="admin-primary">Entrar</button>
      </form>
    </main>
  );
}
