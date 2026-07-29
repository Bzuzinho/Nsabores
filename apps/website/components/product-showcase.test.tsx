import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductShowcase } from './product-showcase';
import { ShopProvider } from './shop-context';
import { products } from '@/data/site';

const categories = Array.from(
  new Map(
    products.map((product) => [
      product.category.id,
      {
        ...product.category,
        description: null,
        imageUrl: null,
        isActive: true,
        sortOrder: 0,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    ]),
  ).values(),
);

describe('ProductShowcase', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'cart-test',
              status: 'ACTIVE',
              currency: 'EUR',
              subtotalCents: 0,
              discountCents: 0,
              shippingCents: 0,
              totalCents: 0,
              itemCount: 0,
              items: [],
              coupon: null,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('filters products by category', async () => {
    const user = userEvent.setup();
    render(
      <ShopProvider>
        <ProductShowcase products={products} categories={categories} />
      </ShopProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Vinhos' }));

    expect(
      screen.getByRole('heading', { name: 'Vinho Tinto Reserva' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Tábua Premium' }),
    ).not.toBeInTheDocument();
  });

  it('adds a product to the cart API', async () => {
    const user = userEvent.setup();
    render(
      <ShopProvider>
        <ProductShowcase products={products} categories={categories} />
      </ShopProvider>,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Adicionar Tábua Premium ao carrinho',
      }),
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Tábua Premium adicionado ao carrinho.',
    );
  });
});
