'use client';

import type { CatalogProduct, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type BundleGroup = {
  id: string;
  code: string;
  name: string;
  minimumSelections: number;
  maximumSelections: number | null;
  sortOrder: number;
};

type BundleItem = {
  id: string;
  productId: string;
  groupId: string | null;
  quantity: number;
  isRequired: boolean;
  minimumQuantity: number;
  maximumQuantity: number | null;
  priceDeltaCents: number;
  sortOrder: number;
  isActive: boolean;
  productName: string;
  productSku: string;
};

type Personalization = {
  allowGiftMessage: boolean;
  allowRecipientName: boolean;
  allowSpecialPackaging: boolean;
  specialPackagingCents: number;
  allowRequestedDate: boolean;
  allowNotes: boolean;
  allowHidePrice: boolean;
  messageMaxLength: number;
  notesMaxLength: number;
};

type BundleDetail = {
  id: string;
  productId: string;
  productName: string;
  mode: 'FIXED' | 'CONFIGURABLE';
  pricingMode: 'PRODUCT_PRICE' | 'COMPONENT_TOTAL';
  minimumSelections: number | null;
  maximumSelections: number | null;
  isActive: boolean;
  groups: BundleGroup[];
  items: BundleItem[];
  personalization: Personalization | null;
};

const emptyPersonalization: Personalization = {
  allowGiftMessage: false,
  allowRecipientName: false,
  allowSpecialPackaging: false,
  specialPackagingCents: 0,
  allowRequestedDate: false,
  allowNotes: false,
  allowHidePrice: false,
  messageMaxLength: 300,
  notesMaxLength: 500,
};

const normalizeGroupCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '-');

export function BundleDetailAdmin({ id }: { id: string }) {
  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      managementApi.get<BundleDetail>(`/v1/admin/bundles/${id}`),
      managementApi.get<Paginated<CatalogProduct>>(
        '/v1/admin/products?limit=100',
      ),
    ])
      .then(([detail, result]) => {
        setBundle({
          ...detail,
          groups: detail.groups ?? [],
          items: detail.items ?? [],
          personalization: detail.personalization ?? emptyPersonalization,
        });
        setProducts(result.data);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível carregar o cabaz.',
        ),
      );
  }, [id]);

  const groupCodes = useMemo(
    () => new Map(bundle?.groups.map((group) => [group.id, group.code]) ?? []),
    [bundle?.groups],
  );

  if (error && !bundle) {
    return <div className="admin-state admin-error">{error}</div>;
  }
  if (!bundle) return <div className="admin-state">A carregar cabaz…</div>;

  const personalization = bundle.personalization ?? emptyPersonalization;

  function updateGroup(index: number, patch: Partial<BundleGroup>) {
    setBundle((current) =>
      current
        ? {
            ...current,
            groups: current.groups.map((group, groupIndex) =>
              groupIndex === index ? { ...group, ...patch } : group,
            ),
          }
        : current,
    );
  }

  function updateItem(index: number, patch: Partial<BundleItem>) {
    setBundle((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  }

  function addComponent(productId: string) {
    if (!bundle) return;
    if (!productId || bundle.items.some((item) => item.productId === productId))
      return;
    const product = products.find((candidate) => candidate.id === productId);
    setBundle({
      ...bundle,
      items: [
        ...bundle.items,
        {
          id: `draft-${crypto.randomUUID()}`,
          productId,
          groupId: null,
          quantity: 1,
          isRequired: false,
          minimumQuantity: 0,
          maximumQuantity: null,
          priceDeltaCents: 0,
          sortOrder: bundle.items.length,
          isActive: true,
          productName: product?.name ?? productId,
          productSku: product?.sku ?? '',
        },
      ],
    });
  }

  async function save() {
    if (!bundle) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const codes = bundle.groups.map((group) =>
        normalizeGroupCode(group.code),
      );
      if (new Set(codes).size !== codes.length) {
        throw new Error('Existem códigos de grupo duplicados.');
      }
      const updated = await managementApi.patch<BundleDetail>(
        `/v1/admin/bundles/${bundle.id}`,
        {
          productId: bundle.productId,
          mode: bundle.mode,
          pricingMode: bundle.pricingMode,
          minimumSelections: bundle.minimumSelections ?? undefined,
          maximumSelections: bundle.maximumSelections ?? undefined,
          isActive: bundle.isActive,
          groups: bundle.groups.map((group, index) => ({
            code: normalizeGroupCode(group.code),
            name: group.name,
            minimumSelections: group.minimumSelections,
            maximumSelections: group.maximumSelections ?? undefined,
            sortOrder: index,
          })),
          items: bundle.items.map((item, index) => ({
            productId: item.productId,
            groupCode: item.groupId ? groupCodes.get(item.groupId) : undefined,
            quantity: item.quantity,
            isRequired: item.isRequired,
            minimumQuantity: item.minimumQuantity,
            maximumQuantity: item.maximumQuantity ?? undefined,
            priceDeltaCents: item.priceDeltaCents,
            sortOrder: index,
            isActive: item.isActive,
          })),
          personalization,
        },
      );
      setBundle({
        ...updated,
        groups: updated.groups ?? [],
        items: updated.items ?? [],
        personalization: updated.personalization ?? emptyPersonalization,
      });
      setMessage('Cabaz atualizado.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar o cabaz.',
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
          <h1>{bundle.productName}</h1>
          <p>Composição, grupos de escolha e personalização.</p>
        </div>
        <Link href="/cabazes">Voltar aos cabazes</Link>
      </header>
      {message && <p className="admin-message">{message}</p>}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <section className="user-detail">
        <h2>Configuração</h2>
        <label>
          Modo
          <select
            value={bundle.mode}
            onChange={(event) =>
              setBundle({
                ...bundle,
                mode: event.target.value as BundleDetail['mode'],
              })
            }
          >
            <option value="FIXED">FIXED</option>
            <option value="CONFIGURABLE">CONFIGURABLE</option>
          </select>
        </label>
        <label>
          Preço
          <select
            value={bundle.pricingMode}
            onChange={(event) =>
              setBundle({
                ...bundle,
                pricingMode: event.target.value as BundleDetail['pricingMode'],
              })
            }
          >
            <option value="PRODUCT_PRICE">PRODUCT_PRICE</option>
            <option value="COMPONENT_TOTAL">COMPONENT_TOTAL</option>
          </select>
        </label>
        <label>
          Mínimo total de escolhas
          <input
            type="number"
            min="0"
            value={bundle.minimumSelections ?? 0}
            onChange={(event) =>
              setBundle({
                ...bundle,
                minimumSelections: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          Máximo total de escolhas
          <input
            type="number"
            min="1"
            value={bundle.maximumSelections ?? ''}
            onChange={(event) =>
              setBundle({
                ...bundle,
                maximumSelections: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={bundle.isActive}
            onChange={(event) =>
              setBundle({ ...bundle, isActive: event.target.checked })
            }
          />{' '}
          Cabaz ativo
        </label>
      </section>

      <section className="user-detail">
        <h2>Grupos de escolha</h2>
        {bundle.groups.map((group, index) => (
          <article key={group.id}>
            <label>
              Código
              <input
                value={group.code}
                onChange={(event) =>
                  updateGroup(index, { code: event.target.value })
                }
              />
            </label>
            <label>
              Nome
              <input
                value={group.name}
                onChange={(event) =>
                  updateGroup(index, { name: event.target.value })
                }
              />
            </label>
            <label>
              Mínimo
              <input
                type="number"
                min="0"
                value={group.minimumSelections}
                onChange={(event) =>
                  updateGroup(index, {
                    minimumSelections: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Máximo
              <input
                type="number"
                min="1"
                value={group.maximumSelections ?? ''}
                onChange={(event) =>
                  updateGroup(index, {
                    maximumSelections: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setBundle({
                  ...bundle,
                  groups: bundle.groups.filter(
                    (_, groupIndex) => groupIndex !== index,
                  ),
                  items: bundle.items.map((item) =>
                    item.groupId === group.id
                      ? { ...item, groupId: null }
                      : item,
                  ),
                })
              }
            >
              Remover grupo
            </button>
          </article>
        ))}
        <button
          type="button"
          onClick={() =>
            setBundle({
              ...bundle,
              groups: [
                ...bundle.groups,
                {
                  id: `draft-${crypto.randomUUID()}`,
                  code: `GRUPO-${bundle.groups.length + 1}`,
                  name: `Grupo ${bundle.groups.length + 1}`,
                  minimumSelections: 0,
                  maximumSelections: null,
                  sortOrder: bundle.groups.length,
                },
              ],
            })
          }
        >
          Adicionar grupo
        </button>
      </section>

      <section className="user-detail">
        <h2>Componentes</h2>
        <label>
          Adicionar produto
          <select
            defaultValue=""
            onChange={(event) => {
              addComponent(event.target.value);
              event.target.value = '';
            }}
          >
            <option value="">Selecionar…</option>
            {products
              .filter((product) => product.id !== bundle.productId)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku}
                </option>
              ))}
          </select>
        </label>
        {bundle.items.map((item, index) => (
          <article key={item.id}>
            <p>
              <strong>{item.productName}</strong> · {item.productSku}
            </p>
            <label>
              Grupo
              <select
                value={item.groupId ?? ''}
                onChange={(event) =>
                  updateItem(index, { groupId: event.target.value || null })
                }
              >
                <option value="">Sem grupo</option>
                {bundle.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantidade base
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) =>
                  updateItem(index, { quantity: Number(event.target.value) })
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
                  updateItem(index, {
                    minimumQuantity: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Máximo
              <input
                type="number"
                min="1"
                value={item.maximumQuantity ?? ''}
                onChange={(event) =>
                  updateItem(index, {
                    maximumQuantity: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label>
              Diferença de preço (cêntimos)
              <input
                type="number"
                value={item.priceDeltaCents}
                onChange={(event) =>
                  updateItem(index, {
                    priceDeltaCents: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={item.isRequired}
                onChange={(event) =>
                  updateItem(index, { isRequired: event.target.checked })
                }
              />{' '}
              Obrigatório
            </label>
            <label>
              <input
                type="checkbox"
                checked={item.isActive}
                onChange={(event) =>
                  updateItem(index, { isActive: event.target.checked })
                }
              />{' '}
              Ativo
            </label>
            <button
              type="button"
              onClick={() =>
                setBundle({
                  ...bundle,
                  items: bundle.items.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >
              Remover componente
            </button>
          </article>
        ))}
      </section>

      <section className="user-detail">
        <h2>Personalização de oferta</h2>
        <label>
          <input
            type="checkbox"
            checked={personalization.allowRecipientName}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  allowRecipientName: event.target.checked,
                },
              })
            }
          />{' '}
          Nome do destinatário
        </label>
        <label>
          <input
            type="checkbox"
            checked={personalization.allowGiftMessage}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  allowGiftMessage: event.target.checked,
                },
              })
            }
          />{' '}
          Mensagem/cartão
        </label>
        <label>
          <input
            type="checkbox"
            checked={personalization.allowSpecialPackaging}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  allowSpecialPackaging: event.target.checked,
                },
              })
            }
          />{' '}
          Embalagem especial
        </label>
        <label>
          Custo da embalagem especial (cêntimos)
          <input
            type="number"
            min="0"
            value={personalization.specialPackagingCents}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  specialPackagingCents: Number(event.target.value),
                },
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={personalization.allowRequestedDate}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  allowRequestedDate: event.target.checked,
                },
              })
            }
          />{' '}
          Data pretendida
        </label>
        <label>
          <input
            type="checkbox"
            checked={personalization.allowNotes}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  allowNotes: event.target.checked,
                },
              })
            }
          />{' '}
          Observações
        </label>
        <label>
          <input
            type="checkbox"
            checked={personalization.allowHidePrice}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  allowHidePrice: event.target.checked,
                },
              })
            }
          />{' '}
          Packing slip sem valores
        </label>
        <label>
          Máximo da mensagem
          <input
            type="number"
            min="1"
            max="2000"
            value={personalization.messageMaxLength}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  messageMaxLength: Number(event.target.value),
                },
              })
            }
          />
        </label>
        <label>
          Máximo das observações
          <input
            type="number"
            min="1"
            max="4000"
            value={personalization.notesMaxLength}
            onChange={(event) =>
              setBundle({
                ...bundle,
                personalization: {
                  ...personalization,
                  notesMaxLength: Number(event.target.value),
                },
              })
            }
          />
        </label>
      </section>

      <button
        className="admin-primary"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? 'A guardar…' : 'Guardar alterações'}
      </button>
    </>
  );
}
