'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Paginated } from '@nsabores/types';
import { managementApi } from './management-auth';

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  customerProfile?: {
    taxNumber?: string | null;
    marketingConsent?: boolean;
  } | null;
};

export function CustomersAdmin() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (term: string) => {
    setError('');
    try {
      const result = await managementApi.get<Paginated<Customer>>(
        `/v1/admin/users?role=CUSTOMER&limit=100&search=${encodeURIComponent(term)}`,
      );
      setCustomers(result.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar os clientes.',
      );
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const customer = await managementApi.post<Customer>(
        '/v1/admin/users/customers',
        {
          email: String(data.get('email')),
          firstName: String(data.get('firstName')),
          lastName: String(data.get('lastName')),
          phone: String(data.get('phone') ?? '') || undefined,
          taxNumber: String(data.get('taxNumber') ?? '') || undefined,
        },
      );
      form.reset();
      setMessage(
        `Cliente ${customer.firstName} ${customer.lastName} criado. Foi enviado um link para definir a password.`,
      );
      await load('');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar o cliente.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page operational-stack">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1>Clientes particulares</h1>
          <p>
            Consulte contas existentes ou crie um cliente para encomendas
            recebidas por telefone, email ou presencialmente.
          </p>
        </div>
      </header>

      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-grid operational-main-grid">
        <section>
          <div className="admin-list-toolbar">
            <label>
              <span>Pesquisar</span>
              <input
                type="search"
                placeholder="Nome ou email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => void load(search)}>
              Pesquisar
            </button>
          </div>

          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>NIF</th>
                  <th>Estado</th>
                  <th>Criado</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>
                        {customer.firstName} {customer.lastName}
                      </strong>
                      <small>{customer.email}</small>
                    </td>
                    <td>{customer.phone || '—'}</td>
                    <td>{customer.customerProfile?.taxNumber || '—'}</td>
                    <td>{customer.isActive ? 'Ativo' : 'Inativo'}</td>
                    <td>
                      {new Date(customer.createdAt).toLocaleDateString('pt-PT')}
                    </td>
                  </tr>
                ))}
                {!customers.length && (
                  <tr>
                    <td colSpan={5}>Não existem clientes com estes critérios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <form className="admin-card operational-form" onSubmit={create}>
          <div>
            <p className="eyebrow">Nova conta</p>
            <h2>Criar cliente</h2>
            <p>
              O cliente recebe por email um link para definir a sua password.
            </p>
          </div>
          <label>
            Nome
            <input required name="firstName" maxLength={80} />
          </label>
          <label>
            Apelido
            <input required name="lastName" maxLength={80} />
          </label>
          <label>
            Email
            <input required name="email" type="email" />
          </label>
          <label>
            Telefone
            <input name="phone" maxLength={30} />
          </label>
          <label>
            NIF
            <input name="taxNumber" pattern="\\d{9}" />
          </label>
          <button className="admin-primary" disabled={busy}>
            {busy ? 'A criar…' : 'Criar cliente'}
          </button>
        </form>
      </div>
    </section>
  );
}
