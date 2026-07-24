import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProductShowcase } from './product-showcase';
import { ShopProvider } from './shop-context';

describe('ProductShowcase', () => {
  it('filters products by category', async () => {
    const user = userEvent.setup();
    render(
      <ShopProvider>
        <ProductShowcase />
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

  it('adds a product to the local cart', async () => {
    const user = userEvent.setup();
    render(
      <ShopProvider>
        <ProductShowcase />
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
