'use client';

import { useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Purchase = {
  id: string;
  purchaserEmail: string;
  recipientEmail: string;
  recipientName?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  code?: string;
  codeAvailable?: boolean;
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export function GiftCardPurchasesAdmin() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [issuedCode, setIssuedCode] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setPurchases(
      await managementApi.get<Purchase[]>('/v1/admin/gift-card-purchases'),
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function markPaid(id: string) {
    if (!window.confirm('Confirmar que o pagamento deste vale foi recebido?')) {
      return;
    }
    setError('');
    setIssuedCode('');
    try {
      const result = await managementApi.post<Purchase>(
        `/v1/admin/gift-card-purchases/${id}/mark-paid`,
        {},
      );
      if (result.codeAvailable && result.code) {
        setIssuedCode(result.code);
      }
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível confirmar o pagamento.',
      );
    }
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Vales-oferta</p>
          <h1>Pedidos e pagamentos</h1>
          <p>Pagamentos combinados fora da plataforma e confirmados manualmente.</p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {issuedCode && (
        <section className="user-detail">
          <h2>Código emitido</h2>
          <p>
            Copie e entregue agora ao cliente. O código integral não voltará a ser
            apresentado:
          </p>
          <p>
            <strong>{issuedCode}</strong>
          </p>
        </section>
      )}
      <section className="user-detail">
        {!purchases.length && <p>Sem pedidos de vales.</p>}
        {purchases.map((purchase) => (
          <article key={purchase.id}>
            <p>
              <strong>{money(purchase.amountCents, purchase.currency)}</strong> ·{' '}
              {purchase.status}
            </p>
            <p>
              Comprador: {purchase.purchaserEmail}
              <br />
              Destinatário: {purchase.recipientName || purchase.recipientEmail} ·{' '}
              {purchase.recipientEmail}
            </p>
            <p>{new Date(purchase.createdAt).toLocaleString('pt-PT')}</p>
            {purchase.status === 'PENDING_PAYMENT' && (
              <button
                className="admin-primary"
                onClick={() => void markPaid(purchase.id)}
              >
                Marcar pagamento como recebido
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
