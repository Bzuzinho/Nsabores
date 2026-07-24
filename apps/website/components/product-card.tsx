'use client';

import Image from 'next/image';
import type { Product } from '@/data/site';
import { formatPrice } from '@/data/site';
import { useShop } from './shop-context';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useShop();

  return (
    <article className="product-card">
      <Image
        src={product.image}
        alt={`${product.name}, produto português selecionado pela Nsabores`}
        width={640}
        height={480}
      />
      <div className="product-info">
        <small>{product.categoryLabel}</small>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="product-meta">
          <strong>{formatPrice(product.price)}</strong>
          <button
            className="add-button"
            type="button"
            aria-label={`Adicionar ${product.name} ao carrinho`}
            onClick={() => addToCart(product)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </article>
  );
}
