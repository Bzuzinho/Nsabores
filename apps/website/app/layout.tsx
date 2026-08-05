import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShopProvider } from '@/components/shop-context';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';
import './responsive-overrides.css';
import './website-fixes.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nsabores.pt',
  ),
  title: {
    default: 'Nsabores — Sabores que ficam',
    template: '%s | Nsabores',
  },
  description:
    'Produtos portugueses escolhidos com critério, experiências à medida e atendimento próximo.',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    siteName: 'Nsabores',
    title: 'Nsabores — Sabores que ficam',
    description:
      'Mais do que produtos. Criamos experiências com sabores portugueses.',
    images: [
      {
        url: '/images/hero-reference-clean.jpg',
        width: 1440,
        height: 900,
        alt: 'Seleção Nsabores de queijos, enchidos e frutos secos',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <ShopProvider>
          <AuthProvider>
            <a className="skip-link" href="#conteudo">
              Saltar para o conteúdo
            </a>
            <SiteHeader />
            {children}
            <SiteFooter />
          </AuthProvider>
        </ShopProvider>
      </body>
    </html>
  );
}
