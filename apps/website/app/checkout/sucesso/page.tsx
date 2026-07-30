'use client';

import { ApiClient } from '@nsabores/api-client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

function Confirmation() {
  const query = useSearchParams();
  const paymentId = query.get('paymentId');
  const manual = query.get('manual') === '1';
  const [state, setState] = useState<'pending' | 'paid' | 'manual' | 'error'>(
    manual ? 'manual' : paymentId ? 'pending' : 'error',
  );

  useEffect(() => {
    if (!paymentId || manual) return;
    void api
      .post(`/v1/payments/mock/${encodeURIComponent(paymentId)}/confirm`)
      .then(() => setState('paid'))
      .catch(() => setState('error'));
  }, [manual, paymentId]);

  return (
    <section className="account-card">
      <p className="eyebrow">Encomenda recebida</p>
      <h1>
        {state === 'manual'
          ? 'A encomenda já seguiu para preparação'
          : state === 'paid'
            ? 'Pagamento confirmado'
            : state === 'error'
              ? 'Confirmação pendente'
              : 'A confirmar pagamento…'}
      </h1>
      {state === 'manual' ? (
        <p>
          A Nsabores entrará em contacto para combinar o pagamento. A empresa
          atualizará manualmente o estado assim que o valor for recebido.
        </p>
      ) : (
        <p>
          O estado final é confirmado pelo provider; este ecrã não altera a
          encomenda apenas com base no redirecionamento.
        </p>
      )}
      <Link href="/conta/encomendas">Ver as minhas encomendas</Link>
    </section>
  );
}

export default function SuccessPage() {
  return (
    <main id="conteudo" className="account-page">
      <Suspense>
        <Confirmation />
      </Suspense>
    </main>
  );
}
