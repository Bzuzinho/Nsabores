export type ManagementGroup =
  | 'Visão geral'
  | 'Vendas'
  | 'Operações'
  | 'Catálogo'
  | 'Compras e stock'
  | 'Clientes'
  | 'Administração';

export type ManagementRoute = {
  href: string;
  label: string;
  description: string;
  group: ManagementGroup;
  keywords?: string[];
  adminOnly?: boolean;
  pageFile: string;
};

export const managementRoutes: ManagementRoute[] = [
  {
    href: '/',
    label: 'Painel',
    description: 'O que precisa da sua atenção hoje.',
    group: 'Visão geral',
    keywords: ['dashboard', 'resumo', 'início'],
    pageFile: 'app/page.tsx',
  },
  {
    href: '/vendas',
    label: 'Painel de vendas',
    description: 'Indicadores, canais e evolução comercial.',
    group: 'Vendas',
    keywords: ['dashboard', 'gráficos', 'vendas'],
    pageFile: 'app/vendas/page.tsx',
  },
  {
    href: '/encomendas',
    label: 'Encomendas',
    description: 'Vendas, estados e detalhe de cada pedido.',
    group: 'Vendas',
    pageFile: 'app/encomendas/page.tsx',
  },
  {
    href: '/recebimentos',
    label: 'Recebimentos',
    description: 'Pagamentos manuais e valores por liquidar.',
    group: 'Vendas',
    keywords: ['pagamentos', 'cobranças'],
    pageFile: 'app/recebimentos/page.tsx',
  },
  {
    href: '/documentos',
    label: 'Documentos fiscais',
    description: 'Faturas, recibos e notas de crédito.',
    group: 'Vendas',
    keywords: ['faturas', 'recibos', 'fiscal'],
    pageFile: 'app/documentos/page.tsx',
  },
  {
    href: '/documentos/reconciliacao',
    label: 'Reconciliação fiscal',
    description: 'Comparar documentos internos e fiscais.',
    group: 'Vendas',
    keywords: ['reconciliação'],
    pageFile: 'app/documentos/reconciliacao/page.tsx',
  },
  {
    href: '/operacoes',
    label: 'Painel operacional',
    description: 'Indicadores e estado do trabalho operacional.',
    group: 'Operações',
    pageFile: 'app/operacoes/page.tsx',
  },
  {
    href: '/operacoes/preparacao',
    label: 'Preparação',
    description: 'Separação e preparação de encomendas.',
    group: 'Operações',
    pageFile: 'app/operacoes/preparacao/page.tsx',
  },
  {
    href: '/operacoes/producao',
    label: 'Produção',
    description: 'Ordens de produção e componentes.',
    group: 'Operações',
    pageFile: 'app/operacoes/producao/page.tsx',
  },
  {
    href: '/expedicoes',
    label: 'Expedições',
    description: 'Envios, transportadoras e tracking.',
    group: 'Operações',
    pageFile: 'app/expedicoes/page.tsx',
  },
  {
    href: '/devolucoes',
    label: 'Devoluções',
    description: 'Pedidos de devolução e reembolsos.',
    group: 'Operações',
    pageFile: 'app/devolucoes/page.tsx',
  },
  {
    href: '/apoio',
    label: 'Apoio ao cliente',
    description: 'Incidências e acompanhamento pós-venda.',
    group: 'Operações',
    pageFile: 'app/apoio/page.tsx',
  },
  {
    href: '/catalogo',
    label: 'Painel de catálogo',
    description: 'Resumo do catálogo e da disponibilidade.',
    group: 'Catálogo',
    pageFile: 'app/catalogo/page.tsx',
  },
  {
    href: '/catalogo/produtos',
    label: 'Produtos',
    description: 'Artigos, preços, imagens e disponibilidade.',
    group: 'Catálogo',
    pageFile: 'app/catalogo/produtos/page.tsx',
  },
  {
    href: '/catalogo/categorias',
    label: 'Categorias',
    description: 'Organização do catálogo público.',
    group: 'Catálogo',
    pageFile: 'app/catalogo/categorias/page.tsx',
  },
  {
    href: '/cabazes',
    label: 'Cabazes',
    description: 'Composições, opções e disponibilidade.',
    group: 'Catálogo',
    pageFile: 'app/cabazes/page.tsx',
  },
  {
    href: '/promocoes',
    label: 'Promoções',
    description: 'Campanhas e regras promocionais.',
    group: 'Catálogo',
    pageFile: 'app/promocoes/page.tsx',
  },
  {
    href: '/cupoes',
    label: 'Cupões',
    description: 'Códigos, utilização e validade.',
    group: 'Catálogo',
    pageFile: 'app/cupoes/page.tsx',
  },
  {
    href: '/blog',
    label: 'Blog',
    description: 'Artigos, rascunhos e publicação editorial.',
    group: 'Catálogo',
    keywords: ['conteúdos', 'artigos', 'notícias'],
    pageFile: 'app/blog/page.tsx',
  },
  {
    href: '/compras-stock',
    label: 'Painel de compras e stock',
    description: 'Indicadores de abastecimento e disponibilidade.',
    group: 'Compras e stock',
    keywords: ['dashboard', 'gráficos', 'abastecimento'],
    pageFile: 'app/compras-stock/page.tsx',
  },
  {
    href: '/stock',
    label: 'Stock',
    description: 'Disponível, reservado e reposição.',
    group: 'Compras e stock',
    pageFile: 'app/stock/page.tsx',
  },
  {
    href: '/stock/movimentos',
    label: 'Movimentos de stock',
    description: 'Histórico de entradas, saídas e reservas.',
    group: 'Compras e stock',
    pageFile: 'app/stock/movimentos/page.tsx',
  },
  {
    href: '/stock/inventarios',
    label: 'Inventários',
    description: 'Contagens e correções auditáveis.',
    group: 'Compras e stock',
    pageFile: 'app/stock/inventarios/page.tsx',
  },
  {
    href: '/fornecedores',
    label: 'Fornecedores',
    description: 'Parceiros, contactos e condições.',
    group: 'Compras e stock',
    pageFile: 'app/fornecedores/page.tsx',
  },
  {
    href: '/compras',
    label: 'Compras',
    description: 'Ordens, custos e receções.',
    group: 'Compras e stock',
    pageFile: 'app/compras/page.tsx',
  },
  {
    href: '/clientes',
    label: 'Painel de clientes',
    description: 'Indicadores de clientes particulares, Clube e B2B.',
    group: 'Clientes',
    keywords: ['dashboard', 'crm', 'gráficos'],
    pageFile: 'app/clientes/page.tsx',
  },
  {
    href: '/clientes/newsletter',
    label: 'Newsletter',
    description: 'Subscrições, consentimentos e estado dos contactos.',
    group: 'Clientes',
    pageFile: 'app/clientes/newsletter/page.tsx',
  },
  {
    href: '/clube',
    label: 'Clube Nsabores',
    description: 'Planos, membros e desempenho.',
    group: 'Clientes',
    pageFile: 'app/clube/page.tsx',
  },
  {
    href: '/clube/planos',
    label: 'Planos do clube',
    description: 'Configuração de planos e vantagens.',
    group: 'Clientes',
    pageFile: 'app/clube/planos/page.tsx',
  },
  {
    href: '/clube/subscricoes',
    label: 'Subscrições',
    description: 'Membros, renovações e estados.',
    group: 'Clientes',
    pageFile: 'app/clube/subscricoes/page.tsx',
  },
  {
    href: '/clube/cobrancas',
    label: 'Cobranças do clube',
    description: 'Mensalidades e cobranças pendentes.',
    group: 'Clientes',
    pageFile: 'app/clube/cobrancas/page.tsx',
  },
  {
    href: '/fidelizacao',
    label: 'Fidelização',
    description: 'Saldos, movimentos e clientes.',
    group: 'Clientes',
    pageFile: 'app/fidelizacao/page.tsx',
  },
  {
    href: '/fidelizacao/regras',
    label: 'Regras de fidelização',
    description: 'Acumulação, libertação e validade.',
    group: 'Clientes',
    pageFile: 'app/fidelizacao/regras/page.tsx',
  },
  {
    href: '/vales-oferta',
    label: 'Vales-oferta',
    description: 'Emissão, utilização e saldo.',
    group: 'Clientes',
    pageFile: 'app/vales-oferta/page.tsx',
  },
  {
    href: '/vales-oferta/pedidos',
    label: 'Pedidos de vales',
    description: 'Pagamentos e emissão de vales.',
    group: 'Clientes',
    pageFile: 'app/vales-oferta/pedidos/page.tsx',
  },
  {
    href: '/revendedores',
    label: 'Revendedores',
    description: 'Contas B2B e condições comerciais.',
    group: 'Clientes',
    pageFile: 'app/revendedores/page.tsx',
  },
  {
    href: '/revendedores/candidaturas',
    label: 'Candidaturas B2B',
    description: 'Pedidos de adesão de revendedores.',
    group: 'Clientes',
    pageFile: 'app/revendedores/candidaturas/page.tsx',
  },
  {
    href: '/tabelas-precos',
    label: 'Tabelas de preços',
    description: 'Preços retail, B2B e personalizados.',
    group: 'Clientes',
    pageFile: 'app/tabelas-precos/page.tsx',
  },
  {
    href: '/administracao',
    label: 'Painel de administração',
    description: 'Utilizadores, conteúdos e controlo da plataforma.',
    group: 'Administração',
    keywords: ['dashboard', 'configuração', 'acessos'],
    adminOnly: true,
    pageFile: 'app/administracao/page.tsx',
  },
  {
    href: '/utilizadores',
    label: 'Utilizadores',
    description: 'Acessos, funções e estado das contas.',
    group: 'Administração',
    keywords: ['permissões', 'staff', 'admin'],
    adminOnly: true,
    pageFile: 'app/utilizadores/page.tsx',
  },
  {
    href: '/administracao/entregas',
    label: 'Métodos de entrega',
    description: 'Custos, disponibilidade e portes gratuitos.',
    group: 'Administração',
    keywords: ['transportes', 'portes', 'checkout'],
    adminOnly: true,
    pageFile: 'app/administracao/entregas/page.tsx',
  },
];

export const managementGroups: ManagementGroup[] = [
  'Visão geral',
  'Vendas',
  'Operações',
  'Catálogo',
  'Compras e stock',
  'Clientes',
  'Administração',
];

export const managementGroupDashboards: Record<ManagementGroup, string> = {
  'Visão geral': '/',
  Vendas: '/vendas',
  Operações: '/operacoes',
  Catálogo: '/catalogo',
  'Compras e stock': '/compras-stock',
  Clientes: '/clientes',
  Administração: '/administracao',
};

export function normalizeManagementPath(pathname: string) {
  const path = pathname.replace(/^\/gestao(?=\/|$)/, '') || '/';
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

export function routeIsActive(pathname: string, href: string) {
  const current = normalizeManagementPath(pathname);
  if (href === '/') return current === '/';
  return current === href || current.startsWith(`${href}/`);
}

export function findManagementRoute(pathname: string) {
  const current = normalizeManagementPath(pathname);
  return [...managementRoutes]
    .sort((a, b) => b.href.length - a.href.length)
    .find((route) => routeIsActive(current, route.href));
}
