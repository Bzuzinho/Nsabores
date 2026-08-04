'use client';

import type { CatalogProduct, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { managementApi } from '@/components/management-auth';

type Supplier = {
  id: string;
  tradeName: string;
  paymentTerms?: string | null;
};

type PurchaseLine = {
  key: string;
  productId: string;
  supplierSku: string;
  description: string;
  orderedQuantity: number;
  unitCost: string;
  taxRate: string;
};

const blankLine = (): PurchaseLine => ({
  key: `${Date.now()}-${Math.random()}`,
  productId: '',
  supplierSku: '',
  description: '',
  orderedQuantity: 1,
  unitCost: '',
  taxRate: '23',
});

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

export default function NewPurchasePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [lines, setLines] = useState<PurchaseLine[]>([blankLine()]);
  const [supplierId, setSupplierId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      managementApi.get<Supplier[]>('/v1/admin/suppliers'),
      managementApi.get<Paginated<CatalogProduct>>(
        '/v1/admin/products?limit=100',
      ),
    ])
      .then(([supplierResult, productResult]) => {
        setSuppliers(supplierResult);
        setProducts(productResult.data);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : 'Erro ao carregar dados.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const updateLine = (key: string, update: Partial<PurchaseLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...update } : line)),
    );
  };

  const chooseProduct = (key: string, productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    updateLine(key, {
      productId,
      supplierSku: product?.sku ?? '',
      description: product?.name ?? '',
    });
  };

  const totals = useMemo(
    () =>
      lines.reduce(
        (result, line) => {
          const base =
            (Number(line.unitCost.replace(',', '.')) || 0) *
            line.orderedQuantity;
          const tax =
            base * ((Number(line.taxRate.replace(',', '.')) || 0) / 100);
          return {
            subtotal: result.subtotal + base,
            tax: result.tax + tax,
          };
        },
        { subtotal: 0, tax: 0 },
      ),
    [lines],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const purchase = await managementApi.post<{ id: string }>(
        '/v1/admin/purchases',
        {
          supplierId,
          expectedAt: String(form.get('expectedAt') || '') || undefined,
          paymentTermsSnapshot:
            String(form.get('paymentTermsSnapshot') || '') || undefined,
          notes: String(form.get('notes') || '') || undefined,
          items: lines.map((line) => ({
            productId: line.productId,
            supplierSku: line.supplierSku,
            description: line.description,
            orderedQuantity: line.orderedQuantity,
            unitCostCents: Math.round(
              Number(line.unitCost.replace(',', '.')) * 100,
            ),
            taxRateBasisPoints: Math.round(
              Number(line.taxRate.replace(',', '.')) * 100,
            ),
          })),
        },
      );
      router.push(`/compras/${purchase.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível criar a compra.',
      );
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="admin-state" aria-busy="true">
        A preparar a compra…
      </div>
    );

  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Compras e stock</p>
          <h1>Nova compra</h1>
          <p>Crie a ordem e deixe a receção preparada para o passo seguinte.</p>
        </div>
        <Link className="admin-secondary" href="/compras">
          Cancelar
        </Link>
      </header>

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      {!suppliers.length ? (
        <div className="admin-state">
          <h2>Primeiro precisa de um fornecedor</h2>
          <p>Crie o fornecedor antes de registar uma ordem de compra.</p>
          <Link className="admin-primary" href="/fornecedores">
            Ir para fornecedores
          </Link>
        </div>
      ) : (
        <form
          className="purchase-form"
          onSubmit={(event) => void submit(event)}
        >
          <section className="admin-card purchase-basics">
            <div className="admin-section-heading">
              <span>01</span>
              <div>
                <h2>Dados da compra</h2>
                <p>Fornecedor, previsão e condições acordadas.</p>
              </div>
            </div>
            <div className="purchase-fields">
              <label>
                <span>Fornecedor</span>
                <select
                  required
                  value={supplierId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setSupplierId(id);
                    const supplier = suppliers.find((item) => item.id === id);
                    const terms = document.querySelector<HTMLInputElement>(
                      '[name="paymentTermsSnapshot"]',
                    );
                    if (terms && !terms.value)
                      terms.value = supplier?.paymentTerms ?? '';
                  }}
                >
                  <option value="">Selecionar fornecedor</option>
                  {suppliers.map((supplier) => (
                    <option value={supplier.id} key={supplier.id}>
                      {supplier.tradeName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Entrega prevista</span>
                <input type="date" name="expectedAt" />
              </label>
              <label className="wide">
                <span>Condições de pagamento</span>
                <input
                  name="paymentTermsSnapshot"
                  placeholder="Ex.: 30 dias após faturação"
                />
              </label>
            </div>
          </section>

          <section className="admin-card purchase-lines">
            <div className="admin-section-heading">
              <span>02</span>
              <div>
                <h2>Artigos</h2>
                <p>Quantidades, custos e IVA por linha.</p>
              </div>
              <button
                className="admin-secondary"
                type="button"
                onClick={() => setLines((current) => [...current, blankLine()])}
              >
                Adicionar artigo
              </button>
            </div>
            <div className="purchase-line-list">
              {lines.map((line, index) => (
                <article className="purchase-line" key={line.key}>
                  <header>
                    <strong>Artigo {index + 1}</strong>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.filter((item) => item.key !== line.key),
                          )
                        }
                      >
                        Remover
                      </button>
                    )}
                  </header>
                  <label className="wide">
                    <span>Produto</span>
                    <select
                      required
                      value={line.productId}
                      onChange={(event) =>
                        chooseProduct(line.key, event.target.value)
                      }
                    >
                      <option value="">Selecionar produto</option>
                      {products.map((product) => (
                        <option value={product.id} key={product.id}>
                          {product.name} · {product.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Referência do fornecedor</span>
                    <input
                      required
                      value={line.supplierSku}
                      onChange={(event) =>
                        updateLine(line.key, {
                          supplierSku: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Descrição</span>
                    <input
                      required
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.key, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Quantidade</span>
                    <input
                      min="1"
                      required
                      type="number"
                      value={line.orderedQuantity}
                      onChange={(event) =>
                        updateLine(line.key, {
                          orderedQuantity: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Custo unitário (€)</span>
                    <input
                      inputMode="decimal"
                      min="0"
                      required
                      step="0.01"
                      type="number"
                      value={line.unitCost}
                      onChange={(event) =>
                        updateLine(line.key, { unitCost: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>IVA (%)</span>
                    <input
                      inputMode="decimal"
                      min="0"
                      required
                      step="0.01"
                      type="number"
                      value={line.taxRate}
                      onChange={(event) =>
                        updateLine(line.key, { taxRate: event.target.value })
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-card purchase-summary">
            <div>
              <label>
                <span>Notas internas</span>
                <textarea
                  name="notes"
                  placeholder="Condições especiais, referências ou instruções de receção…"
                />
              </label>
            </div>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{currency.format(totals.subtotal)}</dd>
              </div>
              <div>
                <dt>IVA</dt>
                <dd>{currency.format(totals.tax)}</dd>
              </div>
              <div>
                <dt>Total previsto</dt>
                <dd>{currency.format(totals.subtotal + totals.tax)}</dd>
              </div>
            </dl>
          </section>
          <div className="purchase-submit">
            <Link className="admin-secondary" href="/compras">
              Cancelar
            </Link>
            <button className="admin-primary" disabled={submitting}>
              {submitting ? 'A criar…' : 'Criar ordem de compra'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
