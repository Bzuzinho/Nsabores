'use client';

import type { AuthUser, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { managementApi, useManagementAuth } from './management-auth';

type InternalRole = 'STAFF' | 'ADMIN';

type AdminUser = Omit<AuthUser, 'role'> & {
  role: InternalRole;
  lastLoginAt: string | null;
  updatedAt: string;
  stats?: { activeSessions: number };
};

const roleLabels: Record<InternalRole, string> = {
  STAFF: 'Equipa',
  ADMIN: 'Administrador',
};

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
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      if (selectedId) {
        setSelected(
          await managementApi.get<AdminUser>(`/v1/admin/users/${selectedId}`),
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

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const user = await managementApi.post<AdminUser>('/v1/admin/users', {
        email: String(data.get('email')),
        firstName: String(data.get('firstName')),
        lastName: String(data.get('lastName')),
        phone: String(data.get('phone') || '') || undefined,
        role: String(data.get('role')),
      });
      setShowCreate(false);
      setMessage(
        `Utilizador ${user.firstName} ${user.lastName} criado. Foi enviado um email para definir a password.`,
      );
      event.currentTarget.reset();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar o utilizador.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !isAdmin) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await managementApi.patch(`/v1/admin/users/${selected.id}`, {
        email: String(data.get('email')),
        firstName: String(data.get('firstName')),
        lastName: String(data.get('lastName')),
        phone: String(data.get('phone') || '') || null,
        role: String(data.get('role')),
        isActive: data.get('isActive') === 'on',
      });
      setMessage('Utilizador atualizado.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar o utilizador.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function action(path: string, success: string) {
    if (!isAdmin) return;
    setBusy(true);
    setError('');
    try {
      await managementApi.post(path);
      setMessage(success);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível concluir.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeUser() {
    if (!selected || !isAdmin) return;
    if (
      !window.confirm(
        `Apagar o acesso de ${selected.firstName} ${selected.lastName}? Esta ação não afeta clientes comerciais.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await managementApi.delete(`/v1/admin/users/${selected.id}`);
      router.replace('/administracao/utilizadores');
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível apagar o utilizador.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (selectedId) {
    if (!selected) {
      return <div className="admin-state">A carregar utilizador...</div>;
    }
    return (
      <>
        {message && <p className="admin-message">{message}</p>}
        <header className="admin-header">
          <div>
            <p className="eyebrow">Administração</p>
            <h1>
              {selected.firstName} {selected.lastName}
            </h1>
            <p>{selected.email}</p>
          </div>
          <Link href="/administracao/utilizadores">Voltar</Link>
        </header>
        {error && <p className="admin-error">{error}</p>}

        <div className="user-management-grid">
          <section className="admin-card">
            <div className="section-heading">
              <div>
                <h2>Conta de acesso</h2>
                <p>
                  Apenas utilizadores internos da Gestão: equipa e
                  administradores.
                </p>
              </div>
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
                Função
                <select
                  name="role"
                  disabled={!isAdmin}
                  defaultValue={selected.role}
                >
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
                Acesso ativo
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
            <h2>Segurança</h2>
            <dl>
              <div>
                <dt>Função</dt>
                <dd>{roleLabels[selected.role]}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{selected.isActive ? 'Ativo' : 'Inativo'}</dd>
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
                <dt>Sessões ativas</dt>
                <dd>{selected.stats?.activeSessions ?? 0}</dd>
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
                      'Email de redefinição de password enviado.',
                    )
                  }
                >
                  Redefinir password
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
                  Revogar sessões
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
            Acessos internos à Gestão. Clientes são geridos separadamente em
            Clientes.
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
              <h2>Novo acesso à Gestão</h2>
              <p>Crie apenas membros da equipa ou administradores.</p>
            </div>
          </div>
          <form
            className="admin-form"
            onSubmit={(event) => void createUser(event)}
          >
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
              Função
              <select name="role" defaultValue="STAFF">
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
          placeholder="Pesquisar nome, email ou telefone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">Todas as funções</option>
          <option value="STAFF">Equipa</option>
          <option value="ADMIN">Administradores</option>
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
                  <Link href={`/administracao/utilizadores/${user.id}`}>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                  </Link>
                  <small>{user.email}</small>
                </td>
                <td>{roleLabels[user.role]}</td>
                <td>{user.isActive ? 'Ativo' : 'Inativo'}</td>
                <td>
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString('pt-PT')
                    : 'Nunca'}
                </td>
                <td>
                  <Link href={`/administracao/utilizadores/${user.id}`}>Gerir</Link>
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
