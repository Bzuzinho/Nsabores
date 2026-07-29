import type { ReactNode } from 'react';
import { OperationsLayout } from '../../components/operations-layout';

export default function Layout({ children }: { children: ReactNode }) {
  return <OperationsLayout>{children}</OperationsLayout>;
}
