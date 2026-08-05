'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi, useManagementAuth } from './management-auth';

type PriceList = { id: string; name: string; code: string; isActive: boolean };
type Application = {
  id: string;
  tradeName: string;
  legalName: string;
  taxNumber: string;
  contactName: string;
  email: string;
  phone: string;
  address: Record<string, unknown>;
  website: string | null;
  socialMedia: string | null;
  activity: string;
  estimatedVolume: string | null;
  message: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  internalReason: string | null;
  businessAccountId: string | null;
  createdAt: string;
};
type Membership = {
  id: string;
  role: 'OWNER' | 'BUYER' | 'VIEWER';
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive?: boolean;
  };
};
type BusinessAccount = {
  id: string;
  type: 'RESELLER' | 'B2B';
  tradeName: string;
  legalName: string;
  taxNumber: string;
  businessEmail: string;
  phone: string;
  billingAddress: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
  priceListId: string | null;
  priceList: PriceList | null;
  paymentTerms: 'IMMEDIATE' | 'BANK_TRANSFER' | 'NET_15' | 'NET_30' | 'NET_60';
  allowedPaymentMethods: string[];
  creditLimitCents: number | null;
  minimumOrderCents: number | null;
  requiresApproval: boolean;
  shippingCents: number | null;
  internalNotes: string | null;
  users: Membership[];
  orders?: Array<{
    id: string;
    number: string;
    status: string;
    totalCents: number;
    createdAt: string;
  }>;
};

export function BusinessAdmin({
  mode,
  accountId,
}: {
  mode: 'accounts' | 'applications' | 'detail';
  accountId?: string;
}) {
  if (mode === 'applications') return <ApplicationsAdmin />;
  if (mode === 'detail' && accountId)
    return <BusinessAccountDetail id={accountId} />;
  return <BusinessAccounts />;
}

function ApplicationsAdmin() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('PENDING');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [rows, prices] = await Promise.all([
        managementApi.get<Application[]>('/v1/admin/reseller-applications'),
        managementApi.get<PriceList[]>('/v1/admin/price-lists'),
      ]);
      setApplications(rows);
      setPriceLists(prices.filter((price) => price.isActive));
      setSelectedId((current) => current || rows[0]?.id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const selected = applications.find((item) => item.id === selectedId);
  const visible = applications.filter(
    (item) => !filter || item.status === filter,
  );

  async function decide(formElement: HTMLFormElement, approved: boolean) {
    if (!selected) return;
    const form = new FormData(formElement);
    setBusy(true);
    setError('');
    try {
      await managementApi.post(
        `/v1/admin/reseller-applications/${selected.id}/decision`,
        {
          approved,
          priceListId: approved ? form.get('priceListId') : undefined,
          paymentTerms: approved ? form.get('paymentTerms') : undefined,
          internalReason: form.get('internalReason') || undefined,
        },
      );
      setMessage(
        approved
          ? 'Candidatura aprovada. A conta será associada depois de o cliente registar e verificar o mesmo email.'
          : 'Candidatura rejeitada.',
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
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
          <p className="eyebrow">Clientes profissionais</p>
          <h1>Candidaturas B2B</h1>
          <p>Analise os dados, atribua condições e registe a decisão.</p>
        </div>
      </header>
      <div className="admin-filters">
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">Todos os estados</option>
          <option value="PENDING">Pendentes</option>
          <option value="APPROVED">Aprovadas</option>
          <option value="REJECTED">Rejeitadas</option>
        </select>
      </div>
      <div className="admin-grid operational-main-grid">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Atividade</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.tradeName}</strong>
                    <small>{item.taxNumber}</small>
                  </td>
                  <td>
                    {item.contactName}
                    <small>{item.email}</small>
                  </td>
                  <td>{item.activity}</td>
                  <td>{item.status}</td>
                  <td className="admin-table-action">
                    <button onClick={() => setSelectedId(item.id)}>
                      Analisar
                    </button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={5}>Não existem candidaturas neste estado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <form
            className="admin-card operational-form"
            key={selected.id}
            onSubmit={(event) => {
              event.preventDefault();
              void decide(event.currentTarget, true);
            }}
          >
            <div>
              <p className="eyebrow">{selected.status}</p>
              <h2>{selected.tradeName}</h2>
              <p>{selected.legalName}</p>
            </div>
            <dl className="operational-data-list">
              <div>
                <dt>NIF</dt>
                <dd>{selected.taxNumber}</dd>
              </div>
              <div>
                <dt>Contacto</dt>
                <dd>{selected.contactName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selected.email}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{selected.phone}</dd>
              </div>
              <div>
                <dt>Volume estimado</dt>
                <dd>{selected.estimatedVolume ?? '—'}</dd>
              </div>
            </dl>
            {selected.message && (
              <p className="operational-note">{selected.message}</p>
            )}
            {selected.status === 'PENDING' ? (
              <>
                <label>
                  Tabela de preços
                  <select name="priceListId" required>
                    <option value="">Selecionar</option>
                    {priceLists.map((price) => (
                      <option key={price.id} value={price.id}>
                        {price.name} · {price.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Condições de pagamento
                  <select name="paymentTerms" defaultValue="BANK_TRANSFER">
                    <option value="IMMEDIATE">Pagamento imediato</option>
                    <option value="BANK_TRANSFER">Transferência</option>
                    <option value="NET_15">15 dias</option>
                    <option value="NET_30">30 dias</option>
                    <option value="NET_60">60 dias</option>
                  </select>
                </label>
                <label>
                  Fundamentação interna
                  <textarea name="internalReason" />
                </label>
                <div className="admin-actions">
                  <button className="admin-primary" disabled={busy}>
                    Aprovar candidatura
                  </button>
                  <button
                    className="admin-secondary"
                    disabled={busy}
                    type="button"
                    onClick={(event) => {
                      const formElement = event.currentTarget.closest('form');
                      if (formElement) void decide(formElement, false);
                    }}
                  >
                    Rejeitar
                  </button>
                </div>
              </>
            ) : (
              <p>
                Decisão registada
                {selected.businessAccountId && (
                  <>
                    {' · '}
                    <Link href={`/revendedores/${selected.businessAccountId}`}>
                      Abrir conta empresarial
                    </Link>
                  </>
                )}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function BusinessAccounts() {
  const auth = useManagementAuth();
  const [accounts, setAccounts] = useState<BusinessAccount[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [rows, prices] = await Promise.all([
        managementApi.get<BusinessAccount[]>('/v1/admin/business-accounts'),
        managementApi.get<PriceList[]>('/v1/admin/price-lists'),
      ]);
      setAccounts(rows);
      setPriceLists(prices.filter((price) => price.isActive));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) return accounts;
    return accounts.filter((account) =>
      `${account.tradeName} ${account.legalName} ${account.taxNumber} ${account.businessEmail}`
        .toLocaleLowerCase('pt-PT')
        .includes(normalized),
    );
  }, [accounts, query]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await managementApi.post<BusinessAccount>(
        '/v1/admin/business-accounts',
        businessPayload(form),
      );
      window.location.assign(`/gestao/revendedores/${result.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
      setBusy(false);
    }
  }

  return (
    <section className="admin-page operational-stack">
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Clientes profissionais</p>
          <h1>Contas B2B e revendedores</h1>
          <p>Empresas, utilizadores, preços e condições comerciais.</p>
        </div>
        <Link className="admin-secondary" href="/revendedores/candidaturas">
          Ver candidaturas
        </Link>
      </header>
      <div className="admin-list-toolbar">
        <label>
          <span>Pesquisar</span>
          <input
            type="search"
            placeholder="Empresa, NIF ou email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <small>{visible.length} contas</small>
      </div>
      <div className="admin-grid operational-main-grid">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Tabela</th>
                <th>Utilizadores</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => (
                <tr key={account.id}>
                  <td>
                    <strong>{account.tradeName}</strong>
                    <small>{account.taxNumber}</small>
                  </td>
                  <td>{account.type}</td>
                  <td>{account.priceList?.name ?? '—'}</td>
                  <td>
                    {account.users.filter((user) => user.isActive).length}
                  </td>
                  <td>{account.status}</td>
                  <td className="admin-table-action">
                    <Link href={`/revendedores/${account.id}`}>Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {auth.user?.role === 'ADMIN' && (
          <BusinessForm
            title="Nova conta empresarial"
            priceLists={priceLists}
            busy={busy}
            onSubmit={create}
          />
        )}
      </div>
    </section>
  );
}

function BusinessAccountDetail({ id }: { id: string }) {
  const auth = useManagementAuth();
  const [account, setAccount] = useState<BusinessAccount>();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, prices] = await Promise.all([
        managementApi.get<BusinessAccount>(`/v1/admin/business-accounts/${id}`),
        managementApi.get<PriceList[]>('/v1/admin/price-lists'),
      ]);
      setAccount(detail);
      setPriceLists(prices);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await managementApi.patch(
        `/v1/admin/business-accounts/${id}`,
        businessPayload(new FormData(event.currentTarget)),
      );
      setMessage('Conta empresarial atualizada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function status(value: BusinessAccount['status']) {
    setBusy(true);
    setError('');
    try {
      await managementApi.patch(`/v1/admin/business-accounts/${id}/status`, {
        status: value,
      });
      setMessage(`Estado alterado para ${value}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await managementApi.post(`/v1/admin/business-accounts/${id}/users`, {
        email: form.get('email'),
        role: form.get('role'),
      });
      setMessage('Utilizador associado à empresa.');
      event.currentTarget.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(
    membershipId: string,
    body: { role?: Membership['role']; isActive?: boolean },
  ) {
    setBusy(true);
    setError('');
    try {
      await managementApi.patch(
        `/v1/admin/business-accounts/${id}/users/${membershipId}`,
        body,
      );
      setMessage('Permissões atualizadas.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(membershipId: string) {
    if (!confirm('Desativar este acesso empresarial?')) return;
    setBusy(true);
    setError('');
    try {
      await managementApi.delete(
        `/v1/admin/business-accounts/${id}/users/${membershipId}`,
      );
      setMessage('Acesso empresarial desativado.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  if (!account && !error)
    return <div className="admin-state">A carregar conta empresarial…</div>;
  if (!account) return <div className="admin-error">{error}</div>;
  const canEdit = auth.user?.role === 'ADMIN';

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">{account.type}</p>
          <h1>{account.tradeName}</h1>
          <p>
            {account.legalName} · {account.status}
          </p>
        </div>
        <div className="admin-actions">
          <Link className="admin-secondary" href="/revendedores">
            Voltar
          </Link>
          {canEdit && account.status !== 'APPROVED' && (
            <button
              className="admin-primary"
              disabled={busy}
              onClick={() => void status('APPROVED')}
            >
              Aprovar/reativar
            </button>
          )}
          {canEdit && account.status === 'APPROVED' && (
            <button
              className="admin-secondary"
              disabled={busy}
              onClick={() => void status('SUSPENDED')}
            >
              Suspender
            </button>
          )}
        </div>
      </header>

      <BusinessForm
        title="Dados e condições comerciais"
        account={account}
        priceLists={priceLists}
        busy={busy}
        disabled={!canEdit}
        onSubmit={save}
      />

      <section className="admin-card operational-form">
        <div>
          <p className="eyebrow">Acessos</p>
          <h2>Utilizadores da empresa</h2>
        </div>
        <div className="operational-member-list">
          {account.users.map((membership) => (
            <article key={membership.id}>
              <span>
                <strong>
                  {membership.user.firstName} {membership.user.lastName}
                </strong>
                <small>
                  {membership.user.email} ·{' '}
                  {membership.isActive ? 'Ativo' : 'Inativo'}
                </small>
              </span>
              <select
                aria-label={`Função de ${membership.user.email}`}
                disabled={!canEdit || busy}
                value={membership.role}
                onChange={(event) =>
                  void updateMember(membership.id, {
                    role: event.target.value as Membership['role'],
                  })
                }
              >
                <option value="OWNER">Proprietário</option>
                <option value="BUYER">Comprador</option>
                <option value="VIEWER">Consulta</option>
              </select>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeMember(membership.id)}
                >
                  Desativar
                </button>
              )}
            </article>
          ))}
        </div>
        {canEdit && (
          <form className="operational-inline-form" onSubmit={addMember}>
            <label>
              Email de uma conta já registada
              <input name="email" type="email" required />
            </label>
            <label>
              Função
              <select
                name="role"
                defaultValue={
                  account.users.some((user) => user.isActive)
                    ? 'BUYER'
                    : 'OWNER'
                }
              >
                <option value="OWNER">Proprietário</option>
                <option value="BUYER">Comprador</option>
                <option value="VIEWER">Consulta</option>
              </select>
            </label>
            <button className="admin-primary" disabled={busy}>
              Associar utilizador
            </button>
          </form>
        )}
      </section>

      {account.orders && account.orders.length > 0 && (
        <section className="admin-card">
          <h2>Encomendas profissionais</h2>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Data</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {account.orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.number}</td>
                    <td>{order.status}</td>
                    <td>{euros(order.totalCents)}</td>
                    <td>
                      {new Date(order.createdAt).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="admin-table-action">
                      <Link href={`/encomendas/${order.id}`}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

function BusinessForm({
  title,
  account,
  priceLists,
  busy,
  disabled = false,
  onSubmit,
}: {
  title: string;
  account?: BusinessAccount;
  priceLists: PriceList[];
  busy: boolean;
  disabled?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const address = account?.billingAddress ?? {};
  return (
    <form className="admin-form admin-card" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <label>
        Tipo
        <select
          name="type"
          defaultValue={account?.type ?? 'B2B'}
          disabled={disabled}
        >
          <option value="B2B">Cliente B2B</option>
          <option value="RESELLER">Revendedor</option>
        </select>
      </label>
      <label>
        Designação comercial
        <input
          name="tradeName"
          required
          defaultValue={account?.tradeName}
          disabled={disabled}
        />
      </label>
      <label>
        Denominação legal
        <input
          name="legalName"
          required
          defaultValue={account?.legalName}
          disabled={disabled}
        />
      </label>
      <label>
        NIF
        <input
          name="taxNumber"
          required
          pattern="[0-9]{9}"
          defaultValue={account?.taxNumber}
          disabled={disabled}
        />
      </label>
      <label>
        Email empresarial
        <input
          name="businessEmail"
          type="email"
          required
          defaultValue={account?.businessEmail}
          disabled={disabled}
        />
      </label>
      <label>
        Telefone
        <input
          name="phone"
          required
          defaultValue={account?.phone}
          disabled={disabled}
        />
      </label>
      <label className="wide">
        Morada
        <input
          name="line1"
          required
          defaultValue={String(address.line1 ?? '')}
          disabled={disabled}
        />
      </label>
      <label>
        Código postal
        <input
          name="postalCode"
          required
          defaultValue={String(address.postalCode ?? '')}
          disabled={disabled}
        />
      </label>
      <label>
        Localidade
        <input
          name="city"
          required
          defaultValue={String(address.city ?? '')}
          disabled={disabled}
        />
      </label>
      <label>
        País
        <input
          name="countryCode"
          maxLength={2}
          defaultValue={String(address.countryCode ?? 'PT')}
          disabled={disabled}
        />
      </label>
      <label>
        Tabela de preços
        <select
          name="priceListId"
          defaultValue={account?.priceListId ?? ''}
          disabled={disabled}
        >
          <option value="">Sem tabela</option>
          {priceLists.map((price) => (
            <option key={price.id} value={price.id}>
              {price.name} · {price.code}
            </option>
          ))}
        </select>
      </label>
      <label>
        Condições de pagamento
        <select
          name="paymentTerms"
          defaultValue={account?.paymentTerms ?? 'BANK_TRANSFER'}
          disabled={disabled}
        >
          <option value="IMMEDIATE">Imediato</option>
          <option value="BANK_TRANSFER">Transferência</option>
          <option value="NET_15">15 dias</option>
          <option value="NET_30">30 dias</option>
          <option value="NET_60">60 dias</option>
        </select>
      </label>
      <label>
        Limite de crédito (€)
        <input
          min="0"
          name="creditLimit"
          step="0.01"
          type="number"
          defaultValue={centsToInput(account?.creditLimitCents)}
          disabled={disabled}
        />
      </label>
      <label>
        Encomenda mínima (€)
        <input
          min="0"
          name="minimumOrder"
          step="0.01"
          type="number"
          defaultValue={centsToInput(account?.minimumOrderCents)}
          disabled={disabled}
        />
      </label>
      <label>
        Portes fixos (€)
        <input
          min="0"
          name="shipping"
          step="0.01"
          type="number"
          defaultValue={centsToInput(account?.shippingCents)}
          disabled={disabled}
        />
      </label>
      <fieldset className="wide operational-fieldset" disabled={disabled}>
        <legend>Métodos permitidos</legend>
        {(
          [
            ['CARD', 'Cartão'],
            ['BANK_TRANSFER', 'Transferência'],
            ['PAY_ON_DELIVERY', 'Pagamento na entrega'],
          ] as const
        ).map(([value, label]) => (
          <label className="operational-check" key={value}>
            <input
              name="allowedPaymentMethods"
              type="checkbox"
              value={value}
              defaultChecked={
                account
                  ? account.allowedPaymentMethods.includes(value)
                  : value === 'BANK_TRANSFER'
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input
          name="requiresApproval"
          type="checkbox"
          defaultChecked={account?.requiresApproval}
          disabled={disabled}
        />
        Exige aprovação interna
      </label>
      <label className="wide">
        Notas internas
        <textarea
          name="internalNotes"
          defaultValue={account?.internalNotes ?? ''}
          disabled={disabled}
        />
      </label>
      {!disabled && (
        <button className="admin-primary" disabled={busy}>
          {busy ? 'A guardar…' : account ? 'Guardar conta' : 'Criar conta'}
        </button>
      )}
    </form>
  );
}

function businessPayload(form: FormData) {
  const cents = (name: string) => {
    const value = form.get(name);
    return value ? Math.round(Number(value) * 100) : null;
  };
  return {
    type: form.get('type'),
    tradeName: form.get('tradeName'),
    legalName: form.get('legalName'),
    taxNumber: form.get('taxNumber'),
    businessEmail: form.get('businessEmail'),
    phone: form.get('phone'),
    billingAddress: {
      line1: form.get('line1'),
      postalCode: form.get('postalCode'),
      city: form.get('city'),
      countryCode: String(form.get('countryCode') || 'PT').toUpperCase(),
    },
    priceListId: form.get('priceListId') || null,
    paymentTerms: form.get('paymentTerms'),
    allowedPaymentMethods: form.getAll('allowedPaymentMethods'),
    creditLimitCents: cents('creditLimit'),
    minimumOrderCents: cents('minimumOrder'),
    shippingCents: cents('shipping'),
    requiresApproval: form.get('requiresApproval') === 'on',
    internalNotes: form.get('internalNotes') || null,
  };
}

function centsToInput(value?: number | null) {
  return value === null || value === undefined ? '' : String(value / 100);
}

function euros(value: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}
