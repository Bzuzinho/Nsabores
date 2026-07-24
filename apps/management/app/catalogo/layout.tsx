import type { ReactNode } from 'react';
import { ManagementShell } from '@/components/management-shell';

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return <ManagementShell>{children}</ManagementShell>;
}
