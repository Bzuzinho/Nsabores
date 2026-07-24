import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ManagementAuthProvider } from '@/components/management-auth';

export const metadata: Metadata = {
  title: 'Gestão Nsabores',
  description: 'Aplicação interna de gestão da Nsabores.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <ManagementAuthProvider>{children}</ManagementAuthProvider>
      </body>
    </html>
  );
}
