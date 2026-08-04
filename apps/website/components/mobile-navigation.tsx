'use client';

import Link from 'next/link';
import { CloseIcon } from './icons';

export const navigation = [
  ['Início', '/'],
  ['Sobre nós', '/sobre'],
  ['Produtos', '/loja'],
  ['Experiências', '/eventos'],
  ['Serviços', '/servicos'],
  ['Blog', '/receitas'],
  ['Contactos', '/contactos'],
] as const;

interface MobileNavigationProps {
  onClose: () => void;
  open: boolean;
  showManagement?: boolean;
}

export function MobileNavigation({
  onClose,
  open,
  showManagement = false,
}: MobileNavigationProps) {
  return (
    <>
      <nav
        aria-label="Navegação móvel"
        aria-hidden={!open}
        inert={!open}
        className={`mobile-navigation ${open ? 'mobile-navigation-open' : ''}`}
      >
        <div className="mobile-navigation-header">
          <span>Menu</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {navigation.map(([label, href]) => (
          <Link href={href} key={href} onClick={onClose}>
            {label}
          </Link>
        ))}
        {showManagement && (
          <Link
            className="management-access-link"
            href="/gestao"
            onClick={onClose}
          >
            Entrar na gestão
          </Link>
        )}
      </nav>
      <button
        className={`page-backdrop ${open ? 'page-backdrop-visible' : ''}`}
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Fechar menu"
        onClick={onClose}
      />
    </>
  );
}
