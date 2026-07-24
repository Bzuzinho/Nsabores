import type { ReactNode } from 'react';
import { AuthGate } from '@/components/management-auth';
import { ManagementShell } from '@/components/management-shell';
export default function UsersLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate roles={['ADMIN']}>
      <ManagementShell>{children}</ManagementShell>
    </AuthGate>
  );
}
