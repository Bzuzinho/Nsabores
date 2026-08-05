'use client';

import { useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Subscription = {
  id: string;
  email: string;
  source: string;
  isActive: boolean;
  consentedAt: string;
  createdAt: string;
};

export function NewsletterAdmin() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Subscription[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(
    (term = search) =>
      managementApi
        .get<Subscription[]>(
          `/v1/admin/newsletter?search=${encodeURIComponent(term)}`,
        )
        .then(setItems)
        .catch((reason: unknown) =>
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar as subscrições.',
          ),
        ),
    [search],
  );
  useEffect(() => {
    void load('');
  }, [load]);
  async function toggle(item: Subscription) {
    try {
      await managementApi.patch(`/v1/admin/newsletter/${item.id}`, {
        isActive: !item.isActive,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operação falhou.');
    }
  }
  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Newsletter</h1>
          <p>
            Consentimentos persistentes e contactos disponíveis para campanhas
            autorizadas.
          </p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-filters">
        <input
          aria-label="Pesquisar email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar email"
        />
        <button onClick={() => void load()}>Pesquisar</button>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Origem</th>
              <th>Consentimento</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.email}</td>
                <td>{item.source}</td>
                <td>{new Date(item.consentedAt).toLocaleString('pt-PT')}</td>
                <td>{item.isActive ? 'Ativa' : 'Inativa'}</td>
                <td>
                  <button onClick={() => void toggle(item)}>
                    {item.isActive ? 'Desativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
