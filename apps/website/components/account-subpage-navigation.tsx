'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const publicAccountRoutes = new Set([
  '/conta',
  '/conta/entrar',
  '/conta/registar',
  '/conta/recuperar-password',
  '/conta/redefinir-password',
  '/conta/verificar-email',
]);

export function AccountSubpageNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  if (publicAccountRoutes.has(pathname)) return null;

  return (
    <nav
      className="account-subpage-navigation"
      aria-label="Navegação da área de cliente"
    >
      <button type="button" onClick={() => router.back()}>
        ← Voltar
      </button>
      <Link href="/conta">Área de cliente</Link>
    </nav>
  );
}
