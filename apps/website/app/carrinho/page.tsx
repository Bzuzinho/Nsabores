'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { formatPrice } from '@/data/site';
import { useShop } from '@/components/shop-context';

export default function CartPage() {
  const {
    cart,
    cartItems,
    applyCoupon,
    removeCoupon,
    removeFromCart,
    updateQuantity,
  } = useShop();
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);

  async function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    setCouponError('');
    try {
      await applyCoupon(couponCode);
      setCouponCode('');
    } catch (reason) {
      setCouponError(
        reason instanceof Error ? reason.message : 'Não foi possível aplicar o cupão.',
      );
    } finally {
      setCouponBusy(false);
    }
  }

  async function clearCoupon() {
    setCouponBusy(true);
    setCouponError('');
    try {
      await removeCoupon();
    } catch (reason) {
      setCouponError(
        reason instanceof Error ? reason.message : 'Não foi possível remover o cupão.',
      );
    } finally {
      setCouponBusy(false);
    }
  }

  return (
    <main id="conteudo" className="account-page">
      <section className="account-card">
        <p className="eyebrow">Compra</p>
        <h1>O seu carrinho</h1>
        {!cartItems.length ? (
          <p>
            O carrinho está vazio. <Link href="/loja">Explorar a loja</Link>
          </p>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map((item) => (
                <article className="cart-item" key={item.id}>
                  <Image
                    src={item.product.imageUrl}
                    alt=""
                    width={88}
                    height={88}
                  />
                  <div>
                    <strong>{item.product.name}</strong>
                    <small>{formatPrice(item.unitPriceCents)}</small>
                    <label>
                      Quantidade
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={item.quantity}
                        onChange={(event) =>
                          void updateQuantity(
                            item.id,
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeFromCart(item.id)}
                  >
                    Remover
                  </button>
                </article>
              ))}
            </div>

            <div className="cart-summary">
              <p>Subtotal: {formatPrice(cart?.subtotalCents ?? 0)}</p>
              {(cart?.discounts ?? []).map((discount, index) => (
                <p key={`${discount.promotionId ?? discount.label}-${index}`}>
                  {discount.label}
                  {discount.code ? ` (${discount.code})` : ''}: −
                  {formatPrice(discount.amountCents)}
                </p>
              ))}
              {(cart?.discountCents ?? 0) > 0 && (
                <p>
                  <strong>
                    Descontos: −{formatPrice(cart?.discountCents ?? 0)}
                  </strong>
                </p>
              )}
              <p>
                <strong>
                  Total antes da entrega:{' '}
                  {formatPrice(
                    cart?.totalCents ??
                      Math.max(
                        0,
                        (cart?.subtotalCents ?? 0) - (cart?.discountCents ?? 0),
                      ),
                  )}
                </strong>
              </p>
            </div>

            {cart?.coupon ? (
              <div className="coupon-box">
                <p>
                  Cupão aplicado: <strong>{cart.coupon.code}</strong>
                </p>
                <button
                  type="button"
                  disabled={couponBusy}
                  onClick={() => void clearCoupon()}
                >
                  Remover cupão
                </button>
              </div>
            ) : (
              <form className="coupon-box" onSubmit={submitCoupon}>
                <label>
                  Código promocional
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    maxLength={80}
                    autoComplete="off"
                    placeholder="Ex.: BEMVINDO10"
                  />
                </label>
                <button type="submit" disabled={couponBusy || !couponCode.trim()}>
                  {couponBusy ? 'A validar…' : 'Aplicar cupão'}
                </button>
              </form>
            )}
            {couponError && <p role="alert">{couponError}</p>}

            <Link className="button button-primary" href="/checkout">
              Continuar para checkout
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
