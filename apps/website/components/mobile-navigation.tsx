'use client';

import Link from 'next/link';
import { CloseIcon } from './icons';

export const navigation = [
  ['Quem somos', '/sobre'],
  ['Loja', '/loja'],
  ['Serviços', '/servicos'],
  ['Clube Nsabores', '/clube'],
  ['Eventos', '/eventos'],
  ['Receitas', '/receitas'],
  ['Contactos', '/contactos'],
] as const;

interface MobileNavigationProps {
  onClose: () => void;
  open: boolean;
}

export function MobileNavigation({ onClose, open }: MobileNavigationProps) {
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
