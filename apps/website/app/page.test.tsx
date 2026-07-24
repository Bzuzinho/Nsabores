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
        name: /mais do que produtos.*criamos experiências/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'As nossas melhores experiências',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Os mais procurados' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Uma seleção exclusiva à sua porta.',
      }),
    ).toBeInTheDocument();
  });
});
