'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

type PromotionTarget = {
  productId?: string | null;
  categoryId?: string | null;
  priceListId?: string | null;
  businessAccountId?: string | null;
  minimumQuantity?: number | null;
};

type Promotion = {
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
  targets?: PromotionTarget[];
};

type Coupon = {
  id: string;
  promotionId: string;
  code: string;
  isActive: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  channel: 'B2C' | 'B2B' | 'BOTH';
  minimumCartCents?: number | null;
  promotionName?: string;
  promotionCode?: string;
};

const optionalNumber = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? '').trim();
  return normalized ? Number(normalized) : undefined;
};

export function PromotionsAdmin() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setPromotions(
        await managementApi.get<Promotion[]>('/v1/admin/promotions'),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar as promoções.',
      );
    }
  }, []);

  useEffect(() => {
    // Initial synchronization with the management API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const benefitType = String(
      data.get('benefitType'),
    ) as Promotion['benefitType'];
    try {
      const created = await managementApi.post<Promotion>(
        '/v1/admin/promotions',
        {
          name: String(data.get('name')),
          code: String(data.get('code')),
          status: String(data.get('status')),
          benefitType,
          benefitValue:
            benefitType === 'QUANTITY_DEAL'
              ? 0
              : Number(data.get('benefitValue') ?? 0),
          channel: String(data.get('channel')),
          priority: Number(data.get('priority') ?? 0),
          stackable: data.get('stackable') === 'on',
          globalUsageLimit: optionalNumber(data.get('globalUsageLimit')),
          perCustomerLimit: optionalNumber(data.get('perCustomerLimit')),
          minimumCartCents: optionalNumber(data.get('minimumCartCents')),
          maximumDiscountCents: optionalNumber(
            data.get('maximumDiscountCents'),
          ),
          targets: [],
        },
      );
      if (benefitType === 'QUANTITY_DEAL') {
        const quantityBuy = Number(data.get('quantityBuy') ?? 3);
        const quantityPay = Number(data.get('quantityPay') ?? 2);
        if (quantityPay >= quantityBuy) {
          throw new Error('Em “Leve X, pague Y”, Y tem de ser inferior a X.');
        }
        await managementApi.patch(
          `/v1/admin/promotions/${created.id}/quantity-deal`,
          { quantityBuy, quantityPay },
        );
      }
      form.reset();
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar a promoção.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: Promotion['status']) {
    setBusy(true);
    setError('');
    try {
      const current = await managementApi.get<Promotion>(
        `/v1/admin/promotions/${id}`,
      );
      await managementApi.patch(`/v1/admin/promotions/${id}`, {
        name: current.name,
        code: current.code,
        status,
        benefitType: current.benefitType,
        benefitValue: current.benefitValue,
        channel: current.channel,
        startsAt: current.startsAt ?? undefined,
        endsAt: current.endsAt ?? undefined,
        priority: current.priority,
        stackable: current.stackable,
        globalUsageLimit: current.globalUsageLimit ?? undefined,
        perCustomerLimit: current.perCustomerLimit ?? undefined,
        minimumCartCents: current.minimumCartCents ?? undefined,
        maximumDiscountCents: current.maximumDiscountCents ?? undefined,
        targets: (current.targets ?? []).map((target) => ({
          productId: target.productId ?? undefined,
          categoryId: target.categoryId ?? undefined,
          priceListId: target.priceListId ?? undefined,
          businessAccountId: target.businessAccountId ?? undefined,
          minimumQuantity: target.minimumQuantity ?? undefined,
        })),
      });
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível alterar a promoção.',
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
          <h1>Promoções</h1>
          <p>Regras automáticas e campanhas por canal.</p>
        </div>
        <Link href="/promocoes/nova">Nova promoção</Link>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <section className="user-detail">
        <h2>Nova promoção</h2>
        <form className="auth-form" onSubmit={create}>
          <label>
            Nome
            <input name="name" required maxLength={150} />
          </label>
          <label>
            Código interno
            <input name="code" required maxLength={80} />
          </label>
          <label>
            Estado
            <select name="status" defaultValue="DRAFT">
              <option>DRAFT</option>
              <option>ACTIVE</option>
              <option>PAUSED</option>
            </select>
          </label>
          <label>
            Benefício
            <select name="benefitType" defaultValue="PERCENTAGE">
              <option>PERCENTAGE</option>
              <option>FIXED_AMOUNT</option>
              <option>FREE_SHIPPING</option>
              <option>SPECIAL_PRICE</option>
              <option>QUANTITY_DEAL</option>
            </select>
          </label>
          <label>
            Valor
            <input
              name="benefitValue"
              type="number"
              min="0"
              defaultValue="10"
            />
            <small>
              Percentagem: 0–100. Valores fixos/preço especial: cêntimos.
              Ignorado em QUANTITY_DEAL.
            </small>
          </label>
          <label>
            Leve
            <input name="quantityBuy" type="number" min="2" defaultValue="3" />
            <small>Apenas para QUANTITY_DEAL.</small>
          </label>
          <label>
            Pague
            <input name="quantityPay" type="number" min="1" defaultValue="2" />
            <small>Apenas para QUANTITY_DEAL.</small>
          </label>
          <label>
            Canal
            <select name="channel" defaultValue="BOTH">
              <option>BOTH</option>
              <option>B2C</option>
              <option>B2B</option>
            </select>
          </label>
          <label>
            Prioridade
            <input name="priority" type="number" defaultValue="0" required />
          </label>
          <label>
            <input name="stackable" type="checkbox" /> Pode acumular com outras
            promoções
          </label>
          <label>
            Utilizações globais
            <input name="globalUsageLimit" type="number" min="1" />
          </label>
          <label>
            Limite por cliente/empresa
            <input name="perCustomerLimit" type="number" min="1" />
          </label>
          <label>
            Carrinho mínimo (cêntimos)
            <input name="minimumCartCents" type="number" min="0" />
          </label>
          <label>
            Desconto máximo (cêntimos)
            <input name="maximumDiscountCents" type="number" min="0" />
          </label>
          <button className="admin-primary" disabled={busy}>
            Criar promoção
          </button>
        </form>
      </section>
      <section className="user-detail">
        <h2>Campanhas</h2>
        {!promotions.length && <p>Sem promoções criadas.</p>}
        {promotions.map((promotion) => (
          <article key={promotion.id}>
            <p>
              <strong>{promotion.name}</strong> · {promotion.code} ·{' '}
              {promotion.status}
            </p>
            <p>
              {promotion.benefitType}
              {promotion.benefitType === 'QUANTITY_DEAL'
                ? ` · leve ${promotion.quantityBuy ?? '?'} pague ${promotion.quantityPay ?? '?'}`
                : ` · valor ${promotion.benefitValue}`}{' '}
              · {promotion.channel} · prioridade {promotion.priority}
            </p>
            <div>
              {promotion.status !== 'ACTIVE' && (
                <button
                  className="admin-primary"
                  disabled={busy}
                  onClick={() => void setStatus(promotion.id, 'ACTIVE')}
                >
                  Ativar
                </button>
              )}
              {promotion.status === 'ACTIVE' && (
                <button
                  disabled={busy}
                  onClick={() => void setStatus(promotion.id, 'PAUSED')}
                >
                  Pausar
                </button>
              )}{' '}
              <Link href={`/promocoes/${promotion.id}`}>
                Editar regra e alvos
              </Link>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

export function CouponsAdmin() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [couponRows, promotionRows] = await Promise.all([
        managementApi.get<Coupon[]>('/v1/admin/coupons'),
        managementApi.get<Promotion[]>('/v1/admin/promotions'),
      ]);
      setCoupons(couponRows);
      setPromotions(promotionRows);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar os cupões.',
      );
    }
  }, []);

  useEffect(() => {
    // Initial synchronization with the management API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await managementApi.post('/v1/admin/coupons', {
        promotionId: String(data.get('promotionId')),
        code: String(data.get('code')),
        isActive: true,
        usageLimit: optionalNumber(data.get('usageLimit')),
        perUserLimit: optionalNumber(data.get('perUserLimit')),
        channel: String(data.get('channel')),
        minimumCartCents: optionalNumber(data.get('minimumCartCents')),
      });
      form.reset();
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar o cupão.',
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
          <h1>Cupões</h1>
          <p>Códigos promocionais associados a campanhas ativas.</p>
        </div>
      </header>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <section className="user-detail">
        <h2>Novo cupão</h2>
        <form className="auth-form" onSubmit={create}>
          <label>
            Promoção
            <select name="promotionId" required defaultValue="">
              <option value="" disabled>
                Selecionar…
              </option>
              {promotions.map((promotion) => (
                <option key={promotion.id} value={promotion.id}>
                  {promotion.name} · {promotion.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Código
            <input name="code" required maxLength={80} />
          </label>
          <label>
            Canal
            <select name="channel" defaultValue="BOTH">
              <option>BOTH</option>
              <option>B2C</option>
              <option>B2B</option>
            </select>
          </label>
          <label>
            Utilizações totais
            <input name="usageLimit" type="number" min="1" />
          </label>
          <label>
            Utilizações por utilizador
            <input name="perUserLimit" type="number" min="1" />
          </label>
          <label>
            Carrinho mínimo (cêntimos)
            <input name="minimumCartCents" type="number" min="0" />
          </label>
          <button
            className="admin-primary"
            disabled={busy || !promotions.length}
          >
            Criar cupão
          </button>
        </form>
      </section>
      <section className="user-detail">
        <h2>Códigos existentes</h2>
        {!coupons.length && <p>Sem cupões criados.</p>}
        {coupons.map((coupon) => (
          <article key={coupon.id}>
            <p>
              <strong>{coupon.code}</strong> ·{' '}
              {coupon.isActive ? 'Ativo' : 'Inativo'} · {coupon.channel}
            </p>
            <p>
              Promoção:{' '}
              {coupon.promotionName ??
                coupon.promotionCode ??
                coupon.promotionId}
            </p>
            <Link href={`/cupoes/${coupon.id}`}>
              Editar e consultar utilizações
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}
