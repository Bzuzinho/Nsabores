'use client';

import type { AuthUser, Paginated, UserRole } from '@nsabores/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { managementApi, useManagementAuth } from './management-auth';

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

type AdminUser = AuthUser & {
  lastLoginAt: string | null;
  updatedAt: string;
  customerProfile?: {
    taxNumber?: string | null;
    marketingConsent?: boolean;
    marketingConsentAt?: string | null;
    notes?: string | null;
  } | null;
  addresses?: Address[];
  authSessions?: Array<{
    id: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    createdAt: string;
    expiresAt: string;
  }>;
  businessMemberships?: Array<{
    id: string;
    role: string;
    businessAccount: {
      id: string;
      type: string;
      tradeName: string;
      status: string;
    };
  }>;
  stats?: {
    orders: number;
    orderValueCents: number;
    addresses: number;
    activeSessions: number;
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
  newsletter?: {
    isActive: boolean;
    consentedAt: string;
  } | null;
};

const roleLabels: Record<UserRole, string> = {
  CUSTOMER: 'Cliente',
  STAFF: 'Equipa',
  ADMIN: 'Administrador',
};

function euro(cents = 0) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function UsersAdmin({ selectedId }: { selectedId?: string }) {
  const auth = useManagementAuth();
  const router = useRouter();
  const isAdmin = auth.user?.role === 'ADMIN';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
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
          await managementApi.get<AdminUser>(
            `/v1/admin/users/${selectedId}`,
          ),
        );
        return;
      }
      const query = new URLSearchParams({ limit: '100' });
      if (search.trim()) query.set('search', search.trim());
      if (role) query.set('role', role);
      if (active) query.set('active', active);
      const result = await managementApi.get<Paginated<AdminUser>>(
        `/v1/admin/users?${query.toString()}`,
      );
      setUsers(result.data);
      setTotal(result.pagination.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar.');
    }
  }, [active, role, search, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), selectedId ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [load, selectedId]);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const user = await managementApi.post<AdminUser>('/v1/admin/users', {
        email: String(data.get('email')),
        firstName: String(data.get('firstName')),
        lastName: String(data.get('lastName')),
        phone: String(data.get('phone') || '') || undefined,
        taxNumber: String(data.get('taxNumber') || '') || undefined,
        role: String(data.get('role')),
      });
      setShowCreate(false);
      setMessage(
        `Conta de ${user.firstName} ${user.lastName} criada. Foi enviado um convite para definir a password.`,
      );
      event.currentTarget.reset();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar a conta.',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !isAdmin) return;
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      await managementApi.patch(`/v1/admin/users/${selected.id}`, {
        email: String(data.get('email')),
        firstName: String(data.get('firstName')),
        lastName: String(data.get('lastName')),
        phone: String(data.get('phone') || '') || null,
        taxNumber: String(data.get('taxNumber') || '') || null,
        role: String(data.get('role')),
        isActive: data.get('isActive') === 'on',
        marketingConsent: data.get('marketingConsent') === 'on',
        notes: String(data.get('notes') || '') || null,
      });
      setMessage('Utilizador atualizado.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar.',
      );
    } finally {
      setBusy(false);
    }
  };

  const action = async (
    path: string,
    success: string,
    body?: Record<string, never>,
  ) => {
    if (!isAdmin) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await managementApi.post(path, body);
      setMessage(success);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível concluir.',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async () => {
    if (!selected || !isAdmin) return;
    const confirmed = window.confirm(
      `Apagar a conta de ${selected.firstName} ${selected.lastName}?\n\nOs dados pessoais da conta serão removidos. O histórico comercial necessário será preservado de forma anonimizada.`,
    );
    if (!confirmed) return;
    const second = window.confirm(
      'Esta ação não pode ser anulada. Confirmar eliminação?',
    );
    if (!second) return;

    setBusy(true);
    setError('');
    try {
      await managementApi.delete(`/v1/admin/users/${selected.id}`);
      router.replace('/utilizadores');
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível apagar a conta.',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveAddress = async (
    event: FormEvent<HTMLFormElement>,
    address?: Address,
  ) => {
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
          `/v1/admin/users/${selected.id}/addresses/${address.id}`,
          body,
        );
      } else {
        await managementApi.post(
          `/v1/admin/users/${selected.id}/addresses`,
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
  };

  const deleteAddress = async (address: Address) => {
    if (!selected || !isAdmin) return;
    if (!window.confirm(`Apagar a morada "${address.label}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await managementApi.delete(
        `/v1/admin/users/${selected.id}/addresses/${address.id}`,
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
  };

  if (selectedId) {
    if (!selected) {
      return <div className="admin-state">A carregar utilizador...</div>;
    }

    return (
      <>
        {message && <p className="admin-message">{message}</p>}
        <header className="admin-header">
          <div>
            <p className="eyebrow">Utilizador</p>
            <h1>
              {selected.firstName} {selected.lastName}
            </h1>
            <p>{selected.email}</p>
          </div>
          <Link href="/utilizadores">Voltar</Link>
        </header>

        {error && <p className="admin-error">{error}</p>}

        <section className="metric-grid user-metrics">
          <article>
            <span>Encomendas</span>
            <strong>{selected.stats?.orders ?? 0}</strong>
          </article>
          <article>
            <span>Valor acumulado</span>
            <strong>{euro(selected.stats?.orderValueCents)}</strong>
          </article>
          <article>
            <span>Moradas</span>
            <strong>{selected.stats?.addresses ?? 0}</strong>
          </article>
          <article>
            <span>Sessões ativas</span>
            <strong>{selected.stats?.activeSessions ?? 0}</strong>
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
                <h2>Dados da conta</h2>
                <p>
                  Informação pessoal, função, estado e dados comerciais do
                  cliente.
                </p>
              </div>
              {!isAdmin && <span className="status-pill">Só leitura</span>}
            </div>

            <form
              className="admin-form"
              key={selected.id}
              onSubmit={(event) => void saveUser(event)}
            >
              <label>
                Nome
                <input
                  name="firstName"
                  required
                  disabled={!isAdmin}
                  defaultValue={selected.firstName}
                />
              </label>
              <label>
                Apelido
                <input
                  name="lastName"
                  required
                  disabled={!isAdmin}
                  defaultValue={selected.lastName}
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
              <label>
                NIF
                <input
                  name="taxNumber"
                  inputMode="numeric"
                  pattern="\d{9}"
                  disabled={!isAdmin}
                  defaultValue={selected.customerProfile?.taxNumber ?? ''}
                />
              </label>
              <label>
                Função
                <select
                  name="role"
                  disabled={!isAdmin}
                  defaultValue={selected.role}
                >
                  <option value="CUSTOMER">Cliente</option>
                  <option value="STAFF">Equipa</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <label className="check">
                <input
                  name="isActive"
                  type="checkbox"
                  disabled={!isAdmin}
                  defaultChecked={selected.isActive}
                />
                Conta ativa
              </label>
              <label className="check">
                <input
                  name="marketingConsent"
                  type="checkbox"
                  disabled={!isAdmin}
                  defaultChecked={
                    selected.customerProfile?.marketingConsent ?? false
                  }
                />
                Consentimento de marketing
              </label>
              <label className="wide">
                Notas internas
                <textarea
                  name="notes"
                  disabled={!isAdmin}
                  defaultValue={selected.customerProfile?.notes ?? ''}
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
            <h2>Conta e segurança</h2>
            <dl>
              <div>
                <dt>Estado</dt>
                <dd>{selected.isActive ? 'Ativa' : 'Inativa'}</dd>
              </div>
              <div>
                <dt>Função</dt>
                <dd>{roleLabels[selected.role]}</dd>
              </div>
              <div>
                <dt>Criada</dt>
                <dd>
                  {new Date(selected.createdAt).toLocaleDateString('pt-PT')}
                </dd>
              </div>
              <div>
                <dt>Último acesso</dt>
                <dd>
                  {selected.lastLoginAt
                    ? new Date(selected.lastLoginAt).toLocaleString('pt-PT')
                    : 'Nunca'}
                </dd>
              </div>
              <div>
                <dt>Email verificado</dt>
                <dd>{selected.emailVerifiedAt ? 'Sim' : 'Não'}</dd>
              </div>
              <div>
                <dt>Newsletter</dt>
                <dd>
                  {selected.newsletter?.isActive ? 'Ativa' : 'Não subscrito'}
                </dd>
              </div>
            </dl>
            {isAdmin && (
              <div className="user-security-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      `/v1/admin/users/${selected.id}/password-reset`,
                      'Foi enviado um email para definir uma nova password.',
                    )
                  }
                >
                  Enviar redefinição de password
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      `/v1/admin/users/${selected.id}/revoke-sessions`,
                      'Todas as sessões foram revogadas.',
                    )
                  }
                >
                  Revogar todas as sessões
                </button>
                <button
                  type="button"
                  className="admin-danger"
                  disabled={busy}
                  onClick={() => void removeUser()}
                >
                  Apagar utilizador
                </button>
              </div>
            )}
          </aside>
        </div>

        <section className="admin-card user-section">
          <div className="section-heading">
            <div>
              <h2>Moradas</h2>
              <p>Moradas de entrega e faturação associadas à conta.</p>
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
              address={
                editingAddress === 'new' ? undefined : editingAddress
              }
              busy={busy}
              onCancel={() => setEditingAddress(null)}
              onSave={saveAddress}
            />
          )}

          {!selected.addresses?.length ? (
            <p className="admin-empty">Este utilizador não tem moradas.</p>
          ) : (
            <div className="address-grid">
              {selected.addresses.map((address) => (
                <article key={address.id} className="address-card">
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
                    {address.phone && <p>{address.phone}</p>}
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
              <h2>Histórico recente</h2>
              <p>Últimas encomendas associadas a esta conta.</p>
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
          <p className="eyebrow">Administração</p>
          <h1>Utilizadores</h1>
          <p>
            Clientes, equipa e administradores. {total} conta
            {total === 1 ? '' : 's'}.
          </p>
        </div>
        {isAdmin && (
          <button
            className="admin-primary"
            type="button"
            onClick={() => setShowCreate((value) => !value)}
          >
            {showCreate ? 'Fechar' : '+ Novo utilizador'}
          </button>
        )}
      </header>

      {error && <p className="admin-error">{error}</p>}

      {showCreate && isAdmin && (
        <section className="admin-card user-create-card">
          <div className="section-heading">
            <div>
              <h2>Criar utilizador</h2>
              <p>
                A conta é criada de imediato e recebe um email para definir a
                password.
              </p>
            </div>
          </div>
          <form
            className="admin-form"
            onSubmit={(event) => void createUser(event)}
          >
            <label>
              Nome
              <input name="firstName" required maxLength={100} />
            </label>
            <label>
              Apelido
              <input name="lastName" required maxLength={100} />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Telefone
              <input name="phone" maxLength={30} />
            </label>
            <label>
              NIF
              <input name="taxNumber" inputMode="numeric" pattern="\d{9}" />
            </label>
            <label>
              Tipo de conta
              <select name="role" defaultValue="CUSTOMER">
                <option value="CUSTOMER">Cliente</option>
                <option value="STAFF">Equipa</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <div className="wide admin-actions">
              <button className="admin-primary" disabled={busy}>
                {busy ? 'A criar…' : 'Criar e enviar convite'}
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
          aria-label="Pesquisar utilizadores"
          placeholder="Pesquisar nome, email ou telefone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filtrar por função"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="">Todas as funções</option>
          <option value="CUSTOMER">Clientes</option>
          <option value="STAFF">Equipa</option>
          <option value="ADMIN">Administradores</option>
        </select>
        <select
          aria-label="Filtrar por estado"
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
              <th>Utilizador</th>
              <th>Função</th>
              <th>Estado</th>
              <th>Último acesso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link href={`/utilizadores/${user.id}`}>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                  </Link>
                  <small>{user.email}</small>
                </td>
                <td>{roleLabels[user.role]}</td>
                <td>
                  <span
                    className={
                      user.isActive
                        ? 'status-pill status-pill-success'
                        : 'status-pill'
                    }
                  >
                    {user.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString('pt-PT')
                    : 'Nunca'}
                </td>
                <td>
                  <Link href={`/utilizadores/${user.id}`}>Gerir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!users.length && (
        <div className="admin-state">Nenhum utilizador encontrado.</div>
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
          placeholder="0000-000"
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
          {busy ? 'A guardar…' : address ? 'Guardar morada' : 'Adicionar morada'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
