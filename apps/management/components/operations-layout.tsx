import type { ReactNode } from 'react';
import { AuthGate } from './management-auth';
import { ManagementShell } from './management-shell';

export function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ManagementShell>{children}</ManagementShell>
    </AuthGate>
  );
}
