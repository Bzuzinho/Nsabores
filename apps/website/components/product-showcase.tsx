'use client';

import { useState } from 'react';
import type { CatalogCategory } from '@nsabores/types';
import type { Product } from '@/data/site';
import { ProductCard } from './product-card';
import { SectionHeading } from './section-heading';

export function ProductShowcase({
  products,
  categories,
  fallback = false,
}: {
  products: Product[];
  categories: CatalogCategory[];
  fallback?: boolean;
}) {
  const [filter, setFilter] = useState('all');
  const visibleProducts =
    filter === 'all'
      ? products
      : products.filter((product) => product.category.slug === filter);

  return (
    <section
      className="section product-section"
      aria-labelledby="products-title"
    >
      <div className="showcase-heading">
        <SectionHeading
          align="left"
          eyebrow="Escolhas do mês"
          id="products-title"
          title="Os mais procurados"
        />
        <div className="filters" aria-label="Filtros de produtos">
          {[{ slug: 'all', name: 'Todos' }, ...categories].map(
            ({ slug, name }) => (
              <button
                className={filter === slug ? 'active' : ''}
                type="button"
                key={slug}
                aria-pressed={filter === slug}
                onClick={() => setFilter(slug)}
              >
                {name}
              </button>
            ),
          )}
        </div>
      </div>
      {fallback && (
        <p className="catalog-notice" role="status">
          Catálogo temporariamente indisponível. A mostrar uma seleção de
          referência.
        </p>
      )}
      <div className="product-grid" aria-live="polite">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
