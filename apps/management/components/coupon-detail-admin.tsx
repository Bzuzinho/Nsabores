'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Promotion = {
  id: string;
  name: string;
  code: string;
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
};

type Redemption = {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string | null;
  businessAccountId: string | null;
  amountCents: number;
  idempotencyKey: string;
  redeemedAt: string;
};

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );

const toInputDate = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : '';

export function CouponDetailAdmin({ id }: { id: string }) {
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [couponRow, promotionRows, redemptionRows] = await Promise.all([
      managementApi.get<Coupon>(`/v1/admin/coupons/${id}`),
      managementApi.get<Promotion[]>('/v1/admin/promotions'),
      managementApi.get<Redemption[]>(`/v1/admin/coupons/${id}/redemptions`),
    ]);
    setCoupon(couponRow);
    setPromotions(promotionRows);
    setRedemptions(redemptionRows);
  }, [id]);

  useEffect(() => {
    // Initial API hydration intentionally updates local component state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload().catch((reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o cupão.',
      ),
    );
  }, [reload]);

  if (error && !coupon)
    return <div className="admin-state admin-error">{error}</div>;
  if (!coupon) return <div className="admin-state">A carregar cupão…</div>;
  const loadedCoupon = coupon;

  async function save() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await managementApi.patch(`/v1/admin/coupons/${loadedCoupon.id}`, {
        promotionId: loadedCoupon.promotionId,
        code: loadedCoupon.code,
        isActive: loadedCoupon.isActive,
        validFrom: loadedCoupon.validFrom || undefined,
        validUntil: loadedCoupon.validUntil || undefined,
        usageLimit: loadedCoupon.usageLimit ?? undefined,
        perUserLimit: loadedCoupon.perUserLimit ?? undefined,
        channel: loadedCoupon.channel,
        minimumCartCents: loadedCoupon.minimumCartCents ?? undefined,
      });
      await reload();
      setMessage('Cupão atualizado.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar o cupão.',
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
          <h1>{coupon.code}</h1>
          <p>Configuração e auditoria de utilizações.</p>
        </div>
        <Link href="/cupoes">Voltar aos cupões</Link>
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
          Promoção
          <select
            value={coupon.promotionId}
            onChange={(event) =>
              setCoupon({ ...coupon, promotionId: event.target.value })
            }
          >
            {promotions.map((promotion) => (
              <option key={promotion.id} value={promotion.id}>
                {promotion.name} · {promotion.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Código
          <input
            value={coupon.code}
            maxLength={80}
            onChange={(event) =>
              setCoupon({ ...coupon, code: event.target.value })
            }
          />
        </label>
        <label>
          Canal
          <select
            value={coupon.channel}
            onChange={(event) =>
              setCoupon({
                ...coupon,
                channel: event.target.value as Coupon['channel'],
              })
            }
          >
            <option>BOTH</option>
            <option>B2C</option>
            <option>B2B</option>
          </select>
        </label>
        <label>
          Válido desde
          <input
            type="datetime-local"
            value={toInputDate(coupon.validFrom)}
            onChange={(event) =>
              setCoupon({
                ...coupon,
                validFrom: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              })
            }
          />
        </label>
        <label>
          Válido até
          <input
            type="datetime-local"
            value={toInputDate(coupon.validUntil)}
            onChange={(event) =>
              setCoupon({
                ...coupon,
                validUntil: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              })
            }
          />
        </label>
        <label>
          Limite total
          <input
            type="number"
            min="1"
            value={coupon.usageLimit ?? ''}
            onChange={(event) =>
              setCoupon({
                ...coupon,
                usageLimit: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label>
          Limite por utilizador
          <input
            type="number"
            min="1"
            value={coupon.perUserLimit ?? ''}
            onChange={(event) =>
              setCoupon({
                ...coupon,
                perUserLimit: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label>
          Carrinho mínimo (cêntimos)
          <input
            type="number"
            min="0"
            value={coupon.minimumCartCents ?? ''}
            onChange={(event) =>
              setCoupon({
                ...coupon,
                minimumCartCents: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={coupon.isActive}
            onChange={(event) =>
              setCoupon({ ...coupon, isActive: event.target.checked })
            }
          />{' '}
          Cupão ativo
        </label>
        <button
          className="admin-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? 'A guardar…' : 'Guardar alterações'}
        </button>
      </section>

      <section className="user-detail">
        <h2>Utilizações</h2>
        <p>{redemptions.length} utilização(ões) confirmada(s).</p>
        {!redemptions.length && (
          <p>Este cupão ainda não foi consumido por nenhuma encomenda paga.</p>
        )}
        {redemptions.map((redemption) => (
          <article key={redemption.id}>
            <p>
              <strong>{redemption.orderNumber}</strong> ·{' '}
              {money(redemption.amountCents)}
            </p>
            <p>{new Date(redemption.redeemedAt).toLocaleString('pt-PT')}</p>
            <p>
              {redemption.businessAccountId
                ? `Conta B2B: ${redemption.businessAccountId}`
                : redemption.userId
                  ? `Utilizador: ${redemption.userId}`
                  : 'Compra sem utilizador associado'}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
