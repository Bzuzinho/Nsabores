import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShopProvider } from '@/components/shop-context';
import Home from './page';

describe('homepage', () => {
  it('renders the approved hero and principal sections', async () => {
    const page = await Home();
    render(<ShopProvider>{page}</ShopProvider>);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /sabores que.*contam histórias/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Comprar por ocasião',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Destaques' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Uma seleção exclusiva à sua porta.',
      }),
    ).toBeInTheDocument();
  });
});
