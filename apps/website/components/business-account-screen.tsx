'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/data/site';
import { accountApi } from './auth-provider';

type Mode = 'company' | 'prices' | 'terms';

type BusinessAccount = {
  id: string;
  type: 'RESELLER' | 'B2B';
  tradeName: string;
  legalName: string;
  taxNumber: string;
  businessEmail: string;
  phone: string;
  status: string;
  billingAddress: Record<string, unknown>;
  paymentTerms: string;
  allowedPaymentMethods: string[];
  creditLimitCents: number | null;
  minimumOrderCents: number | null;
  shippingCents: number | null;
  requiresApproval: boolean;
  priceList?: { name: string; code: string } | null;
};

type BusinessProduct = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string;
  priceCents: number;
  minimumOrderQuantity: number;
  orderMultiple: number;
  availableQuantity: number | null;
};

export function BusinessAccountScreen({ mode }: { mode: Mode }) {
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [products, setProducts] = useState<BusinessProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      accountApi.get<BusinessAccount>('/v1/business/account'),
      mode === 'prices'
        ? accountApi.get<BusinessProduct[]>('/v1/business/catalog')
        : Promise.resolve([]),
    ])
      .then(([business, catalog]) => {
        if (!active) return;
        setAccount(business);
        setProducts(catalog);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar a conta empresarial.',
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [mode]);

  if (loading)
    return (
      <main className="account-state" aria-busy="true">
        A carregar conta profissional…
      </main>
    );
  if (error || !account)
    return (
      <main id="conteudo" className="account-page account-page-wide">
        <section className="account-card professional-empty">
          <p className="eyebrow">Área profissional</p>
          <h1>Esta conta não tem um perfil empresarial aprovado.</h1>
          <p>
            {error || 'A associação profissional ainda não está disponível.'}
          </p>
          <Link
            className="button button-primary"
            href="/revendedores/candidatura"
          >
            Pedir acesso profissional
          </Link>
        </section>
      </main>
    );

  return (
    <main id="conteudo" className="account-page account-page-wide">
      <header className="professional-header">
        <div>
          <p className="eyebrow">
            {account.type === 'RESELLER' ? 'Revendedor' : 'Cliente B2B'}
          </p>
          <h1>{account.tradeName}</h1>
          <p>
            {account.status} ·{' '}
            {account.priceList?.name ?? 'Tabela por atribuir'}
          </p>
        </div>
        <nav aria-label="Conta profissional">
          <Link href="/conta/empresa">Empresa</Link>
          <Link href="/conta/precos">Preços</Link>
          <Link href="/conta/condicoes-comerciais">Condições</Link>
        </nav>
      </header>

      {mode === 'company' && <Company account={account} />}
      {mode === 'prices' && <Prices products={products} account={account} />}
      {mode === 'terms' && <Terms account={account} />}
    </main>
  );
}

function Company({ account }: { account: BusinessAccount }) {
  return (
    <section className="professional-detail-grid">
      <article>
        <span>Designação comercial</span>
        <strong>{account.tradeName}</strong>
      </article>
      <article>
        <span>Denominação legal</span>
        <strong>{account.legalName}</strong>
      </article>
      <article>
        <span>NIF</span>
        <strong>{account.taxNumber}</strong>
      </article>
      <article>
        <span>Email empresarial</span>
        <strong>{account.businessEmail}</strong>
      </article>
      <article>
        <span>Telefone</span>
        <strong>{account.phone}</strong>
      </article>
      <article>
        <span>Tipo de conta</span>
        <strong>{account.type === 'RESELLER' ? 'Revendedor' : 'B2B'}</strong>
      </article>
    </section>
  );
}

function Prices({
  products,
  account,
}: {
  products: BusinessProduct[];
  account: BusinessAccount;
}) {
  return (
    <section>
      <div className="professional-section-heading">
        <div>
          <p className="eyebrow">
            {account.priceList?.name ?? 'Tabela profissional'}
          </p>
          <h2>Catálogo disponível para a sua conta</h2>
        </div>
        <span>{products.length} produtos</span>
      </div>
      <div className="professional-price-grid">
        {products.map((product) => (
          <article key={product.id}>
            <Image src={product.imageUrl} alt="" width={320} height={220} />
            <div>
              <small>{product.sku}</small>
              <h3>{product.name}</h3>
              <strong>{formatPrice(product.priceCents)}</strong>
              <p>
                Mínimo {product.minimumOrderQuantity} · múltiplos de{' '}
                {product.orderMultiple}
              </p>
              <span>
                {product.availableQuantity === null
                  ? 'Disponibilidade sob consulta'
                  : `${product.availableQuantity} disponíveis`}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Terms({ account }: { account: BusinessAccount }) {
  const rows = [
    ['Condições de pagamento', account.paymentTerms.replaceAll('_', ' ')],
    [
      'Métodos autorizados',
      account.allowedPaymentMethods.join(', ').replaceAll('_', ' '),
    ],
    [
      'Encomenda mínima',
      account.minimumOrderCents === null
        ? 'Sem mínimo definido'
        : formatPrice(account.minimumOrderCents),
    ],
    [
      'Limite de crédito',
      account.creditLimitCents === null
        ? 'Sem crédito atribuído'
        : formatPrice(account.creditLimitCents),
    ],
    [
      'Portes',
      account.shippingCents === null
        ? 'Calculados caso a caso'
        : formatPrice(account.shippingCents),
    ],
    [
      'Aprovação interna',
      account.requiresApproval ? 'Obrigatória' : 'Não necessária',
    ],
  ] as const;
  return (
    <section className="professional-terms">
      {rows.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}
