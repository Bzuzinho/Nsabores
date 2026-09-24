import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findManagementRoute,
  isManagementRouteLive,
  liveManagementRoutes,
  managementRoutes,
  normalizeManagementPath,
  routeIsActive,
} from './management-routes';

const requiredOperationalRoutes = [
  '/',
  '/vendas',
  '/operacoes',
  '/operacoes/preparacao',
  '/operacoes/producao',
  '/expedicoes',
  '/devolucoes',
  '/apoio',
  '/stock',
  '/stock/movimentos',
  '/stock/inventarios',
  '/compras',
  '/revendedores',
  '/revendedores/candidaturas',
  '/tabelas-precos',
  '/clube/subscricoes',
  '/clube/cobrancas',
  '/recebimentos/reconciliacao',
  '/catalogo',
  '/blog',
  '/compras-stock',
  '/clientes',
  '/administracao',
];

describe('management principal routes', () => {
  it('has no duplicated links', () => {
    const hrefs = managementRoutes.map((route) => route.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(managementRoutes)('$href has a page implementation', (route) => {
    expect(existsSync(resolve(process.cwd(), route.pageFile))).toBe(true);
  });

  it.each(requiredOperationalRoutes)('keeps %s registered', (href) => {
    expect(managementRoutes.some((route) => route.href === href)).toBe(true);
  });


  it('expõe no arranque apenas os módulos aprovados pelo cliente', () => {
    const liveHrefs = new Set(liveManagementRoutes.map((route) => route.href));
    expect(liveHrefs.has('/recebimentos/reconciliacao')).toBe(true);
    expect(liveHrefs.has('/devolucoes')).toBe(true);
    expect(liveHrefs.has('/revendedores')).toBe(true);

    for (const deferred of [
      '/documentos',
      '/operacoes/preparacao',
      '/operacoes/producao',
      '/expedicoes',
      '/cupoes',
      '/stock',
      '/compras',
      '/clube',
      '/fidelizacao',
      '/vales-oferta',
      '/tabelas-precos',
    ]) {
      expect(liveHrefs.has(deferred)).toBe(false);
      expect(isManagementRouteLive(deferred)).toBe(false);
    }
  });

  it('normalizes the public base path and resolves the most specific module', () => {
    expect(normalizeManagementPath('/gestao/compras/123')).toBe('/compras/123');
    expect(routeIsActive('/gestao/compras/123', '/compras')).toBe(true);
    expect(findManagementRoute('/gestao/catalogo/produtos/123')?.href).toBe(
      '/catalogo/produtos',
    );
  });

  it('mantém páginas de detalhe para os novos fluxos operacionais', () => {
    expect(
      existsSync(resolve(process.cwd(), 'app/stock/inventarios/[id]/page.tsx')),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), 'app/compras/[id]/page.tsx')),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), 'app/revendedores/[id]/page.tsx')),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), 'app/tabelas-precos/[id]/page.tsx')),
    ).toBe(true);
  });
});
