import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from './page';

describe('AboutPage', () => {
  it('renders meaningful institutional content', () => {
    render(<AboutPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Escolhemos sabores que merecem ser partilhados.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Critério na escolha. Cuidado em cada detalhe.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Valorizamos produtores e sabores genuinamente portugueses.',
      ),
    ).toBeInTheDocument();
  });
});
