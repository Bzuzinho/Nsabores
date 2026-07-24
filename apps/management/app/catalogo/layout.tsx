import type { ReactNode } from 'react';
import { ManagementShell } from '@/components/management-shell';
import { AuthGate } from '@/components/management-auth';

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ManagementShell>{children}</ManagementShell>
    </AuthGate>
  );
}
