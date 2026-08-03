export type ManagementRoute = {
  href: string;
  label: string;
  adminOnly?: boolean;
  pageFile: string;
};

export const managementRoutes: ManagementRoute[] = [
  { href: '/catalogo', label: 'Visão geral', pageFile: 'app/catalogo/page.tsx' },
  {
    href: '/catalogo/produtos',
    label: 'Produtos',
    pageFile: 'app/catalogo/produtos/page.tsx',
  },
  {
    href: '/catalogo/categorias',
    label: 'Categorias',
    pageFile: 'app/catalogo/categorias/page.tsx',
  },
  {
    href: '/encomendas',
    label: 'Encomendas',
    pageFile: 'app/encomendas/page.tsx',
  },
  {
    href: '/operacoes',
    label: 'Operações',
    pageFile: 'app/operacoes/page.tsx',
  },
  {
    href: '/operacoes/preparacao',
    label: 'Preparação',
    pageFile: 'app/operacoes/preparacao/page.tsx',
  },
  {
    href: '/operacoes/producao',
    label: 'Produção',
    pageFile: 'app/operacoes/producao/page.tsx',
  },
  {
    href: '/expedicoes',
    label: 'Expedições',
    pageFile: 'app/expedicoes/page.tsx',
  },
  {
    href: '/devolucoes',
    label: 'Devoluções',
    pageFile: 'app/devolucoes/page.tsx',
  },
  { href: '/apoio', label: 'Apoio', pageFile: 'app/apoio/page.tsx' },
  {
    href: '/recebimentos',
    label: 'Recebimentos',
    pageFile: 'app/recebimentos/page.tsx',
  },
  {
    href: '/documentos',
    label: 'Documentos',
    pageFile: 'app/documentos/page.tsx',
  },
  {
    href: '/promocoes',
    label: 'Promoções',
    pageFile: 'app/promocoes/page.tsx',
  },
  { href: '/cupoes', label: 'Cupões', pageFile: 'app/cupoes/page.tsx' },
  { href: '/cabazes', label: 'Cabazes', pageFile: 'app/cabazes/page.tsx' },
  {
    href: '/clube',
    label: 'Clube Nsabores',
    pageFile: 'app/clube/page.tsx',
  },
  {
    href: '/fidelizacao',
    label: 'Fidelização',
    pageFile: 'app/fidelizacao/page.tsx',
  },
  {
    href: '/vales-oferta',
    label: 'Vales-oferta',
    pageFile: 'app/vales-oferta/page.tsx',
  },
  {
    href: '/vales-oferta/pedidos',
    label: 'Pagamentos de vales',
    pageFile: 'app/vales-oferta/pedidos/page.tsx',
  },
  { href: '/stock', label: 'Stock', pageFile: 'app/stock/page.tsx' },
  {
    href: '/stock/inventarios',
    label: 'Inventários',
    pageFile: 'app/stock/inventarios/page.tsx',
  },
  {
    href: '/fornecedores',
    label: 'Fornecedores',
    pageFile: 'app/fornecedores/page.tsx',
  },
  { href: '/compras', label: 'Compras', pageFile: 'app/compras/page.tsx' },
  {
    href: '/revendedores',
    label: 'Revendedores',
    pageFile: 'app/revendedores/page.tsx',
  },
  {
    href: '/revendedores/candidaturas',
    label: 'Candidaturas B2B',
    pageFile: 'app/revendedores/candidaturas/page.tsx',
  },
  {
    href: '/tabelas-precos',
    label: 'Tabelas de preços',
    pageFile: 'app/tabelas-precos/page.tsx',
  },
  {
    href: '/utilizadores',
    label: 'Utilizadores',
    adminOnly: true,
    pageFile: 'app/utilizadores/page.tsx',
  },
];
