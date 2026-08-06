import { Suspense, type ReactNode } from 'react';
import { AccountSubpageNavigation } from '@/components/account-subpage-navigation';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="account-state" aria-busy="true">
          A carregar área de conta...
        </main>
      }
    >
      <AccountSubpageNavigation />
      {children}
    </Suspense>
  );
}
