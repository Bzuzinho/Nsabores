'use client';

import { ApiClient, ApiError } from '@nsabores/api-client';
import type { AuthUser, UserRole } from '@nsabores/types';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export const managementApi = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : ''),
);

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const Context = createContext<AuthValue | null>(null);

export function ManagementAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setUser(await managementApi.get('/v1/auth/me'));
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 401)
        console.error(reason);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const result = await managementApi.post<{ user: AuthUser }>(
          '/v1/auth/login',
          { email, password },
        );
        setUser(result.user);
        return result.user;
      },
      logout: async () => {
        await managementApi.post('/v1/auth/logout');
        setUser(null);
      },
      reload,
    }),
    [loading, reload, user],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useManagementAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('Management auth provider missing');
  return value;
}

export function AuthGate({
  children,
  roles = ['STAFF', 'ADMIN'],
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useManagementAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (!loading && user && !roleHasAccess(user.role, roles)) {
      router.replace('/sem-acesso');
    }
  }, [loading, roles, router, user]);
  if (loading || !user || !roleHasAccess(user.role, roles)) {
    return (
      <div className="admin-state" aria-busy="true">
        A validar acesso...
      </div>
    );
  }
  return children;
}

export function roleHasAccess(role: UserRole, allowed: UserRole[]) {
  return allowed.includes(role);
}
