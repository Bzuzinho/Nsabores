import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { managementRoutes } from './management-routes';

const requiredOperationalRoutes = [
  '/operacoes',
  '/operacoes/preparacao',
  '/operacoes/producao',
  '/expedicoes',
  '/devolucoes',
  '/apoio',
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
});
