'use client';

import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/data/site';
import { useShop } from '@/components/shop-context';

export default function CartPage() {
  const { cart, cartItems, removeFromCart, updateQuantity } = useShop();
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
            <p>
              <strong>Subtotal: {formatPrice(cart?.subtotalCents ?? 0)}</strong>
            </p>
            <Link className="button button-primary" href="/checkout">
              Continuar para checkout
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
