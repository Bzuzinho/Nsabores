import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findManagementRoute,
  managementRoutes,
  normalizeManagementPath,
  routeIsActive,
} from './management-routes';

const requiredOperationalRoutes = [
  '/',
  '/operacoes',
  '/operacoes/preparacao',
  '/operacoes/producao',
  '/expedicoes',
  '/devolucoes',
  '/apoio',
  '/stock/movimentos',
  '/clube/subscricoes',
  '/clube/cobrancas',
  '/documentos/reconciliacao',
];

describe('management principal routes', () => {
  it('has no duplicated links', () => {
    const hrefs = managementRoutes.map((route) => route.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(managementRoutes)('$href has a page implementation', (route) => {
    expect(existsSync(resolve(process.cwd(), route.pageFile))).toBe(true);
  });

  it.each(requiredOperationalRoutes)('exposes %s in navigation', (href) => {
    expect(managementRoutes.some((route) => route.href === href)).toBe(true);
  });

  it('normalizes the public base path and resolves the most specific module', () => {
    expect(normalizeManagementPath('/gestao/compras/123')).toBe('/compras/123');
    expect(routeIsActive('/gestao/compras/123', '/compras')).toBe(true);
    expect(findManagementRoute('/gestao/catalogo/produtos/123')?.href).toBe(
      '/catalogo/produtos',
    );
  });
});
