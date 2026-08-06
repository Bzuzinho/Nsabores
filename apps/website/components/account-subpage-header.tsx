'use client';

import { usePathname } from 'next/navigation';

type RouteCopy = {
  eyebrow: string;
  title: string;
  description?: string;
};

const routeCopy: Record<string, RouteCopy> = {
  '/conta/encomendas': {
    eyebrow: 'Conta',
    title: 'Encomendas',
    description: 'Consulte, acompanhe e volte a abrir as suas encomendas.',
  },
  '/conta/clube': {
    eyebrow: 'Clube Nsabores',
    title: 'Subscrição e benefícios',
    description: 'Consulte o plano, as cobranças e os benefícios associados.',
  },
  '/conta/fidelizacao': {
    eyebrow: 'Fidelização',
    title: 'Pontos Nsabores',
    description: 'Saldo disponível, movimentos e pontos pendentes.',
  },
  '/conta/documentos': {
    eyebrow: 'Documentos',
    title: 'Documentos comerciais',
    description: 'Faturas, recibos, notas de crédito e outros documentos.',
  },
  '/conta/apoio': {
    eyebrow: 'Apoio ao cliente',
    title: 'Pedidos e conversa',
    description: 'Abra um pedido e acompanhe as respostas no mesmo local.',
  },
  '/conta/perfil': {
    eyebrow: 'Conta Nsabores',
    title: 'Perfil',
    description: 'Dados pessoais, contactos e preferências.',
  },
  '/conta/moradas': {
    eyebrow: 'Conta Nsabores',
    title: 'Moradas',
    description: 'Moradas de entrega e faturação associadas à conta.',
  },
  '/conta/seguranca': {
    eyebrow: 'Conta Nsabores',
    title: 'Segurança',
    description: 'Password e sessões com acesso à sua conta.',
  },
  '/conta/empresa': {
    eyebrow: 'Conta profissional',
    title: 'A minha empresa',
    description: 'Identificação, estado e dados comerciais da empresa.',
  },
  '/conta/precos': {
    eyebrow: 'Conta profissional',
    title: 'Preços profissionais',
    description: 'Tabela de preços e condições atribuídas à sua conta.',
  },
  '/conta/condicoes-comerciais': {
    eyebrow: 'Conta profissional',
    title: 'Condições comerciais',
    description: 'Pagamento, mínimos, crédito, portes e condições aplicáveis.',
  },
};

function resolveCopy(pathname: string): RouteCopy {
  if (routeCopy[pathname]) return routeCopy[pathname];

  if (pathname.startsWith('/conta/encomendas/')) {
    return {
      eyebrow: 'Encomendas',
      title: pathname.endsWith('/devolver')
        ? 'Pedido de devolução'
        : pathname.endsWith('/tracking')
          ? 'Acompanhar encomenda'
          : 'Detalhe da encomenda',
    };
  }

  if (pathname.startsWith('/conta/documentos/')) {
    return { eyebrow: 'Documentos', title: 'Detalhe do documento' };
  }

  return { eyebrow: 'Conta Nsabores', title: 'Área de cliente' };
}

export function AccountSubpageHeader() {
  const pathname = usePathname();
  const copy = resolveCopy(pathname);

  return (
    <header className="account-subpage-hero">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        {copy.description && <p>{copy.description}</p>}
      </div>
    </header>
  );
}
