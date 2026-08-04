'use client';

import { ApiClient } from '@nsabores/api-client';
import { useEffect, useState } from 'react';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : ''),
);

type Confirmation = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  recipientEmail: string;
  code?: string;
  codeAvailable?: boolean;
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export function GiftCardPurchaseSuccess({
  purchaseId,
  paymentId,
  manual,
}: {
  purchaseId: string;
  paymentId?: string;
  manual: boolean;
}) {
  const [result, setResult] = useState<Confirmation | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (manual) {
      void api
        .get<Confirmation>(`/v1/gift-card-purchases/${purchaseId}`)
        .then((value) => {
          if (active) setResult(value);
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : 'Não foi possível consultar o pedido.',
            );
        });
    } else if (paymentId) {
      void api
        .post<Confirmation>(
          `/v1/gift-card-purchases/${purchaseId}/confirm-mock`,
          {
            providerPaymentId: paymentId,
          },
        )
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
    }
    return () => {
      active = false;
    };
  }, [manual, paymentId, purchaseId]);

  if (error)
    return (
      <section className="account-card">
        <p role="alert">{error}</p>
      </section>
    );
  if (!result)
    return (
      <section className="account-card">
        {manual ? 'A registar o pedido…' : 'A confirmar pagamento…'}
      </section>
    );

  if (manual && result.status !== 'PAID') {
    return (
      <section className="account-card">
        <p className="eyebrow">Pedido recebido</p>
        <h1>Pagamento a combinar</h1>
        <p>
          O pedido de vale no montante de{' '}
          <strong>{money(result.amountCents, result.currency)}</strong> ficou
          registado. A Nsabores entrará em contacto para combinar o pagamento.
        </p>
        <p>
          O vale será emitido depois de a empresa marcar manualmente o pagamento
          como recebido.
        </p>
      </section>
    );
  }

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
          <p>
            <strong>{result.code}</strong>
          </p>
        </>
      ) : (
        <p>
          O pagamento já foi confirmado. Por segurança, o código integral não é
          novamente apresentado nesta página.
        </p>
      )}
    </section>
  );
}
