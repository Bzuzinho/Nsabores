'use client';

import type { Paginated } from '@nsabores/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi, useManagementAuth } from './management-auth';

type CustomerType = 'INDIVIDUAL' | 'COMPANY';

type Address = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  taxNumber?: string | null;
  line1: string;
  line2?: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone?: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

type Customer = {
  id: string;
  userId?: string | null;
  type: CustomerType;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  taxNumber?: string | null;
  marketingConsent: boolean;
  marketingConsentAt?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    isActive: boolean;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
  } | null;
  _count?: { orders: number; addresses: number };
  addresses?: Address[];
  stats?: {
    orders: number;
    orderValueCents: number;
    addresses: number;
    supportCases: number;
  };
  recentOrders?: Array<{
    id: string;
    number: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    createdAt: string;
  }>;
  newsletter?: { isActive: boolean; consentedAt: string } | null;
};

function euro(cents = 0) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function CustomersAdmin({ selectedId }: { selectedId?: string }) {
  const auth = useManagementAuth();
  const router = useRouter();
  const isAdmin = auth.user?.role === 'ADMIN';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [active, setActive] = useState('');
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | 'new' | null>(
    null,
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      if (selectedId) {
        setSelected(
          await managementApi.get<Customer>(
            `/v1/admin/customers/${selectedId}`,
          ),
        );
        return;
      }
      const query = new URLSearchParams({ limit: '100' });
      if (search.trim()) query.set('search', search.trim());
      if (type) query.set('type', type);
      if (active) query.set('active', active);
      const result = await managementApi.get<Paginated<Customer>>(
        `/v1/admin/customers?${query.toString()}`,
      );
      setCustomers(result.data);
      setTotal(result.pagination.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar.');
    }
  }, [active, search, selectedId, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), selectedId ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [load, selectedId]);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const customer = await managementApi.post<Customer>(
        '/v1/admin/customers',
        {
          type: String(data.get('type')),
          name: String(data.get('name')),
          email: String(data.get('email')),
          phone: String(data.get('phone') || '') || undefined,
          company: String(data.get('company') || '') || undefined,
          taxNumber: String(data.get('taxNumber') || '') || undefined,
          marketingConsent: data.get('marketingConsent') === 'on',
          notes: String(data.get('notes') || '') || undefined,
        },
      );
      setShowCreate(false);
      setMessage(`Cliente ${customer.name} criado.`);
      event.currentTarget.reset();
      await load();
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

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !isAdmin) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await managementApi.patch(`/v1/admin/customers/${selected.id}`, {
        type: String(data.get('type')),
        name: String(data.get('name')),
        email: String(data.get('email')),
        phone: String(data.get('phone') || '') || null,
        company: String(data.get('company') || '') || null,
        taxNumber: String(data.get('taxNumber') || '') || null,
        marketingConsent: data.get('marketingConsent') === 'on',
        notes: String(data.get('notes') || '') || null,
        isActive: data.get('isActive') === 'on',
      });
      setMessage('Cliente atualizado.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar o cliente.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomer() {
    if (!selected || !isAdmin) return;
    if (
      !window.confirm(
        `Apagar o cliente ${selected.name}? O histórico comercial será preservado de forma anonimizada e qualquer conta do website continuará a existir separadamente.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await managementApi.delete(`/v1/admin/customers/${selected.id}`);
      router.replace('/clientes');
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível apagar o cliente.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress(
    event: FormEvent<HTMLFormElement>,
    address?: Address,
  ) {
    event.preventDefault();
    if (!selected || !isAdmin) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const body = {
      label: String(data.get('label')),
      firstName: String(data.get('firstName')),
      lastName: String(data.get('lastName')),
      company: String(data.get('company') || '') || undefined,
      taxNumber: String(data.get('taxNumber') || '') || undefined,
      line1: String(data.get('line1')),
      line2: String(data.get('line2') || '') || undefined,
      postalCode: String(data.get('postalCode')),
      city: String(data.get('city')),
      countryCode: String(data.get('countryCode') || 'PT'),
      phone: String(data.get('phone') || '') || undefined,
      isDefaultShipping: data.get('isDefaultShipping') === 'on',
      isDefaultBilling: data.get('isDefaultBilling') === 'on',
    };
    try {
      if (address) {
        await managementApi.patch(
          `/v1/admin/customers/${selected.id}/addresses/${address.id}`,
          body,
        );
      } else {
        await managementApi.post(
          `/v1/admin/customers/${selected.id}/addresses`,
          body,
        );
      }
      setEditingAddress(null);
      setMessage(address ? 'Morada atualizada.' : 'Morada adicionada.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível guardar a morada.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(address: Address) {
    if (!selected || !isAdmin) return;
    if (!window.confirm(`Apagar a morada "${address.label}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await managementApi.delete(
        `/v1/admin/customers/${selected.id}/addresses/${address.id}`,
      );
      setEditingAddress(null);
      setMessage('Morada apagada.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível apagar a morada.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (selectedId) {
    if (!selected)
      return <div className="admin-state">A carregar cliente...</div>;

    return (
      <>
        {message && <p className="admin-message">{message}</p>}
        <header className="admin-header">
          <div>
            <p className="eyebrow">Clientes</p>
            <h1>{selected.name}</h1>
            <p>{selected.email}</p>
          </div>
          <Link href="/clientes">Voltar</Link>
        </header>
        {error && <p className="admin-error">{error}</p>}

        <section className="metric-grid user-metrics">
          <article>
            <span>Encomendas</span>
            <strong>{selected.stats?.orders ?? 0}</strong>
          </article>
          <article>
            <span>Valor comprado</span>
            <strong>{euro(selected.stats?.orderValueCents)}</strong>
          </article>
          <article>
            <span>Moradas</span>
            <strong>{selected.stats?.addresses ?? 0}</strong>
          </article>
          <article>
            <span>Apoio</span>
            <strong>{selected.stats?.supportCases ?? 0}</strong>
          </article>
        </section>

        <div className="user-management-grid">
          <section className="admin-card">
            <div className="section-heading">
              <div>
                <h2>Ficha comercial</h2>
                <p>
                  Dados do cliente, independentes de qualquer conta de acesso.
                </p>
              </div>
              {!isAdmin && <span className="status-pill">Só leitura</span>}
            </div>
            <form
              className="admin-form"
              key={selected.id}
              onSubmit={(event) => void saveCustomer(event)}
            >
              <label>
                Tipo
                <select
                  name="type"
                  disabled={!isAdmin}
                  defaultValue={selected.type}
                >
                  <option value="INDIVIDUAL">Particular</option>
                  <option value="COMPANY">Empresa</option>
                </select>
              </label>
              <label>
                Nome / designação
                <input
                  name="name"
                  required
                  disabled={!isAdmin}
                  defaultValue={selected.name}
                />
              </label>
              <label>
                Empresa
                <input
                  name="company"
                  disabled={!isAdmin}
                  defaultValue={selected.company ?? ''}
                />
              </label>
              <label>
                NIF
                <input
                  name="taxNumber"
                  inputMode="numeric"
                  pattern="\d{9}"
                  disabled={!isAdmin}
                  defaultValue={selected.taxNumber ?? ''}
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  disabled={!isAdmin}
                  defaultValue={selected.email}
                />
              </label>
              <label>
                Telefone
                <input
                  name="phone"
                  disabled={!isAdmin}
                  defaultValue={selected.phone ?? ''}
                />
              </label>
              <label className="check">
                <input
                  name="isActive"
                  type="checkbox"
                  disabled={!isAdmin}
                  defaultChecked={selected.isActive}
                />
                Cliente ativo
              </label>
              <label className="check">
                <input
                  name="marketingConsent"
                  type="checkbox"
                  disabled={!isAdmin}
                  defaultChecked={selected.marketingConsent}
                />
                Consentimento de marketing
              </label>
              <label className="wide">
                Notas internas
                <textarea
                  name="notes"
                  disabled={!isAdmin}
                  defaultValue={selected.notes ?? ''}
                />
              </label>
              {isAdmin && (
                <div className="wide admin-actions">
                  <button className="admin-primary" disabled={busy}>
                    {busy ? 'A guardar…' : 'Guardar alterações'}
                  </button>
                </div>
              )}
            </form>
          </section>

          <aside className="admin-card user-account-summary">
            <h2>Acesso à área de cliente</h2>
            <dl>
              <div>
                <dt>Ligada</dt>
                <dd>{selected.user ? 'Sim' : 'Não'}</dd>
              </div>
              {selected.user && (
                <>
                  <div>
                    <dt>Email da conta</dt>
                    <dd>{selected.user.email}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{selected.user.isActive ? 'Ativa' : 'Inativa'}</dd>
                  </div>
                  <div>
                    <dt>Último acesso</dt>
                    <dd>
                      {selected.user.lastLoginAt
                        ? new Date(selected.user.lastLoginAt).toLocaleString(
                            'pt-PT',
                          )
                        : 'Nunca'}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>Newsletter</dt>
                <dd>{selected.newsletter?.isActive ? 'Ativa' : 'Inativa'}</dd>
              </div>
            </dl>
            <p className="admin-state">
              Este acesso serve apenas a área de cliente no website/aplicação.
              Nunca concede acesso à Gestão ou à Administração. A ficha de
              cliente existe independentemente das credenciais de acesso.
            </p>
            {isAdmin && (
              <button
                type="button"
                className="admin-danger"
                disabled={busy}
                onClick={() => void removeCustomer()}
              >
                Apagar cliente
              </button>
            )}
          </aside>
        </div>

        <section className="admin-card user-section">
          <div className="section-heading">
            <div>
              <h2>Moradas</h2>
              <p>Moradas comerciais de entrega e faturação.</p>
            </div>
            {isAdmin && (
              <button
                className="admin-primary"
                type="button"
                onClick={() => setEditingAddress('new')}
              >
                + Nova morada
              </button>
            )}
          </div>
          {editingAddress && isAdmin && (
            <AddressForm
              address={editingAddress === 'new' ? undefined : editingAddress}
              busy={busy}
              onCancel={() => setEditingAddress(null)}
              onSave={saveAddress}
            />
          )}
          {!selected.addresses?.length ? (
            <p className="admin-empty">Este cliente não tem moradas.</p>
          ) : (
            <div className="address-grid">
              {selected.addresses.map((address) => (
                <article className="address-card" key={address.id}>
                  <div>
                    <strong>{address.label}</strong>
                    <p>
                      {address.firstName} {address.lastName}
                    </p>
                    {address.company && <p>{address.company}</p>}
                    <p>{address.line1}</p>
                    {address.line2 && <p>{address.line2}</p>}
                    <p>
                      {address.postalCode} {address.city}
                    </p>
                  </div>
                  <div className="address-tags">
                    {address.isDefaultShipping && <span>Entrega</span>}
                    {address.isDefaultBilling && <span>Faturação</span>}
                  </div>
                  {isAdmin && (
                    <div className="admin-actions">
                      <button
                        type="button"
                        onClick={() => setEditingAddress(address)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="admin-danger-link"
                        onClick={() => void deleteAddress(address)}
                      >
                        Apagar
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card user-section">
          <div className="section-heading">
            <div>
              <h2>Encomendas</h2>
              <p>Histórico comercial associado ao cliente.</p>
            </div>
          </div>
          {!selected.recentOrders?.length ? (
            <p className="admin-empty">Ainda não existem encomendas.</p>
          ) : (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Encomenda</th>
                    <th>Data</th>
                    <th>Estado</th>
                    <th>Pagamento</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/encomendas/${order.id}`}>
                          {order.number}
                        </Link>
                      </td>
                      <td>
                        {new Date(order.createdAt).toLocaleDateString('pt-PT')}
                      </td>
                      <td>{order.status}</td>
                      <td>{order.paymentStatus}</td>
                      <td>{euro(order.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      {message && <p className="admin-message">{message}</p>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1>Clientes</h1>
          <p>
            Gestão completa das fichas de cliente. O acesso à área de cliente é
            opcional e separado dos utilizadores internos da Administração.{' '}
            {total} cliente{total === 1 ? '' : 's'}.
          </p>
        </div>
        {isAdmin && (
          <button
            className="admin-primary"
            type="button"
            onClick={() => setShowCreate((value) => !value)}
          >
            {showCreate ? 'Fechar' : '+ Novo cliente'}
          </button>
        )}
      </header>
      {error && <p className="admin-error">{error}</p>}

      {showCreate && isAdmin && (
        <section className="admin-card user-create-card">
          <div className="section-heading">
            <div>
              <h2>Novo cliente</h2>
              <p>O cliente não precisa de ter conta no website para existir.</p>
            </div>
          </div>
          <form
            className="admin-form"
            onSubmit={(event) => void createCustomer(event)}
          >
            <label>
              Tipo
              <select name="type" defaultValue="INDIVIDUAL">
                <option value="INDIVIDUAL">Particular</option>
                <option value="COMPANY">Empresa</option>
              </select>
            </label>
            <label>
              Nome / designação
              <input name="name" required />
            </label>
            <label>
              Empresa
              <input name="company" />
            </label>
            <label>
              NIF
              <input name="taxNumber" inputMode="numeric" pattern="\d{9}" />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Telefone
              <input name="phone" />
            </label>
            <label className="check">
              <input name="marketingConsent" type="checkbox" />
              Consentimento de marketing
            </label>
            <label className="wide">
              Notas internas
              <textarea name="notes" />
            </label>
            <div className="wide admin-actions">
              <button className="admin-primary" disabled={busy}>
                {busy ? 'A criar…' : 'Criar cliente'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="admin-filters user-filters">
        <input
          placeholder="Pesquisar nome, email, telefone, NIF ou empresa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="INDIVIDUAL">Particulares</option>
          <option value="COMPANY">Empresas</option>
        </select>
        <select
          value={active}
          onChange={(event) => setActive(event.target.value)}
        >
          <option value="">Todos os estados</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Acesso cliente</th>
              <th>Encomendas</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link href={`/clientes/${customer.id}`}>
                    <strong>{customer.name}</strong>
                  </Link>
                  <small>{customer.email}</small>
                </td>
                <td>
                  {customer.type === 'COMPANY' ? 'Empresa' : 'Particular'}
                </td>
                <td>{customer.user ? 'Ligada' : 'Sem conta'}</td>
                <td>{customer._count?.orders ?? 0}</td>
                <td>{customer.isActive ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <Link href={`/clientes/${customer.id}`}>Gerir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!customers.length && (
        <div className="admin-state">Nenhum cliente encontrado.</div>
      )}
    </>
  );
}

function AddressForm({
  address,
  busy,
  onCancel,
  onSave,
}: {
  address?: Address;
  busy: boolean;
  onCancel: () => void;
  onSave: (event: FormEvent<HTMLFormElement>, address?: Address) => void;
}) {
  const defaults = useMemo(
    () => ({
      label: address?.label ?? 'Principal',
      firstName: address?.firstName ?? '',
      lastName: address?.lastName ?? '',
      company: address?.company ?? '',
      taxNumber: address?.taxNumber ?? '',
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      postalCode: address?.postalCode ?? '',
      city: address?.city ?? '',
      countryCode: address?.countryCode ?? 'PT',
      phone: address?.phone ?? '',
      isDefaultShipping: address?.isDefaultShipping ?? false,
      isDefaultBilling: address?.isDefaultBilling ?? false,
    }),
    [address],
  );

  return (
    <form
      className="admin-form address-editor"
      onSubmit={(event) => onSave(event, address)}
    >
      <label>
        Nome da morada
        <input name="label" required defaultValue={defaults.label} />
      </label>
      <label>
        Empresa
        <input name="company" defaultValue={defaults.company} />
      </label>
      <label>
        Nome
        <input name="firstName" required defaultValue={defaults.firstName} />
      </label>
      <label>
        Apelido
        <input name="lastName" required defaultValue={defaults.lastName} />
      </label>
      <label>
        NIF
        <input
          name="taxNumber"
          inputMode="numeric"
          pattern="\d{9}"
          defaultValue={defaults.taxNumber}
        />
      </label>
      <label>
        Telefone
        <input name="phone" defaultValue={defaults.phone} />
      </label>
      <label className="wide">
        Morada
        <input name="line1" required defaultValue={defaults.line1} />
      </label>
      <label className="wide">
        Complemento
        <input name="line2" defaultValue={defaults.line2} />
      </label>
      <label>
        Código postal
        <input
          name="postalCode"
          required
          pattern="\d{4}-\d{3}"
          defaultValue={defaults.postalCode}
        />
      </label>
      <label>
        Localidade
        <input name="city" required defaultValue={defaults.city} />
      </label>
      <label>
        País
        <input
          name="countryCode"
          required
          maxLength={2}
          defaultValue={defaults.countryCode}
        />
      </label>
      <div />
      <label className="check">
        <input
          name="isDefaultShipping"
          type="checkbox"
          defaultChecked={defaults.isDefaultShipping}
        />
        Morada principal de entrega
      </label>
      <label className="check">
        <input
          name="isDefaultBilling"
          type="checkbox"
          defaultChecked={defaults.isDefaultBilling}
        />
        Morada principal de faturação
      </label>
      <div className="wide admin-actions">
        <button className="admin-primary" disabled={busy}>
          {busy
            ? 'A guardar…'
            : address
              ? 'Guardar morada'
              : 'Adicionar morada'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
