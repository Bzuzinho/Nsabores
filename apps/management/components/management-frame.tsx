'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AuthGate } from './management-auth';
import {
  findManagementRoute,
  normalizeManagementPath,
} from './management-routes';
import { ManagementShell } from './management-shell';

export function ManagementFrame({ children }: { children: ReactNode }) {
  const pathname = normalizeManagementPath(usePathname());
  const route = findManagementRoute(pathname);

  if (pathname === '/login' || pathname === '/sem-acesso') return children;

  const content =
    route?.phase === 'phase2' ? (
      <section className="admin-card">
        <p className="eyebrow">Fase 2</p>
        <h1>Funcionalidade prevista para uma fase posterior</h1>
        <p>
          Este módulo não faz parte do arranque aprovado pelo cliente e está
          indisponível na versão de produção atual.
        </p>
        <Link className="admin-primary" href="/">
          Voltar ao painel
        </Link>
      </section>
    ) : (
      children
    );

  return (
    <AuthGate roles={route?.adminOnly ? ['ADMIN'] : ['STAFF', 'ADMIN']}>
      <ManagementShell>{content}</ManagementShell>
    </AuthGate>
  );
}
