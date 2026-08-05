'use client';

import type { CatalogProduct, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi, useManagementAuth } from './management-auth';

type PriceItem = {
  id?: string;
  productId: string;
  priceCents: number;
  promotionalPriceCents: number | null;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  product?: { id: string; name: string; sku: string };
};
type PriceList = {
  id: string;
  name: string;
  code: string;
  type: 'RETAIL' | 'RESELLER' | 'CUSTOM';
  currency: string;
  includesTax: boolean;
  priority: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  items: PriceItem[];
  _count?: {
    businessAccounts: number;
    orders: number;
    promotionTargets: number;
  };
};
type EditableItem = {
  productId: string;
  price: string;
  promotionalPrice: string;
  minimumQuantity: string;
  maximumQuantity: string;
};

export function PriceListsAdmin({ priceListId }: { priceListId?: string }) {
  return priceListId ? (
    <PriceListEditor id={priceListId} />
  ) : (
    <PriceListIndex />
  );
}

function PriceListIndex() {
  const auth = useManagementAuth();
  const [lists, setLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [priceLists, catalog] = await Promise.all([
        managementApi.get<PriceList[]>('/v1/admin/price-lists'),
        managementApi.get<Paginated<CatalogProduct>>(
          '/v1/admin/products?limit=100&active=true',
        ),
      ]);
      setLists(priceLists);
      setProducts(catalog.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = String(form.get('productId'));
    setBusy(true);
    setError('');
    try {
      const created = await managementApi.post<PriceList>(
        '/v1/admin/price-lists',
        {
          name: form.get('name'),
          code: form.get('code'),
          type: form.get('type'),
          includesTax: form.get('includesTax') === 'on',
          priority: Number(form.get('priority') || 0),
          isActive: true,
          items: [
            {
              productId,
              priceCents: Math.round(Number(form.get('price')) * 100),
            },
          ],
        },
      );
      window.location.assign(`/gestao/tabelas-precos/${created.id}`);
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
          <h1>Tabelas de preços</h1>
          <p>Preços retail, revenda e condições personalizadas por produto.</p>
        </div>
      </header>
      <div className="admin-grid operational-main-grid">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Código</th>
                <th>Tipo</th>
                <th>Produtos</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.id}>
                  <td>{list.name}</td>
                  <td>{list.code}</td>
                  <td>{list.type}</td>
                  <td>{list.items.length}</td>
                  <td>{list.isActive ? 'Ativa' : 'Inativa'}</td>
                  <td className="admin-table-action">
                    <Link href={`/tabelas-precos/${list.id}`}>Abrir</Link>
                  </td>
                </tr>
              ))}
              {!lists.length && (
                <tr>
                  <td colSpan={6}>Ainda não existem tabelas de preços.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {auth.user?.role === 'ADMIN' && (
          <form className="admin-card operational-form" onSubmit={create}>
            <div>
              <p className="eyebrow">Nova tabela</p>
              <h2>Criar tabela de preços</h2>
            </div>
            <label>
              Nome
              <input name="name" required />
            </label>
            <label>
              Código
              <input name="code" pattern="[A-Za-z0-9._-]+" required />
            </label>
            <label>
              Tipo
              <select name="type" defaultValue="RESELLER">
                <option value="RETAIL">Retail</option>
                <option value="RESELLER">Revenda</option>
                <option value="CUSTOM">Personalizada</option>
              </select>
            </label>
            <label>
              Prioridade
              <input min="0" name="priority" type="number" defaultValue="0" />
            </label>
            <label>
              Primeiro produto
              <select name="productId" required>
                <option value="">Selecionar</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preço inicial (€)
              <input min="0" name="price" step="0.01" type="number" required />
            </label>
            <label className="operational-check">
              <input name="includesTax" type="checkbox" defaultChecked />
              Preços incluem IVA
            </label>
            <button className="admin-primary" disabled={busy}>
              {busy ? 'A criar…' : 'Criar e completar'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function PriceListEditor({ id }: { id: string }) {
  const auth = useManagementAuth();
  const [list, setList] = useState<PriceList>();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [priceList, catalog] = await Promise.all([
        managementApi.get<PriceList>(`/v1/admin/price-lists/${id}`),
        managementApi.get<Paginated<CatalogProduct>>(
          '/v1/admin/products?limit=100&active=true',
        ),
      ]);
      setList(priceList);
      setProducts(catalog.data);
      setItems(
        priceList.items.map((item) => ({
          productId: item.productId,
          price: String(item.priceCents / 100),
          promotionalPrice:
            item.promotionalPriceCents === null
              ? ''
              : String(item.promotionalPriceCents / 100),
          minimumQuantity:
            item.minimumQuantity === null ? '' : String(item.minimumQuantity),
          maximumQuantity:
            item.maximumQuantity === null ? '' : String(item.maximumQuantity),
        })),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) => !items.some((item) => item.productId === product.id),
      ),
    [items, products],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!list || !items.length) {
      setError('A tabela tem de incluir pelo menos um produto.');
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await managementApi.patch<PriceList>(
        `/v1/admin/price-lists/${id}`,
        {
          name: form.get('name'),
          code: form.get('code'),
          type: form.get('type'),
          includesTax: form.get('includesTax') === 'on',
          priority: Number(form.get('priority') || 0),
          isActive: form.get('isActive') === 'on',
          validFrom: form.get('validFrom') || undefined,
          validUntil: form.get('validUntil') || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            priceCents: Math.round(Number(item.price) * 100),
            promotionalPriceCents: item.promotionalPrice
              ? Math.round(Number(item.promotionalPrice) * 100)
              : undefined,
            minimumQuantity: item.minimumQuantity
              ? Number(item.minimumQuantity)
              : undefined,
            maximumQuantity: item.maximumQuantity
              ? Number(item.maximumQuantity)
              : undefined,
          })),
        },
      );
      setList(result);
      setMessage('Tabela de preços atualizada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Eliminar esta tabela? Se estiver em uso será desativada.'))
      return;
    setBusy(true);
    setError('');
    try {
      const result = await managementApi.delete<{ action: string }>(
        `/v1/admin/price-lists/${id}`,
      );
      if (result.action === 'DELETED') {
        window.location.assign('/gestao/tabelas-precos');
        return;
      }
      setMessage('A tabela está em uso e foi desativada.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  if (!list && !error)
    return (
      <div className="admin-state" aria-busy="true">
        A carregar tabela…
      </div>
    );
  if (!list) return <div className="admin-error">{error}</div>;
  const canEdit = auth.user?.role === 'ADMIN';

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Tabela de preços</p>
          <h1>{list.name}</h1>
          <p>
            {list.code} · {list.items.length} produtos ·{' '}
            {list.isActive ? 'Ativa' : 'Inativa'}
          </p>
        </div>
        <div className="admin-actions">
          <Link className="admin-secondary" href="/tabelas-precos">
            Voltar
          </Link>
          {canEdit && (
            <button
              className="admin-secondary"
              disabled={busy}
              onClick={() => void remove()}
            >
              Eliminar ou desativar
            </button>
          )}
        </div>
      </header>

      <form className="operational-stack" onSubmit={save}>
        <section className="admin-form admin-card">
          <label>
            Nome
            <input
              name="name"
              required
              defaultValue={list.name}
              disabled={!canEdit}
            />
          </label>
          <label>
            Código
            <input
              name="code"
              required
              defaultValue={list.code}
              disabled={!canEdit}
            />
          </label>
          <label>
            Tipo
            <select name="type" defaultValue={list.type} disabled={!canEdit}>
              <option value="RETAIL">Retail</option>
              <option value="RESELLER">Revenda</option>
              <option value="CUSTOM">Personalizada</option>
            </select>
          </label>
          <label>
            Prioridade
            <input
              name="priority"
              type="number"
              min="0"
              defaultValue={list.priority}
              disabled={!canEdit}
            />
          </label>
          <label>
            Válida desde
            <input
              name="validFrom"
              type="date"
              defaultValue={list.validFrom?.slice(0, 10)}
              disabled={!canEdit}
            />
          </label>
          <label>
            Válida até
            <input
              name="validUntil"
              type="date"
              defaultValue={list.validUntil?.slice(0, 10)}
              disabled={!canEdit}
            />
          </label>
          <label className="check">
            <input
              name="includesTax"
              type="checkbox"
              defaultChecked={list.includesTax}
              disabled={!canEdit}
            />
            Inclui IVA
          </label>
          <label className="check">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={list.isActive}
              disabled={!canEdit}
            />
            Ativa
          </label>
        </section>

        <section className="admin-card operational-form">
          <div className="operational-section-heading">
            <div>
              <p className="eyebrow">Preços</p>
              <h2>Produtos da tabela</h2>
            </div>
            {canEdit && availableProducts.length > 0 && (
              <select
                aria-label="Adicionar produto"
                value=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  const product = products.find(
                    (item) => item.id === event.target.value,
                  );
                  setItems((current) => [
                    ...current,
                    {
                      productId: event.target.value,
                      price: product ? String(product.priceCents / 100) : '',
                      promotionalPrice: '',
                      minimumQuantity: '',
                      maximumQuantity: '',
                    },
                  ]);
                }}
              >
                <option value="">Adicionar produto…</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="operational-line-list price-line-list">
            {items.map((item, index) => {
              const product = products.find(
                (candidate) => candidate.id === item.productId,
              );
              return (
                <div key={item.productId} className="price-line">
                  <span>
                    <strong>{product?.name ?? item.productId}</strong>
                    <small>{product?.sku}</small>
                  </span>
                  <label>
                    Preço (€)
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      required
                      value={item.price}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateItem(index, { price: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Promocional (€)
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={item.promotionalPrice}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateItem(index, {
                          promotionalPrice: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Mínimo
                    <input
                      min="1"
                      type="number"
                      value={item.minimumQuantity}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateItem(index, {
                          minimumQuantity: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Máximo
                    <input
                      min="1"
                      type="number"
                      value={item.maximumQuantity}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateItem(index, {
                          maximumQuantity: event.target.value,
                        })
                      }
                    />
                  </label>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      Remover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        {canEdit && (
          <button
            className="admin-primary operational-submit"
            disabled={busy || !items.length}
          >
            {busy ? 'A guardar…' : 'Guardar tabela'}
          </button>
        )}
      </form>
    </section>
  );
}
