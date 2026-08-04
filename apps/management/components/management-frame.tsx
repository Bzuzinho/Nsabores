'use client';

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

  return (
    <AuthGate roles={route?.adminOnly ? ['ADMIN'] : ['STAFF', 'ADMIN']}>
      <ManagementShell>{children}</ManagementShell>
    </AuthGate>
  );
}
