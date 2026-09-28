'use client';

import type { Paginated } from '@nsabores/types';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerProfile?: {
    taxNumber: string | null;
    marketingConsent: boolean;
    notes: string | null;
  } | null;
  addresses?: Array<{
    id: string;
    label: string;
    line1: string;
    postalCode: string;
    city: string;
    isDefaultShipping: boolean;
    isDefaultBilling: boolean;
  }>;
  orders?: Array<{
    id: string;
    number: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    createdAt: string;
  }>;
};

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);

export function CustomersAdmin({ selectedId }: { selectedId?: string }) {
  return selectedId ? (
    <CustomerDetail id={selectedId} />
  ) : (
    <CustomerIndex />
  );
}

function CustomerIndex() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await managementApi.get<Paginated<Customer>>(
        `/v1/admin/customers?limit=100&search=${encodeURIComponent(search)}`,
      );
      setCustomers(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar clientes.');
    }
  }, [search]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await managementApi.post<Customer>('/v1/admin/customers', {
        email: form.get('email'),
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        phone: String(form.get('phone') ?? '') || undefined,
        taxNumber: String(form.get('taxNumber') ?? '') || undefined,
        notes: String(form.get('notes') ?? '') || undefined,
      });
      setMessage(
        'Cliente criado. O acesso à conta é concluído através do email de definição de password.',
      );
      event.currentTarget.reset();
      await load();
      window.location.assign(`/gestao/clientes/${created.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o cliente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1>Clientes particulares</h1>
          <p>Contas, contactos e ligação às encomendas registadas pela equipa.</p>
        </div>
      </header>

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
        <small>{customers.length} cliente(s) visíveis</small>
      </div>

      <div className="admin-grid operational-main-grid">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>NIF</th>
                <th>Estado</th>
                <th />
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
                  <td className="admin-table-action">
                    <Link href={`/clientes/${customer.id}`}>Abrir</Link>
                  </td>
                </tr>
              ))}
              {!customers.length && (
                <tr>
                  <td colSpan={5}>Ainda não existem clientes neste resultado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form className="admin-card operational-form" onSubmit={create}>
          <div>
            <p className="eyebrow">Novo cliente</p>
            <h2>Criar conta de cliente</h2>
          </div>
          <label>
            Nome
            <input name="firstName" required />
          </label>
          <label>
            Apelido
            <input name="lastName" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Telefone
            <input name="phone" />
          </label>
          <label>
            NIF
            <input name="taxNumber" pattern="\d{9}" />
          </label>
          <label>
            Notas internas
            <textarea name="notes" />
          </label>
          <button className="admin-primary" disabled={busy}>
            {busy ? 'A criar…' : 'Criar cliente'}
          </button>
        </form>
      </div>
    </section>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const [customer, setCustomer] = useState<Customer>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setCustomer(await managementApi.get<Customer>(`/v1/admin/customers/${id}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar cliente.');
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await managementApi.patch(`/v1/admin/customers/${id}`, {
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        phone: String(form.get('phone') ?? '') || undefined,
        taxNumber: String(form.get('taxNumber') ?? '') || undefined,
        notes: String(form.get('notes') ?? '') || undefined,
        isActive: form.get('isActive') === 'on',
      });
      setMessage('Cliente atualizado.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o cliente.');
    } finally {
      setBusy(false);
    }
  }

  if (!customer && !error)
    return <div className="admin-state">A carregar cliente…</div>;
  if (!customer) return <div className="admin-error">{error}</div>;

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Cliente particular</p>
          <h1>
            {customer.firstName} {customer.lastName}
          </h1>
          <p>{customer.email}</p>
        </div>
        <div className="admin-actions">
          <Link className="admin-secondary" href="/clientes">
            Voltar
          </Link>
          <Link
            className="admin-primary"
            href={`/encomendas/nova?customer=${customer.id}`}
          >
            Nova encomenda
          </Link>
        </div>
      </header>

      <form className="admin-form admin-card" onSubmit={save}>
        <label>
          Nome
          <input name="firstName" required defaultValue={customer.firstName} />
        </label>
        <label>
          Apelido
          <input name="lastName" required defaultValue={customer.lastName} />
        </label>
        <label>
          Email
          <input value={customer.email} disabled />
        </label>
        <label>
          Telefone
          <input name="phone" defaultValue={customer.phone ?? ''} />
        </label>
        <label>
          NIF
          <input
            name="taxNumber"
            pattern="\d{9}"
            defaultValue={customer.customerProfile?.taxNumber ?? ''}
          />
        </label>
        <label className="wide">
          Notas internas
          <textarea
            name="notes"
            defaultValue={customer.customerProfile?.notes ?? ''}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={customer.isActive}
          />
          Conta ativa
        </label>
        <button className="admin-primary" disabled={busy}>
          {busy ? 'A guardar…' : 'Guardar cliente'}
        </button>
      </form>

      <section className="admin-card">
        <h2>Moradas</h2>
        {customer.addresses?.length ? (
          customer.addresses.map((address) => (
            <p key={address.id}>
              <strong>{address.label}</strong> — {address.line1},{' '}
              {address.postalCode} {address.city}
            </p>
          ))
        ) : (
          <p>Sem moradas guardadas.</p>
        )}
      </section>

      <section className="admin-card">
        <h2>Encomendas</h2>
        {customer.orders?.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Estado</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                  <th>Data</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.number}</td>
                    <td>{order.status}</td>
                    <td>{order.paymentStatus}</td>
                    <td>{money(order.totalCents)}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString('pt-PT')}</td>
                    <td className="admin-table-action">
                      <Link href={`/encomendas/${order.id}`}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Ainda não existem encomendas associadas a este cliente.</p>
        )}
      </section>
    </section>
  );
}
