'use client';

import { ApiClient } from '@nsabores/api-client';
import { useEffect, useState } from 'react';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

type Confirmation = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  recipientEmail: string;
  code?: string;
  codeAvailable: boolean;
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export function GiftCardPurchaseSuccess({
  purchaseId,
  paymentId,
}: {
  purchaseId: string;
  paymentId: string;
}) {
  const [result, setResult] = useState<Confirmation | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void api
      .post<Confirmation>(`/v1/gift-card-purchases/${purchaseId}/confirm-mock`, {
        providerPaymentId: paymentId,
      })
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível confirmar a compra.',
          );
      });
    return () => {
      active = false;
    };
  }, [paymentId, purchaseId]);

  if (error) return <section className="account-card"><p role="alert">{error}</p></section>;
  if (!result) return <section className="account-card">A confirmar pagamento…</section>;

  return (
    <section className="account-card">
      <p className="eyebrow">Pagamento confirmado</p>
      <h1>Vale-oferta emitido</h1>
      <p>
        Montante: <strong>{money(result.amountCents, result.currency)}</strong>
      </p>
      <p>Destinatário: {result.recipientEmail}</p>
      {result.codeAvailable && result.code ? (
        <>
          <p>Guarde agora este código. Não voltará a ser apresentado:</p>
          <p><strong>{result.code}</strong></p>
        </>
      ) : (
        <p>
          Esta compra já tinha sido confirmada. Por segurança, o código integral
          não é novamente apresentado.
        </p>
      )}
    </section>
  );
}
