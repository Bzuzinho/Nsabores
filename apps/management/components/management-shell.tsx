'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { useManagementAuth } from './management-auth';
import {
  findManagementRoute,
  managementGroupDashboards,
  managementGroups,
  managementRoutes,
} from './management-routes';

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function MenuIcon({ close = false }: { close?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {close ? (
        <>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`management-chevron ${open ? 'is-open' : ''}`}
      viewBox="0 0 24 24"
    >
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

function NavMark({ group }: { group: string }) {
  const letter =
    group === 'Visão geral'
      ? 'G'
      : group === 'Compras e stock'
        ? 'S'
        : group.charAt(0);
  return <span className="management-nav-mark">{letter}</span>;
}

export function ManagementShell({ children }: { children: ReactNode }) {
  const websiteUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
  const logoUrl = `${websiteUrl.replace(/\/$/, '')}/images/logo-nsabores-white.png`;
  const auth = useManagementAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const routes = useMemo(
    () =>
      managementRoutes.filter(
        (route) => !route.adminOnly || auth.user?.role === 'ADMIN',
      ),
    [auth.user?.role],
  );
  const current = findManagementRoute(pathname) ?? managementRoutes[0]!;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set([current.group]),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-PT');
  const results = normalizedQuery
    ? routes.filter((route) =>
        [route.label, route.description, route.group, ...(route.keywords ?? [])]
          .join(' ')
          .toLocaleLowerCase('pt-PT')
          .includes(normalizedQuery),
      )
    : routes.slice(0, 8);

  const closeNavigation = () => setNavigationOpen(false);

  const openGroup = (group: (typeof managementGroups)[number]) => {
    const hasChildren = routes.some(
      (route) =>
        route.group === group &&
        route.href !== managementGroupDashboards[group],
    );
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
    router.push(managementGroupDashboards[group]);
    if (!hasChildren) closeNavigation();
  };

  return (
    <div className="management-shell">
      <aside
        className={`management-sidebar ${navigationOpen ? 'is-open' : ''}`}
      >
        <div className="management-sidebar-head">
          <Link className="management-brand" href="/" onClick={closeNavigation}>
            <Image
              unoptimized
              className="management-brand-logo"
              src={logoUrl}
              alt="Nsabores"
              width={1789}
              height={512}
              priority
            />
            <small>Gestão</small>
          </Link>
          <button
            className="management-icon-button management-close-nav"
            type="button"
            aria-label="Fechar navegação"
            onClick={closeNavigation}
          >
            <MenuIcon close />
          </button>
        </div>

        <button
          className="management-search-trigger"
          type="button"
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon />
          <span>Pesquisar na gestão</span>
          <kbd>⌘ K</kbd>
        </button>

        <nav aria-label="Navegação da gestão">
          {managementGroups.map((group) => {
            const groupRoutes = routes.filter((route) => route.group === group);
            if (!groupRoutes.length) return null;
            const dashboardHref = managementGroupDashboards[group];
            const childRoutes = groupRoutes.filter(
              (route) => route.href !== dashboardHref,
            );
            const expanded = expandedGroups.has(group);
            return (
              <section className="management-nav-group" key={group}>
                <button
                  className={current.group === group ? 'active' : ''}
                  type="button"
                  aria-expanded={childRoutes.length ? expanded : undefined}
                  onClick={() => openGroup(group)}
                >
                  <NavMark group={group} />
                  <span>{group}</span>
                  {childRoutes.length > 0 && <ChevronIcon open={expanded} />}
                </button>
                {expanded && childRoutes.length > 0 && (
                  <div className="management-nav-children">
                    {childRoutes.map((route) => (
                      <Link
                        className={current.href === route.href ? 'active' : ''}
                        href={route.href}
                        key={route.href}
                        onClick={closeNavigation}
                      >
                        {route.label}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <div className="management-user">
          <span className="management-avatar">
            {auth.user?.firstName?.charAt(0)}
            {auth.user?.lastName?.charAt(0)}
          </span>
          <span>
            <strong>
              {auth.user?.firstName} {auth.user?.lastName}
            </strong>
            <small>
              {auth.user?.role === 'ADMIN' ? 'Administrador' : 'Equipa'}
            </small>
          </span>
          <button
            type="button"
            onClick={() => void auth.logout().then(() => router.push('/login'))}
          >
            Sair
          </button>
        </div>
      </aside>

      <button
        className={`management-nav-backdrop ${navigationOpen ? 'is-visible' : ''}`}
        type="button"
        aria-label="Fechar navegação"
        tabIndex={navigationOpen ? 0 : -1}
        onClick={closeNavigation}
      />

      <div className="management-workspace">
        <header className="management-topbar">
          <button
            className="management-icon-button management-menu-button"
            type="button"
            aria-label="Abrir navegação"
            onClick={() => setNavigationOpen(true)}
          >
            <MenuIcon />
          </button>
          <div>
            <small>{current.group}</small>
            <strong>{current.label}</strong>
          </div>
          <span className="management-topbar-spacer" />
          <button
            className="management-icon-button"
            type="button"
            aria-label="Pesquisar na gestão"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon />
          </button>
          <Link className="management-site-link" href={websiteUrl}>
            Ver website <ArrowIcon />
          </Link>
        </header>
        <main className="management-content">{children}</main>
      </div>

      <div
        className={`management-command ${searchOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!searchOpen}
        inert={!searchOpen}
        aria-label="Pesquisa rápida"
      >
        <button
          className="management-command-backdrop"
          type="button"
          aria-label="Fechar pesquisa"
          onClick={() => setSearchOpen(false)}
        />
        <section>
          <div className="management-command-input">
            <SearchIcon />
            <input
              autoFocus={searchOpen}
              type="search"
              placeholder="Produtos, encomendas, stock…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchOpen(false);
              }}
            />
            <button type="button" onClick={() => setSearchOpen(false)}>
              Esc
            </button>
          </div>
          <div className="management-command-results">
            {results.map((route) => (
              <Link
                href={route.href}
                key={route.href}
                onClick={() => {
                  setExpandedGroups(
                    (previous) => new Set([...previous, route.group]),
                  );
                  setSearchOpen(false);
                  setQuery('');
                }}
              >
                <span>
                  <strong>{route.label}</strong>
                  <small>{route.description}</small>
                </span>
                <ArrowIcon />
              </Link>
            ))}
            {!results.length && <p>Não encontrámos esse módulo.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
