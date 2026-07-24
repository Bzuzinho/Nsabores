'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatPrice, products } from '@/data/site';
import { BagIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from './icons';
import { MobileNavigation, navigation } from './mobile-navigation';
import { useShop } from './shop-context';

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const {
    cartCount,
    cartItems,
    cartOpen,
    closeCart,
    openCart,
    removeFromCart,
  } = useShop();

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) return [];
    return products.filter((product) =>
      `${product.name} ${product.description}`
        .toLocaleLowerCase('pt-PT')
        .includes(normalized),
    );
  }, [query]);

  const total = cartItems.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );

  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Nsabores, início">
          <span className="brand-emblem" aria-hidden="true">
            ◒
          </span>
          <span className="brand-name">Nsabores</span>
          <span className="brand-tagline">Mercearia gourmet</span>
        </Link>

        <nav className="desktop-navigation" aria-label="Navegação principal">
          {navigation.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <button
            className="icon-button desktop-action"
            type="button"
            aria-label="Pesquisar"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon />
          </button>
          <Link
            className="icon-button desktop-action"
            href="/conta"
            aria-label="A minha conta"
          >
            <UserIcon />
          </Link>
          <button
            className="cart-button"
            type="button"
            aria-label={`Abrir carrinho, ${cartCount} artigos`}
            onClick={openCart}
          >
            <BagIcon />
            <span>{cartCount}</span>
          </button>
          <button
            className="icon-button menu-toggle"
            type="button"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      <MobileNavigation open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div
        className={`search-overlay ${searchOpen ? 'search-overlay-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!searchOpen}
        inert={!searchOpen}
        aria-label="Pesquisa de produtos"
      >
        <div className="search-panel">
          <button
            className="dialog-close"
            type="button"
            aria-label="Fechar pesquisa"
            onClick={() => {
              setSearchOpen(false);
              setQuery('');
            }}
          >
            <CloseIcon />
          </button>
          <p className="eyebrow">Pesquisa</p>
          <h2>O que procura?</h2>
          <label htmlFor="site-search">Produto ou experiência</label>
          <input
            id="site-search"
            type="search"
            placeholder="Queijo, cabaz, tábua…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="search-results" aria-live="polite">
            {query &&
              (results.length ? (
                results.map((product) => (
                  <Link
                    href="/loja"
                    key={product.id}
                    onClick={() => setSearchOpen(false)}
                  >
                    <span>{product.name}</span>
                    <strong>{formatPrice(product.priceCents)}</strong>
                  </Link>
                ))
              ) : (
                <p>Não encontrámos resultados para “{query}”.</p>
              ))}
          </div>
        </div>
      </div>

      <aside
        className={`cart-drawer ${cartOpen ? 'cart-drawer-open' : ''}`}
        aria-hidden={!cartOpen}
        inert={!cartOpen}
        aria-label="Carrinho"
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Seleção atual</p>
            <h2>O seu carrinho</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar carrinho"
            onClick={closeCart}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="cart-items">
          {cartItems.length ? (
            cartItems.map((item) => (
              <article className="cart-item" key={item.id}>
                <Image src={item.imageUrl} alt="" width={72} height={72} />
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.quantity} × {formatPrice(item.priceCents)}
                  </small>
                </div>
                <button type="button" onClick={() => removeFromCart(item.id)}>
                  Remover
                </button>
              </article>
            ))
          ) : (
            <div className="empty-cart">
              <BagIcon width={32} height={32} />
              <p>O carrinho está vazio.</p>
              <Link href="/loja" onClick={closeCart}>
                Explorar produtos
              </Link>
            </div>
          )}
        </div>
        <div className="cart-summary">
          <span>Total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <button className="button button-primary" type="button" disabled>
          Checkout brevemente
        </button>
      </aside>
      <button
        className={`page-backdrop cart-backdrop ${
          cartOpen ? 'page-backdrop-visible' : ''
        }`}
        type="button"
        tabIndex={cartOpen ? 0 : -1}
        aria-label="Fechar carrinho"
        onClick={closeCart}
      />
    </>
  );
}
