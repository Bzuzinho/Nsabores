'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type PurchaseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

type Purchase = {
  id: string;
  number: string;
  status: PurchaseStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  expectedAt: string | null;
  receivedAt: string | null;
  paymentTermsSnapshot: string | null;
  notes: string | null;
  supplier: { id: string; tradeName: string; email: string; phone: string };
  items: Array<{
    id: string;
    productId: string;
    supplierSku: string;
    description: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitCostCents: number;
    totalCents: number;
    product: { name: string; sku: string };
  }>;
  receipts: Array<{
    id: string;
    number: string;
    receivedAt: string;
    note: string | null;
    items: Array<{ purchaseOrderItemId: string; quantity: number }>;
  }>;
};

const money = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    value / 100,
  );
const labels: Record<PurchaseStatus, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Submetida',
  CONFIRMED: 'Confirmada',
  PARTIALLY_RECEIVED: 'Parcialmente recebida',
  RECEIVED: 'Recebida',
  CANCELLED: 'Cancelada',
};

export function PurchaseDetailAdmin({ id }: { id: string }) {
  const [purchase, setPurchase] = useState<Purchase>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await managementApi.get<Purchase>(
        `/v1/admin/purchases/${id}`,
      );
      setPurchase(data);
      setQuantities((current) =>
        Object.fromEntries(
          data.items.map((item) => [item.id, current[item.id] ?? 0]),
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const pending = useMemo(
    () =>
      purchase?.items.reduce(
        (sum, item) =>
          sum + Math.max(0, item.orderedQuantity - item.receivedQuantity),
        0,
      ) ?? 0,
    [purchase],
  );

  async function changeStatus(status: PurchaseStatus) {
    setBusy(true);
    setError('');
    try {
      await managementApi.patch(`/v1/admin/purchases/${id}/status`, {
        status,
      });
      setMessage(`Compra ${labels[status].toLocaleLowerCase('pt-PT')}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchase) return;
    const form = new FormData(event.currentTarget);
    const items = purchase.items
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantity: quantities[item.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setError('Introduza pelo menos uma quantidade recebida.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await managementApi.post(`/v1/admin/purchases/${id}/receipts`, {
        idempotencyKey: crypto.randomUUID(),
        items,
        note: String(form.get('note') || '') || undefined,
        allowOverReceipt: form.get('allowOverReceipt') === 'on',
      });
      setMessage('Receção registada e stock atualizado.');
      setQuantities({});
      event.currentTarget.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  if (!purchase && !error)
    return (
      <div className="admin-state" aria-busy="true">
        A carregar compra…
      </div>
    );
  if (!purchase)
    return (
      <div className="admin-error" role="alert">
        {error}
      </div>
    );

  const receivable = ['SUBMITTED', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(
    purchase.status,
  );

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Compras e stock</p>
          <h1>{purchase.number}</h1>
          <p>
            {purchase.supplier.tradeName} · {labels[purchase.status]} ·{' '}
            {pending} unidades por receber
          </p>
        </div>
        <div className="admin-actions">
          <Link className="admin-secondary" href="/compras">
            Voltar
          </Link>
          {purchase.status === 'DRAFT' && (
            <button
              className="admin-primary"
              disabled={busy}
              onClick={() => void changeStatus('SUBMITTED')}
            >
              Submeter compra
            </button>
          )}
          {purchase.status === 'SUBMITTED' && (
            <button
              className="admin-primary"
              disabled={busy}
              onClick={() => void changeStatus('CONFIRMED')}
            >
              Confirmar compra
            </button>
          )}
          {['DRAFT', 'SUBMITTED', 'CONFIRMED'].includes(purchase.status) && (
            <button
              className="admin-secondary"
              disabled={busy}
              onClick={() => {
                if (confirm('Cancelar esta ordem de compra?'))
                  void changeStatus('CANCELLED');
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </header>

      <div className="admin-metrics">
        <article>
          <span>Total sem IVA</span>
          <strong>{money(purchase.subtotalCents, purchase.currency)}</strong>
        </article>
        <article>
          <span>IVA</span>
          <strong>{money(purchase.taxCents, purchase.currency)}</strong>
        </article>
        <article>
          <span>Total</span>
          <strong>{money(purchase.totalCents, purchase.currency)}</strong>
        </article>
        <article>
          <span>Receções</span>
          <strong>{purchase.receipts.length}</strong>
        </article>
      </div>

      <section className="admin-card">
        <h2>Artigos da compra</h2>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>SKU fornecedor</th>
                <th>Encomendado</th>
                <th>Recebido</th>
                <th>Pendente</th>
                <th>Custo unitário</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product.name}</strong>
                    <small>{item.product.sku}</small>
                  </td>
                  <td>{item.supplierSku}</td>
                  <td>{item.orderedQuantity}</td>
                  <td>{item.receivedQuantity}</td>
                  <td>
                    {Math.max(0, item.orderedQuantity - item.receivedQuantity)}
                  </td>
                  <td>{money(item.unitCostCents, purchase.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {receivable && pending > 0 && (
        <form className="admin-card operational-form" onSubmit={receive}>
          <div className="operational-section-heading">
            <div>
              <p className="eyebrow">Nova receção</p>
              <h2>Registar entrada total ou parcial</h2>
            </div>
            <button
              className="admin-secondary"
              type="button"
              onClick={() =>
                setQuantities(
                  Object.fromEntries(
                    purchase.items.map((item) => [
                      item.id,
                      Math.max(0, item.orderedQuantity - item.receivedQuantity),
                    ]),
                  ),
                )
              }
            >
              Preencher pendentes
            </button>
          </div>
          <div className="operational-line-list">
            {purchase.items.map((item) => {
              const remaining = Math.max(
                0,
                item.orderedQuantity - item.receivedQuantity,
              );
              return (
                <label key={item.id}>
                  <span>
                    <strong>{item.product.name}</strong>
                    <small>{remaining} pendentes</small>
                  </span>
                  <input
                    min="0"
                    type="number"
                    value={quantities[item.id] ?? 0}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              );
            })}
          </div>
          <label>
            Nota da receção
            <textarea name="note" />
          </label>
          <label className="operational-check">
            <input type="checkbox" name="allowOverReceipt" />
            Confirmo uma receção superior ao encomendado
          </label>
          <button className="admin-primary" disabled={busy}>
            {busy ? 'A registar…' : 'Registar receção'}
          </button>
        </form>
      )}

      {purchase.receipts.length > 0 && (
        <section className="admin-card">
          <h2>Histórico de receções</h2>
          <div className="operational-history">
            {purchase.receipts.map((receipt) => (
              <article key={receipt.id}>
                <strong>{receipt.number}</strong>
                <span>
                  {new Date(receipt.receivedAt).toLocaleString('pt-PT')} ·{' '}
                  {receipt.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                  unidades
                </span>
                {receipt.note && <p>{receipt.note}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
