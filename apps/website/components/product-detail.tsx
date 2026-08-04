'use client';

import { ApiClient } from '@nsabores/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Product } from '@/data/site';
import { formatPrice } from '@/data/site';
import { useShop } from './shop-context';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : ''),
);

const availability = {
  IN_STOCK: 'Em stock',
  LOW_STOCK: 'Últimas unidades',
  OUT_OF_STOCK: 'Esgotado',
  PREORDER: 'Pré-encomenda',
} as const;

export function ProductDetail({ product }: { product: Product }) {
  const { addToCart } = useShop();
  const [isBundle, setIsBundle] = useState(false);
  const images = [
    product.imageUrl,
    ...product.gallery.filter((image) => image !== product.imageUrl),
  ];

  useEffect(() => {
    void api
      .get(`/v1/bundles/${product.slug}`)
      .then(() => setIsBundle(true))
      .catch(() => setIsBundle(false));
  }, [product.slug]);

  return (
    <article className="product-detail">
      <div className="product-gallery">
        {images.map((image, index) => (
          <Image
            key={image}
            src={image}
            alt={`${product.name}${index ? `, imagem ${index + 1}` : ''}`}
            width={900}
            height={700}
            priority={index === 0}
          />
        ))}
      </div>
      <div className="product-detail-copy">
        <p className="eyebrow">{product.category.name}</p>
        <h1>{product.name}</h1>
        <p>{product.description || product.shortDescription}</p>
        <strong className="detail-price">
          {formatPrice(product.priceCents)}
        </strong>
        <p>{availability[product.stockStatus]}</p>
        {isBundle ? (
          <Link
            className="button button-primary"
            href={`/loja/cabazes/${product.slug}/personalizar`}
          >
            Personalizar cabaz
          </Link>
        ) : (
          <button
            className="button button-primary"
            disabled={product.stockStatus === 'OUT_OF_STOCK'}
            onClick={() => void addToCart(product).catch(() => undefined)}
          >
            Adicionar ao carrinho
          </button>
        )}
      </div>
    </article>
  );
}
