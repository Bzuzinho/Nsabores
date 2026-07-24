'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useManagementAuth } from './management-auth';

export function ManagementShell({ children }: { children: ReactNode }) {
  const auth = useManagementAuth();
  const router = useRouter();
  return (
    <div className="management-shell">
      <aside>
        <Link className="management-brand" href="/catalogo">
          Nsabores <small>Gestão</small>
        </Link>
        <nav>
          <Link href="/catalogo">Visão geral</Link>
          <Link href="/catalogo/produtos">Produtos</Link>
          <Link href="/catalogo/categorias">Categorias</Link>
          {auth.user?.role === 'ADMIN' && (
            <Link href="/utilizadores">Utilizadores</Link>
          )}
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
