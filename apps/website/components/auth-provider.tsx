'use client';

import { ApiClient, ApiError } from '@nsabores/api-client';
import type { AuthUser } from '@nsabores/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string;
  clearError: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (body: Record<string, unknown>) => Promise<AuthUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setUser(await api.get<AuthUser>('/v1/auth/me'));
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 401) {
        setError(reason instanceof Error ? reason.message : 'Erro de sessão.');
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);

  const authenticate = async (path: string, body: Record<string, unknown>) => {
    setError('');
    try {
      const result = await api.post<{ user: AuthUser }>(path, body);
      setUser(result.user);
      await api.post('/v1/cart/merge').catch(() => undefined);
      window.dispatchEvent(new Event('nsabores-cart-refresh'));
      return result.user;
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Não foi possível autenticar.';
      setError(message);
      throw reason;
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      clearError: () => setError(''),
      login: (email, password) =>
        authenticate('/v1/auth/login', { email, password }),
      register: (body) => authenticate('/v1/auth/register', body),
      logout: async () => {
        await api.post('/v1/auth/logout');
        setUser(null);
      },
      reload,
    }),
    [error, loading, reload, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export { api as accountApi };
