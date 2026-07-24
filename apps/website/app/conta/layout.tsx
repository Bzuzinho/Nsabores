import { Suspense, type ReactNode } from 'react';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="account-state" aria-busy="true">
          A carregar área de conta...
        </main>
      }
    >
      {children}
    </Suspense>
  );
}
