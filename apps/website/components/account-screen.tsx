'use client';

import type { Address, AuthSessionView } from '@nsabores/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { accountApi, useAuth } from './auth-provider';

type Mode =
  | 'login'
  | 'register'
  | 'forgot'
  | 'reset'
  | 'verify'
  | 'overview'
  | 'profile'
  | 'addresses'
  | 'security';

export function AccountScreen({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [sessions, setSessions] = useState<AuthSessionView[]>([]);

  const protectedMode = [
    'overview',
    'profile',
    'addresses',
    'security',
  ].includes(mode);
  useEffect(() => {
    if (!auth.loading && protectedMode && !auth.user) {
      router.replace(
        `/conta/entrar?redirect=/conta${mode === 'overview' ? '' : `/${mode === 'addresses' ? 'moradas' : mode === 'security' ? 'seguranca' : 'perfil'}`}`,
      );
    }
  }, [auth.loading, auth.user, mode, protectedMode, router]);

  useEffect(() => {
    if (mode === 'addresses' && auth.user) {
      void accountApi
        .get<Address[]>('/v1/account/addresses')
        .then(setAddresses);
    }
    if (mode === 'security' && auth.user) {
      void accountApi
        .get<AuthSessionView[]>('/v1/auth/sessions')
        .then(setSessions);
    }
  }, [auth.user, mode]);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setLocalError('');
    try {
      await operation();
      setMessage(success);
      return true;
    } catch (reason) {
      setLocalError(
        reason instanceof Error ? reason.message : 'Ocorreu um erro.',
      );
      return false;
    }
  };

  if (auth.loading || (protectedMode && !auth.user)) {
    return (
      <main className="account-state" aria-busy="true">
        A restaurar sessão...
      </main>
    );
  }

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const ok = await run(
      () =>
        mode === 'login'
          ? auth.login(String(data.email), String(data.password))
          : auth.register({
              ...data,
              marketingConsent: data.marketingConsent === 'on',
            }),
      'Sessão iniciada.',
    );
    if (ok) router.push(search.get('redirect') || '/conta');
  };

  if (mode === 'login' || mode === 'register') {
    return (
      <AccountFrame
        title={mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
      >
        <form
          className="account-form"
          onSubmit={(event) => void submitAuth(event)}
        >
          {mode === 'register' && (
            <>
              <label>
                Nome
                <input required name="firstName" />
              </label>
              <label>
                Apelido
                <input required name="lastName" />
              </label>
            </>
          )}
          <label>
            Email
            <input required type="email" name="email" />
          </label>
          <label>
            Password
            <input required type="password" name="password" minLength={10} />
          </label>
          {mode === 'register' && (
            <label className="account-check">
              <input type="checkbox" name="marketingConsent" /> Quero receber
              novidades Nsabores
            </label>
          )}
          <Feedback message={message} error={localError || auth.error} />
          <button className="button button-primary">
            {mode === 'login' ? 'Entrar' : 'Registar'}
          </button>
          <p>
            {mode === 'login' ? (
              <>
                <Link href="/conta/recuperar-password">Recuperar password</Link>{' '}
                · <Link href="/conta/registar">Criar conta</Link>
              </>
            ) : (
              <Link href="/conta/entrar">Já tenho conta</Link>
            )}
          </p>
        </form>
      </AccountFrame>
    );
  }

  if (mode === 'forgot' || mode === 'reset' || mode === 'verify') {
    const submitToken = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const path =
        mode === 'forgot'
          ? '/v1/auth/forgot-password'
          : mode === 'reset'
            ? '/v1/auth/reset-password'
            : '/v1/auth/verify-email';
      await run(
        () =>
          accountApi.post(path, {
            ...data,
            token: data.token || search.get('token'),
          }),
        mode === 'forgot'
          ? 'Se a conta existir, receberá instruções.'
          : 'Operação concluída.',
      );
    };
    return (
      <AccountFrame
        title={
          mode === 'forgot'
            ? 'Recuperar password'
            : mode === 'reset'
              ? 'Definir nova password'
              : 'Verificar email'
        }
      >
        <form
          className="account-form"
          onSubmit={(event) => void submitToken(event)}
        >
          {mode === 'forgot' ? (
            <label>
              Email
              <input required type="email" name="email" />
            </label>
          ) : (
            !search.get('token') && (
              <label>
                Token
                <input required name="token" />
              </label>
            )
          )}
          {mode === 'reset' && (
            <label>
              Nova password
              <input required type="password" name="password" minLength={10} />
            </label>
          )}
          <Feedback message={message} error={localError} />
          <button className="button button-primary">Continuar</button>
        </form>
      </AccountFrame>
    );
  }

  const user = auth.user!;
  if (mode === 'overview') {
    return (
      <AccountFrame title={`Olá, ${user.firstName}`}>
        <nav className="account-menu">
          <Link href="/conta/perfil">Perfil</Link>
          <Link href="/conta/moradas">Moradas</Link>
          <Link href="/conta/seguranca">Segurança</Link>
        </nav>
        {!user.emailVerifiedAt && (
          <button
            className="text-button"
            onClick={() =>
              void run(
                () => accountApi.post('/v1/auth/resend-verification'),
                'Email de verificação enviado.',
              )
            }
          >
            Reenviar verificação de email
          </button>
        )}
        <button
          className="button button-outline-dark"
          onClick={() => void auth.logout().then(() => router.push('/'))}
        >
          Terminar sessão
        </button>
        <Feedback message={message} error={localError} />
      </AccountFrame>
    );
  }

  if (mode === 'profile') {
    const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (
        await run(
          () =>
            accountApi.patch('/v1/account/profile', {
              ...data,
              marketingConsent: data.marketingConsent === 'on',
            }),
          'Perfil atualizado.',
        )
      )
        await auth.reload();
    };
    return (
      <AccountFrame title="Perfil">
        <form
          className="account-form two-columns"
          onSubmit={(event) => void submit(event)}
        >
          <label>
            Nome
            <input required name="firstName" defaultValue={user.firstName} />
          </label>
          <label>
            Apelido
            <input required name="lastName" defaultValue={user.lastName} />
          </label>
          <label>
            Telefone
            <input name="phone" defaultValue={user.phone ?? ''} />
          </label>
          <label>
            NIF
            <input
              name="taxNumber"
              defaultValue={user.customerProfile?.taxNumber ?? ''}
            />
          </label>
          <label className="account-check">
            <input
              type="checkbox"
              name="marketingConsent"
              defaultChecked={user.customerProfile?.marketingConsent}
            />{' '}
            Aceito comunicações de marketing
          </label>
          <Feedback message={message} error={localError} />
          <button className="button button-primary">Guardar</button>
        </form>
      </AccountFrame>
    );
  }

  if (mode === 'addresses') {
    const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (
        await run(
          () =>
            accountApi.post('/v1/account/addresses', {
              ...data,
              isDefaultShipping: data.isDefaultShipping === 'on',
              isDefaultBilling: data.isDefaultBilling === 'on',
            }),
          'Morada adicionada.',
        )
      ) {
        event.currentTarget.reset();
        setAddresses(await accountApi.get('/v1/account/addresses'));
      }
    };
    return (
      <AccountFrame title="Moradas">
        <div className="address-list">
          {addresses.length ? (
            addresses.map((address) => (
              <article key={address.id}>
                <strong>{address.label}</strong>
                <p>
                  {address.line1}
                  <br />
                  {address.postalCode} {address.city}
                </p>
                <button
                  onClick={() =>
                    void run(
                      () =>
                        accountApi.delete(
                          `/v1/account/addresses/${address.id}`,
                        ),
                      'Morada eliminada.',
                    ).then(
                      async (ok) =>
                        ok &&
                        setAddresses(
                          await accountApi.get('/v1/account/addresses'),
                        ),
                    )
                  }
                >
                  Eliminar
                </button>
              </article>
            ))
          ) : (
            <p>Ainda não tem moradas guardadas.</p>
          )}
        </div>
        <form
          className="account-form two-columns"
          onSubmit={(event) => void submit(event)}
        >
          <label>
            Etiqueta
            <input required name="label" placeholder="Casa" />
          </label>
          <label>
            Nome
            <input required name="firstName" defaultValue={user.firstName} />
          </label>
          <label>
            Apelido
            <input required name="lastName" defaultValue={user.lastName} />
          </label>
          <label>
            Morada
            <input required name="line1" />
          </label>
          <label>
            Código postal
            <input required name="postalCode" pattern="\d{4}-\d{3}" />
          </label>
          <label>
            Cidade
            <input required name="city" />
          </label>
          <label>
            País
            <input name="countryCode" defaultValue="PT" maxLength={2} />
          </label>
          <label className="account-check">
            <input type="checkbox" name="isDefaultShipping" /> Entrega
            predefinida
          </label>
          <label className="account-check">
            <input type="checkbox" name="isDefaultBilling" /> Faturação
            predefinida
          </label>
          <Feedback message={message} error={localError} />
          <button className="button button-primary">Adicionar morada</button>
        </form>
      </AccountFrame>
    );
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (
      await run(
        () => accountApi.post('/v1/auth/change-password', data),
        'Password alterada. Inicie sessão novamente.',
      )
    ) {
      await auth.logout();
      router.push('/conta/entrar');
    }
  };
  return (
    <AccountFrame title="Segurança">
      <form
        className="account-form"
        onSubmit={(event) => void changePassword(event)}
      >
        <label>
          Password atual
          <input required type="password" name="currentPassword" />
        </label>
        <label>
          Nova password
          <input required type="password" name="newPassword" minLength={10} />
        </label>
        <button className="button button-primary">Alterar password</button>
      </form>
      <h2>Sessões ativas</h2>
      <div className="session-list">
        {sessions.map((session) => (
          <article key={session.id}>
            <span>{session.userAgent || 'Dispositivo desconhecido'}</span>
            <button
              onClick={() =>
                void run(
                  () =>
                    accountApi.post(`/v1/auth/sessions/${session.id}/revoke`),
                  'Sessão revogada.',
                ).then(async () =>
                  setSessions(await accountApi.get('/v1/auth/sessions')),
                )
              }
            >
              Revogar
            </button>
          </article>
        ))}
      </div>
      <button
        className="button button-outline-dark"
        onClick={() =>
          void accountApi
            .post('/v1/auth/logout-all')
            .then(() => router.push('/conta/entrar'))
        }
      >
        Terminar todas as sessões
      </button>
      <Feedback message={message} error={localError} />
    </AccountFrame>
  );
}

function AccountFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main id="conteudo" className="account-page">
      <header>
        <p className="eyebrow">Conta Nsabores</p>
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  );
}

function Feedback({ message, error }: { message: string; error: string }) {
  return (
    <>
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
    </>
  );
}
