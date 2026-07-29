'use client';

import type { CatalogProduct, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

type Bundle = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  mode: 'FIXED' | 'CONFIGURABLE';
  pricingMode: 'PRODUCT_PRICE' | 'COMPONENT_TOTAL';
  isActive: boolean;
};

type DraftItem = {
  productId: string;
  quantity: number;
  minimumQuantity: number;
  maximumQuantity?: number;
  isRequired: boolean;
  priceDeltaCents: number;
};

export function BundlesAdmin() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError('');
    try {
      const [bundleRows, productRows] = await Promise.all([
        managementApi.get<Bundle[]>('/v1/admin/bundles'),
        managementApi.get<Paginated<CatalogProduct>>(
          '/v1/admin/products?limit=100',
        ),
      ]);
      setBundles(bundleRows);
      setProducts(productRows.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar os cabazes.',
      );
    }
  }, []);

  useEffect(() => {
    // Initial synchronization with the management API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  function addComponent(productId: string) {
    if (!productId || items.some((item) => item.productId === productId))
      return;
    setItems((current) => [
      ...current,
      {
        productId,
        quantity: 1,
        minimumQuantity: 0,
        isRequired: false,
        priceDeltaCents: 0,
      },
    ]);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length) {
      setError('Adicione pelo menos um componente ao cabaz.');
      return;
    }
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await managementApi.post('/v1/admin/bundles', {
        productId: String(data.get('productId')),
        mode: String(data.get('mode')),
        pricingMode: String(data.get('pricingMode')),
        minimumSelections: Number(data.get('minimumSelections') || 0),
        maximumSelections: data.get('maximumSelections')
          ? Number(data.get('maximumSelections'))
          : undefined,
        isActive: true,
        groups: [],
        items: items.map((item, index) => ({
          ...item,
          groupCode: undefined,
          sortOrder: index,
          isActive: true,
        })),
        personalization: {
          allowGiftMessage: data.get('allowGiftMessage') === 'on',
          allowRecipientName: data.get('allowRecipientName') === 'on',
          allowSpecialPackaging: data.get('allowSpecialPackaging') === 'on',
          specialPackagingCents: Number(data.get('specialPackagingCents') || 0),
          allowRequestedDate: data.get('allowRequestedDate') === 'on',
          allowNotes: data.get('allowNotes') === 'on',
          allowHidePrice: data.get('allowHidePrice') === 'on',
          messageMaxLength: 300,
          notesMaxLength: 500,
        },
      });
      form.reset();
      setItems([]);
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar o cabaz.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Comercial</p>
          <h1>Cabazes</h1>
          <p>Packs fixos, configuráveis e personalização de oferta.</p>
        </div>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <section className="user-detail">
        <h2>Novo cabaz</h2>
        <form className="auth-form" onSubmit={create}>
          <label>
            Produto comercial
            <select name="productId" required defaultValue="">
              <option value="" disabled>
                Selecionar…
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modo
            <select name="mode" defaultValue="FIXED">
              <option>FIXED</option>
              <option>CONFIGURABLE</option>
            </select>
          </label>
          <label>
            Preço
            <select name="pricingMode" defaultValue="PRODUCT_PRICE">
              <option>PRODUCT_PRICE</option>
              <option>COMPONENT_TOTAL</option>
            </select>
          </label>
          <label>
            Mínimo de escolhas
            <input
              name="minimumSelections"
              type="number"
              min="0"
              defaultValue="0"
            />
          </label>
          <label>
            Máximo de escolhas
            <input name="maximumSelections" type="number" min="1" />
          </label>
          <label>
            Adicionar componente
            <select
              defaultValue=""
              onChange={(event) => {
                addComponent(event.target.value);
                event.target.value = '';
              }}
            >
              <option value="">Selecionar…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku}
                </option>
              ))}
            </select>
          </label>
          {items.map((item, index) => {
            const product = products.find(
              (candidate) => candidate.id === item.productId,
            );
            return (
              <article key={item.productId}>
                <p>
                  <strong>{product?.name ?? item.productId}</strong>
                </p>
                <label>
                  Quantidade base
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index
                            ? { ...value, quantity: Number(event.target.value) }
                            : value,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Mínimo
                  <input
                    type="number"
                    min="0"
                    value={item.minimumQuantity}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...value,
                                minimumQuantity: Number(event.target.value),
                              }
                            : value,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={item.isRequired}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index
                            ? { ...value, isRequired: event.target.checked }
                            : value,
                        ),
                      )
                    }
                  />{' '}
                  Obrigatório
                </label>
                <label>
                  Diferença de preço (cêntimos)
                  <input
                    type="number"
                    value={item.priceDeltaCents}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...value,
                                priceDeltaCents: Number(event.target.value),
                              }
                            : value,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remover componente
                </button>
              </article>
            );
          })}
          <h3>Oferta</h3>
          <label>
            <input name="allowRecipientName" type="checkbox" /> Nome do
            destinatário
          </label>
          <label>
            <input name="allowGiftMessage" type="checkbox" /> Mensagem/cartão
          </label>
          <label>
            <input name="allowSpecialPackaging" type="checkbox" /> Embalagem
            especial
          </label>
          <label>
            Custo embalagem especial (cêntimos)
            <input
              name="specialPackagingCents"
              type="number"
              min="0"
              defaultValue="0"
            />
          </label>
          <label>
            <input name="allowRequestedDate" type="checkbox" /> Data pretendida
          </label>
          <label>
            <input name="allowNotes" type="checkbox" /> Observações
          </label>
          <label>
            <input name="allowHidePrice" type="checkbox" /> Packing slip sem
            valores
          </label>
          <button className="admin-primary" disabled={busy}>
            {busy ? 'A criar…' : 'Criar cabaz'}
          </button>
        </form>
      </section>

      <section className="user-detail">
        <h2>Cabazes existentes</h2>
        {!bundles.length && <p>Sem cabazes criados.</p>}
        {bundles.map((bundle) => (
          <article key={bundle.id}>
            <p>
              <strong>{bundle.productName}</strong> · {bundle.mode} ·{' '}
              {bundle.pricingMode} · {bundle.isActive ? 'Ativo' : 'Inativo'}
            </p>
            <Link href={`/cabazes/${bundle.id}`}>
              Editar composição e personalização
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}
