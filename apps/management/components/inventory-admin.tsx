'use client';

import type { CatalogProduct, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type InventoryStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type InventoryItem = {
  id: string;
  productId: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  reason: string | null;
  product: { id: string; name: string; sku: string };
  stockMovement?: { id: string; quantity: number } | null;
};
type Inventory = {
  id: string;
  number: string;
  status: InventoryStatus;
  referenceAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: InventoryItem[];
  author?: { firstName: string; lastName: string } | null;
};

const statusLabel: Record<InventoryStatus, string> = {
  DRAFT: 'Rascunho',
  IN_PROGRESS: 'Em contagem',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export function InventoryAdmin({ inventoryId }: { inventoryId?: string }) {
  return inventoryId ? <InventoryDetail id={inventoryId} /> : <InventoryList />;
}

function InventoryList() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [counts, catalog] = await Promise.all([
        managementApi.get<Inventory[]>('/v1/admin/inventories'),
        managementApi.get<Paginated<CatalogProduct>>(
          '/v1/admin/products?limit=100&active=true',
        ),
      ]);
      setInventories(counts);
      setProducts(catalog.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) return products;
    return products.filter((product) =>
      `${product.name} ${product.sku}`
        .toLocaleLowerCase('pt-PT')
        .includes(normalized),
    );
  }, [products, query]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.size) {
      setError('Selecione pelo menos um produto para contar.');
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await managementApi.post<Inventory>(
        '/v1/admin/inventories',
        {
          items: [...selected].map((productId) => ({ productId })),
          notes: String(form.get('notes') || '') || undefined,
        },
      );
      window.location.assign(`/gestao/stock/inventarios/${result.id}`);
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
          <p className="eyebrow">Compras e stock</p>
          <h1>Inventários</h1>
          <p>
            Crie contagens, registe diferenças e conclua correções auditáveis.
          </p>
        </div>
      </header>

      <div className="admin-grid operational-main-grid">
        <section>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Estado</th>
                  <th>Produtos</th>
                  <th>Contados</th>
                  <th>Referência</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inventories.map((inventory) => (
                  <tr key={inventory.id}>
                    <td>{inventory.number}</td>
                    <td>{statusLabel[inventory.status]}</td>
                    <td>{inventory.items.length}</td>
                    <td>
                      {
                        inventory.items.filter(
                          (item) => item.countedQuantity !== null,
                        ).length
                      }
                    </td>
                    <td>
                      {new Date(inventory.referenceAt).toLocaleDateString(
                        'pt-PT',
                      )}
                    </td>
                    <td className="admin-table-action">
                      <Link href={`/stock/inventarios/${inventory.id}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
                {!inventories.length && (
                  <tr>
                    <td colSpan={6}>Ainda não existem inventários.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <form className="admin-card operational-form" onSubmit={create}>
          <div>
            <p className="eyebrow">Nova contagem</p>
            <h2>Selecionar produtos</h2>
          </div>
          <input
            aria-label="Pesquisar produto"
            type="search"
            placeholder="Nome ou SKU"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="operational-picker-actions">
            <button
              type="button"
              onClick={() =>
                setSelected(new Set(products.map((item) => item.id)))
              }
            >
              Selecionar todos
            </button>
            <button type="button" onClick={() => setSelected(new Set())}>
              Limpar
            </button>
          </div>
          <div className="operational-product-picker">
            {visibleProducts.map((product) => (
              <label key={product.id}>
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(product.id);
                      else next.delete(product.id);
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.sku}</small>
                </span>
              </label>
            ))}
          </div>
          <label>
            Notas
            <textarea name="notes" />
          </label>
          <button className="admin-primary" disabled={busy || !selected.size}>
            {busy ? 'A criar…' : `Iniciar contagem (${selected.size})`}
          </button>
        </form>
      </div>
    </section>
  );
}

function InventoryDetail({ id }: { id: string }) {
  const [inventory, setInventory] = useState<Inventory>();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await managementApi.get<Inventory>(
        `/v1/admin/inventories/${id}`,
      );
      setInventory(result);
      setCounts(
        Object.fromEntries(
          result.items.map((item) => [
            item.productId,
            item.countedQuantity === null ? '' : String(item.countedQuantity),
          ]),
        ),
      );
      setReasons(
        Object.fromEntries(
          result.items.map((item) => [item.productId, item.reason ?? '']),
        ),
      );
      setNotes(result.notes ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const payload = useMemo(
    () =>
      inventory?.items.map((item) => ({
        productId: item.productId,
        countedQuantity:
          counts[item.productId] === ''
            ? undefined
            : Number(counts[item.productId]),
        reason: reasons[item.productId] || undefined,
      })) ?? [],
    [counts, inventory, reasons],
  );
  const complete = payload.every((item) => item.countedQuantity !== undefined);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await managementApi.patch(`/v1/admin/inventories/${id}`, {
        items: payload,
        notes: notes || undefined,
      });
      setMessage('Contagem guardada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function action(kind: 'complete' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      if (kind === 'complete') {
        await managementApi.patch(`/v1/admin/inventories/${id}`, {
          items: payload,
          notes: notes || undefined,
        });
      }
      await managementApi.post(`/v1/admin/inventories/${id}/${kind}`);
      setMessage(
        kind === 'complete'
          ? 'Inventário concluído e stock corrigido.'
          : 'Inventário cancelado.',
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  if (!inventory && !error)
    return (
      <div className="admin-state" aria-busy="true">
        A carregar inventário…
      </div>
    );
  if (!inventory) return <div className="admin-error">{error}</div>;
  const editable = inventory.status === 'IN_PROGRESS';

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Inventário</p>
          <h1>{inventory.number}</h1>
          <p>
            {statusLabel[inventory.status]} · {inventory.items.length} produtos
          </p>
        </div>
        <div className="admin-actions">
          <Link className="admin-secondary" href="/stock/inventarios">
            Voltar
          </Link>
          {editable && (
            <>
              <button
                className="admin-secondary"
                disabled={busy}
                onClick={() => void save()}
              >
                Guardar
              </button>
              <button
                className="admin-primary"
                disabled={busy || !complete}
                onClick={() => {
                  if (
                    confirm(
                      'Concluir o inventário e aplicar as diferenças ao stock?',
                    )
                  )
                    void action('complete');
                }}
              >
                Concluir inventário
              </button>
              <button
                className="admin-secondary"
                disabled={busy}
                onClick={() => {
                  if (confirm('Cancelar esta contagem?')) void action('cancel');
                }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </header>

      <section className="admin-card operational-form">
        <label>
          Notas
          <textarea
            value={notes}
            disabled={!editable}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Esperado</th>
                <th>Contado</th>
                <th>Diferença</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {inventory.items.map((item) => {
                const counted = counts[item.productId];
                const difference =
                  counted === ''
                    ? null
                    : Number(counted) - item.expectedQuantity;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product.name}</strong>
                      <small>{item.product.sku}</small>
                    </td>
                    <td>{item.expectedQuantity}</td>
                    <td>
                      <input
                        aria-label={`Contagem de ${item.product.name}`}
                        min="0"
                        type="number"
                        disabled={!editable}
                        value={counted ?? ''}
                        onChange={(event) =>
                          setCounts((current) => ({
                            ...current,
                            [item.productId]: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>{difference === null ? '—' : difference}</td>
                    <td>
                      <input
                        aria-label={`Motivo de ${item.product.name}`}
                        disabled={!editable}
                        value={reasons[item.productId] ?? ''}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [item.productId]: event.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
