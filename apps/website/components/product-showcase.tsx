'use client';

import { useState } from 'react';
import { products, type ProductCategory } from '@/data/site';
import { ProductCard } from './product-card';
import { SectionHeading } from './section-heading';

type Filter = 'all' | ProductCategory;

const filters: Array<[Filter, string]> = [
  ['all', 'Todos'],
  ['tabuas', 'Tábuas'],
  ['queijos', 'Queijos'],
  ['cabazes', 'Cabazes'],
  ['vinhos', 'Vinhos'],
];

export function ProductShowcase() {
  const [filter, setFilter] = useState<Filter>('all');
  const visibleProducts =
    filter === 'all'
      ? products
      : products.filter((product) => product.category === filter);

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
          {filters.map(([value, label]) => (
            <button
              className={filter === value ? 'active' : ''}
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="product-grid" aria-live="polite">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
