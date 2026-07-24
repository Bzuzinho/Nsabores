'use client';

import type { AuthUser, Paginated, UserRole } from '@nsabores/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

interface AdminUser extends AuthUser {
  lastLoginAt: string | null;
  updatedAt: string;
}

export function UsersAdmin({ selectedId }: { selectedId?: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await managementApi.get<Paginated<AdminUser>>(
        `/v1/admin/users?limit=100&search=${encodeURIComponent(search)}`,
      );
      setUsers(result.data);
      if (selectedId) {
        setSelected(await managementApi.get(`/v1/admin/users/${selectedId}`));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar.');
    }
  }, [search, selectedId]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const update = async (data: { role?: UserRole; isActive?: boolean }) => {
    if (!selected) return;
    try {
      setSelected(
        await managementApi.patch(`/v1/admin/users/${selected.id}`, data),
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao atualizar.');
    }
  };

  if (selectedId) {
    if (!selected)
      return <div className="admin-state">A carregar utilizador...</div>;
    return (
      <>
        <header className="admin-header">
          <div>
            <h1>
              {selected.firstName} {selected.lastName}
            </h1>
            <p>{selected.email}</p>
          </div>
          <Link href="/utilizadores">Voltar</Link>
        </header>
        {error && <p className="admin-error">{error}</p>}
        <div className="user-detail">
          <label>
            Role
            <select
              value={selected.role}
              onChange={(event) =>
                void update({ role: event.target.value as UserRole })
              }
            >
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="STAFF">STAFF</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={selected.isActive}
              onChange={(event) =>
                void update({ isActive: event.target.checked })
              }
            />{' '}
            Conta ativa
          </label>
          <button
            onClick={() =>
              void managementApi.post(
                `/v1/admin/users/${selected.id}/revoke-sessions`,
              )
            }
          >
            Revogar todas as sessões
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Utilizadores</h1>
          <p>Contas de clientes e equipa.</p>
        </div>
      </header>
      <input
        className="user-search"
        aria-label="Pesquisar utilizadores"
        placeholder="Nome ou email"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utilizador</th>
              <th>Role</th>
              <th>Estado</th>
              <th>Último acesso</th>
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
                <td>{user.role}</td>
                <td>{user.isActive ? 'Ativo' : 'Inativo'}</td>
                <td>
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString('pt-PT')
                    : 'Nunca'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
