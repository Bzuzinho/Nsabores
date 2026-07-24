import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountScreen } from './account-screen';

const push = vi.fn();
const login = vi.fn();
const register = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('./auth-provider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: '',
    login,
    register,
    logout: vi.fn(),
    reload: vi.fn(),
  }),
  accountApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('account authentication screens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits login and redirects to the account', async () => {
    login.mockResolvedValue({ id: 'one' });
    const user = userEvent.setup();
    render(<AccountScreen mode="login" />);
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(login).toHaveBeenCalledWith('ana@example.com', 'Password123');
    expect(push).toHaveBeenCalledWith('/conta');
  });

  it('registers with explicit marketing consent and shows errors', async () => {
    register.mockRejectedValueOnce(new Error('Dados inválidos.'));
    const user = userEvent.setup();
    render(<AccountScreen mode="register" />);
    await user.type(screen.getByLabelText('Nome'), 'Ana');
    await user.type(screen.getByLabelText('Apelido'), 'Silva');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByLabelText('Quero receber novidades Nsabores'));
    await user.click(screen.getByRole('button', { name: 'Registar' }));
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ marketingConsent: true }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dados inválidos.',
    );
  });
});
