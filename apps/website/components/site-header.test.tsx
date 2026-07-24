import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ShopProvider } from './shop-context';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  it('opens and closes the mobile navigation', async () => {
    const user = userEvent.setup();
    render(
      <ShopProvider>
        <SiteHeader />
      </ShopProvider>,
    );

    const openButton = screen.getByRole('button', { name: 'Abrir menu' });
    await user.click(openButton);

    expect(openButton).toHaveAttribute('aria-expanded', 'true');
    const navigation = screen.getByRole('navigation', {
      name: 'Navegação móvel',
    });
    expect(navigation).toHaveClass('mobile-navigation-open');

    await user.click(
      within(navigation).getByRole('button', { name: 'Fechar menu' }),
    );
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
  });
});
