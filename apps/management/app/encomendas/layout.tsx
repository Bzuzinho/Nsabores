import type { ReactNode } from 'react';
import { AuthGate } from '@/components/management-auth';
import { ManagementShell } from '@/components/management-shell';

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ManagementShell>{children}</ManagementShell>
    </AuthGate>
  );
}
