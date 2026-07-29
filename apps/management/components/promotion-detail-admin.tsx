'use client';

import type {
  CatalogCategory,
  CatalogProduct,
  Paginated,
} from '@nsabores/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type PromotionTarget = {
  productId?: string | null;
  categoryId?: string | null;
  priceListId?: string | null;
  businessAccountId?: string | null;
  minimumQuantity?: number | null;
};

type PromotionDetail = {
  id: string;
  name: string;
  code: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';
  benefitType:
    | 'PERCENTAGE'
    | 'FIXED_AMOUNT'
    | 'FREE_SHIPPING'
    | 'SPECIAL_PRICE'
    | 'QUANTITY_DEAL';
  benefitValue: number;
  channel: 'B2C' | 'B2B' | 'BOTH';
  startsAt?: string | null;
  endsAt?: string | null;
  priority: number;
  stackable: boolean;
  globalUsageLimit?: number | null;
  perCustomerLimit?: number | null;
  minimumCartCents?: number | null;
  maximumDiscountCents?: number | null;
  quantityBuy?: number | null;
  quantityPay?: number | null;
  targets: PromotionTarget[];
};

const toInputDate = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : '';

export function PromotionDetailAdmin({ id }: { id: string }) {
  const [promotion, setPromotion] = useState<PromotionDetail | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      managementApi.get<PromotionDetail>(`/v1/admin/promotions/${id}`),
      managementApi.get<Paginated<CatalogProduct>>(
        '/v1/admin/products?limit=100',
      ),
      managementApi.get<CatalogCategory[]>('/v1/admin/categories'),
    ])
      .then(([detail, productRows, categoryRows]) => {
        setPromotion({ ...detail, targets: detail.targets ?? [] });
        setProducts(productRows.data);
        setCategories(categoryRows);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível carregar a promoção.',
        ),
      );
  }, [id]);

  if (error && !promotion)
    return <div className="admin-state admin-error">{error}</div>;
  if (!promotion)
    return <div className="admin-state">A carregar promoção…</div>;

  function updateTarget(index: number, patch: Partial<PromotionTarget>) {
    setPromotion((current) =>
      current
        ? {
            ...current,
            targets: current.targets.map((target, targetIndex) =>
              targetIndex === index ? { ...target, ...patch } : target,
            ),
          }
        : current,
    );
  }

  async function save() {
    if (!promotion) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await managementApi.patch(`/v1/admin/promotions/${promotion.id}`, {
        name: promotion.name,
        code: promotion.code,
        status: promotion.status,
        benefitType: promotion.benefitType,
        benefitValue:
          promotion.benefitType === 'QUANTITY_DEAL'
            ? 0
            : promotion.benefitValue,
        channel: promotion.channel,
        startsAt: promotion.startsAt || undefined,
        endsAt: promotion.endsAt || undefined,
        priority: promotion.priority,
        stackable: promotion.stackable,
        globalUsageLimit: promotion.globalUsageLimit ?? undefined,
        perCustomerLimit: promotion.perCustomerLimit ?? undefined,
        minimumCartCents: promotion.minimumCartCents ?? undefined,
        maximumDiscountCents: promotion.maximumDiscountCents ?? undefined,
        targets: promotion.targets.map((target) => ({
          productId: target.productId || undefined,
          categoryId: target.categoryId || undefined,
          priceListId: target.priceListId || undefined,
          businessAccountId: target.businessAccountId || undefined,
          minimumQuantity: target.minimumQuantity ?? undefined,
        })),
      });
      if (promotion.benefitType === 'QUANTITY_DEAL') {
        if (!promotion.quantityBuy || !promotion.quantityPay) {
          throw new Error(
            'Indique as quantidades levada e paga para esta promoção.',
          );
        }
        await managementApi.patch(
          `/v1/admin/promotions/${promotion.id}/quantity-deal`,
          {
            quantityBuy: promotion.quantityBuy,
            quantityPay: promotion.quantityPay,
          },
        );
      }
      const updated = await managementApi.get<PromotionDetail>(
        `/v1/admin/promotions/${promotion.id}`,
      );
      setPromotion({ ...updated, targets: updated.targets ?? [] });
      setMessage('Promoção atualizada.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar a promoção.',
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
          <h1>{promotion.name}</h1>
          <p>
            {promotion.code} · {promotion.benefitType}
          </p>
        </div>
        <Link href="/promocoes">Voltar às promoções</Link>
      </header>
      {message && <p className="admin-message">{message}</p>}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <section className="user-detail">
        <h2>Regra</h2>
        <label>
          Nome
          <input
            value={promotion.name}
            onChange={(event) =>
              setPromotion({ ...promotion, name: event.target.value })
            }
          />
        </label>
        <label>
          Código
          <input
            value={promotion.code}
            onChange={(event) =>
              setPromotion({ ...promotion, code: event.target.value })
            }
          />
        </label>
        <label>
          Estado
          <select
            value={promotion.status}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                status: event.target.value as PromotionDetail['status'],
              })
            }
          >
            <option>DRAFT</option>
            <option>ACTIVE</option>
            <option>PAUSED</option>
            <option>EXPIRED</option>
            <option>ARCHIVED</option>
          </select>
        </label>
        <label>
          Tipo
          <input value={promotion.benefitType} disabled />
          <small>
            O tipo fica imutável depois da criação para preservar a semântica da
            campanha.
          </small>
        </label>
        {promotion.benefitType === 'QUANTITY_DEAL' ? (
          <>
            <label>
              Leve
              <input
                type="number"
                min="2"
                value={promotion.quantityBuy ?? 3}
                onChange={(event) =>
                  setPromotion({
                    ...promotion,
                    quantityBuy: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Pague
              <input
                type="number"
                min="1"
                value={promotion.quantityPay ?? 2}
                onChange={(event) =>
                  setPromotion({
                    ...promotion,
                    quantityPay: Number(event.target.value),
                  })
                }
              />
            </label>
          </>
        ) : promotion.benefitType !== 'FREE_SHIPPING' ? (
          <label>
            Valor
            <input
              type="number"
              min="0"
              value={promotion.benefitValue}
              onChange={(event) =>
                setPromotion({
                  ...promotion,
                  benefitValue: Number(event.target.value),
                })
              }
            />
          </label>
        ) : null}
        <label>
          Canal
          <select
            value={promotion.channel}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                channel: event.target.value as PromotionDetail['channel'],
              })
            }
          >
            <option>BOTH</option>
            <option>B2C</option>
            <option>B2B</option>
          </select>
        </label>
        <label>
          Início
          <input
            type="datetime-local"
            value={toInputDate(promotion.startsAt)}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                startsAt: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              })
            }
          />
        </label>
        <label>
          Fim
          <input
            type="datetime-local"
            value={toInputDate(promotion.endsAt)}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                endsAt: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              })
            }
          />
        </label>
        <label>
          Prioridade
          <input
            type="number"
            value={promotion.priority}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                priority: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={promotion.stackable}
            onChange={(event) =>
              setPromotion({ ...promotion, stackable: event.target.checked })
            }
          />{' '}
          Pode acumular
        </label>
        <label>
          Carrinho mínimo (cêntimos)
          <input
            type="number"
            min="0"
            value={promotion.minimumCartCents ?? ''}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                minimumCartCents: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label>
          Desconto máximo (cêntimos)
          <input
            type="number"
            min="0"
            value={promotion.maximumDiscountCents ?? ''}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                maximumDiscountCents: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label>
          Limite global
          <input
            type="number"
            min="1"
            value={promotion.globalUsageLimit ?? ''}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                globalUsageLimit: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label>
          Limite por cliente/empresa
          <input
            type="number"
            min="1"
            value={promotion.perCustomerLimit ?? ''}
            onChange={(event) =>
              setPromotion({
                ...promotion,
                perCustomerLimit: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
      </section>

      <section className="user-detail">
        <h2>Alvos</h2>
        <p>
          Sem alvos, a promoção aplica-se ao carrinho inteiro. Cada linha abaixo
          restringe a regra.
        </p>
        {promotion.targets.map((target, index) => (
          <article key={index}>
            <label>
              Produto
              <select
                value={target.productId ?? ''}
                onChange={(event) =>
                  updateTarget(index, { productId: event.target.value || null })
                }
              >
                <option value="">Qualquer produto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select
                value={target.categoryId ?? ''}
                onChange={(event) =>
                  updateTarget(index, {
                    categoryId: event.target.value || null,
                  })
                }
              >
                <option value="">Qualquer categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantidade mínima
              <input
                type="number"
                min="1"
                value={target.minimumQuantity ?? ''}
                onChange={(event) =>
                  updateTarget(index, {
                    minimumQuantity: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label>
              ID da tabela de preços B2B
              <input
                value={target.priceListId ?? ''}
                onChange={(event) =>
                  updateTarget(index, {
                    priceListId: event.target.value || null,
                  })
                }
                placeholder="Opcional"
              />
            </label>
            <label>
              ID da conta empresarial
              <input
                value={target.businessAccountId ?? ''}
                onChange={(event) =>
                  updateTarget(index, {
                    businessAccountId: event.target.value || null,
                  })
                }
                placeholder="Opcional"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setPromotion({
                  ...promotion,
                  targets: promotion.targets.filter(
                    (_, targetIndex) => targetIndex !== index,
                  ),
                })
              }
            >
              Remover alvo
            </button>
          </article>
        ))}
        <button
          type="button"
          onClick={() =>
            setPromotion({ ...promotion, targets: [...promotion.targets, {}] })
          }
        >
          Adicionar alvo
        </button>
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
