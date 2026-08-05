'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type StockRow = {
  id: string;
  productId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  trackStock: boolean;
  product: { id: string; name: string; sku: string; isActive: boolean };
};

const adjustmentTypes = [
  ['ADJUSTMENT_IN', 'Entrada manual'],
  ['ADJUSTMENT_OUT', 'Saída manual'],
  ['DAMAGE', 'Dano'],
  ['LOSS', 'Perda'],
] as const;

export function StockAdmin() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await managementApi.get<StockRow[]>('/v1/admin/stock');
      setRows(data);
      setSelectedId((current) => current || data[0]?.productId || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const selected = rows.find((row) => row.productId === selectedId);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) return rows;
    return rows.filter((row) =>
      `${row.product.name} ${row.product.sku}`
        .toLocaleLowerCase('pt-PT')
        .includes(normalized),
    );
  }, [query, rows]);

  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await managementApi.patch(`/v1/admin/stock/${selected.productId}`, {
        reorderPoint: form.get('reorderPoint')
          ? Number(form.get('reorderPoint'))
          : null,
        reorderQuantity: form.get('reorderQuantity')
          ? Number(form.get('reorderQuantity'))
          : null,
        trackStock: form.get('trackStock') === 'on',
      });
      setMessage('Configuração de stock guardada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await managementApi.post('/v1/admin/stock/adjustments', {
        productId: selected.productId,
        type: form.get('type'),
        quantity: Number(form.get('quantity')),
        note: form.get('note'),
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage('Acerto registado no histórico de stock.');
      event.currentTarget.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  const total = rows.reduce((sum, row) => sum + row.onHandQuantity, 0);
  const reserved = rows.reduce((sum, row) => sum + row.reservedQuantity, 0);
  const alerts = rows.filter(
    (row) =>
      row.reorderPoint !== null &&
      row.onHandQuantity - row.reservedQuantity <= row.reorderPoint,
  ).length;

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Compras e stock</p>
          <h1>Stock</h1>
          <p>Disponibilidade, níveis de reposição e acertos auditáveis.</p>
        </div>
      </header>
      <div className="admin-metrics">
        <article>
          <span>Unidades físicas</span>
          <strong>{total}</strong>
        </article>
        <article>
          <span>Reservadas</span>
          <strong>{reserved}</strong>
        </article>
        <article>
          <span>Disponíveis</span>
          <strong>{total - reserved}</strong>
        </article>
        <article>
          <span>Alertas de reposição</span>
          <strong>{alerts}</strong>
        </article>
      </div>

      <div className="admin-grid operational-main-grid">
        <section>
          <div className="admin-list-toolbar">
            <label>
              <span>Pesquisar</span>
              <input
                type="search"
                placeholder="Pesquisar produto ou SKU"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <small>{filtered.length} produtos</small>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Físico</th>
                  <th>Reservado</th>
                  <th>Disponível</th>
                  <th>Reposição</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.product.name}</strong>
                      <small>{row.product.sku}</small>
                    </td>
                    <td>{row.onHandQuantity}</td>
                    <td>{row.reservedQuantity}</td>
                    <td>{row.onHandQuantity - row.reservedQuantity}</td>
                    <td>{row.reorderPoint ?? '—'}</td>
                    <td className="admin-table-action">
                      <button onClick={() => setSelectedId(row.productId)}>
                        Gerir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selected ? (
          <div className="operational-stack" key={selected.productId}>
            <form className="admin-card operational-form" onSubmit={configure}>
              <div>
                <p className="eyebrow">Configuração</p>
                <h2>{selected.product.name}</h2>
              </div>
              <label>
                Ponto de reposição
                <input
                  min="0"
                  name="reorderPoint"
                  type="number"
                  defaultValue={selected.reorderPoint ?? ''}
                />
              </label>
              <label>
                Quantidade a repor
                <input
                  min="0"
                  name="reorderQuantity"
                  type="number"
                  defaultValue={selected.reorderQuantity ?? ''}
                />
              </label>
              <label className="operational-check">
                <input
                  name="trackStock"
                  type="checkbox"
                  defaultChecked={selected.trackStock}
                />
                Controlar stock físico
              </label>
              <button className="admin-primary" disabled={busy}>
                Guardar configuração
              </button>
            </form>

            <form className="admin-card operational-form" onSubmit={adjust}>
              <div>
                <p className="eyebrow">Acerto manual</p>
                <h2>Corrigir quantidade</h2>
              </div>
              <label>
                Tipo
                <select name="type" required>
                  {adjustmentTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantidade
                <input min="1" name="quantity" required type="number" />
              </label>
              <label>
                Motivo obrigatório
                <textarea maxLength={500} name="note" required />
              </label>
              <button className="admin-primary" disabled={busy}>
                Registar acerto
              </button>
            </form>
          </div>
        ) : (
          <div className="admin-state">Selecione um produto.</div>
        )}
      </div>
    </section>
  );
}
