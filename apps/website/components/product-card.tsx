'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/data/site';
import { formatPrice } from '@/data/site';
import { useShop } from './shop-context';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useShop();

  return (
    <article className="product-card">
      <Image
        src={product.imageUrl}
        alt={`${product.name}, produto português selecionado pela Nsabores`}
        width={640}
        height={480}
      />
      <div className="product-info">
        <small>{product.category.name}</small>
        <h3>
          <Link href={`/loja/${product.slug}`}>{product.name}</Link>
        </h3>
        <p>{product.shortDescription}</p>
        <div className="product-meta">
          <strong>{formatPrice(product.priceCents)}</strong>
          <button
            className="add-button"
            type="button"
            aria-label={`Adicionar ${product.name} ao carrinho`}
            onClick={() => void addToCart(product).catch(() => undefined)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </article>
  );
}
