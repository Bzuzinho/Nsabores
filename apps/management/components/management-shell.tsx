'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useManagementAuth } from './management-auth';
import { managementRoutes } from './management-routes';

export function ManagementShell({ children }: { children: ReactNode }) {
  const auth = useManagementAuth();
  const router = useRouter();
  const routes = managementRoutes.filter(
    (route) => !route.adminOnly || auth.user?.role === 'ADMIN',
  );

  return (
    <div className="management-shell">
      <aside>
        <Link className="management-brand" href="/catalogo">
          Nsabores <small>Gestão</small>
        </Link>
        <nav>
          {routes.map((route) => (
            <Link href={route.href} key={route.href}>
              {route.label}
            </Link>
          ))}
        </nav>
        <div className="management-user">
          <span>
            {auth.user?.firstName} {auth.user?.lastName}
          </span>
          <small>{auth.user?.role}</small>
          <button
            onClick={() => void auth.logout().then(() => router.push('/login'))}
          >
            Sair
          </button>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
