import Link from 'next/link';
import type { ReactNode } from 'react';

export function ManagementShell({ children }: { children: ReactNode }) {
  return (
    <div className="management-shell">
      <aside>
        <Link className="management-brand" href="/catalogo">
          Nsabores <small>Gestão</small>
        </Link>
        <nav>
          <Link href="/catalogo">Visão geral</Link>
          <Link href="/catalogo/produtos">Produtos</Link>
          <Link href="/catalogo/categorias">Categorias</Link>
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  );
}
