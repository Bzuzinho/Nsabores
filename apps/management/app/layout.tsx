import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ManagementAuthProvider } from '@/components/management-auth';
import { ManagementFrame } from '@/components/management-frame';

export const metadata: Metadata = {
  title: 'Gestão Nsabores',
  description: 'Aplicação interna de gestão da Nsabores.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <ManagementAuthProvider>
          <ManagementFrame>{children}</ManagementFrame>
        </ManagementAuthProvider>
      </body>
    </html>
  );
}
