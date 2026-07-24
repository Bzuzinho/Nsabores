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
  const [state, setState] = useState<'pending' | 'paid' | 'error'>(
    paymentId ? 'pending' : 'error',
  );
  useEffect(() => {
    if (!paymentId) return;
    void api
      .post(`/v1/payments/mock/${encodeURIComponent(paymentId)}/confirm`)
      .then(() => setState('paid'))
      .catch(() => setState('error'));
  }, [paymentId]);
  return (
    <section className="account-card">
      <p className="eyebrow">Encomenda recebida</p>
      <h1>
        {state === 'paid'
          ? 'Pagamento confirmado'
          : state === 'error'
            ? 'Confirmação pendente'
            : 'A confirmar pagamento…'}
      </h1>
      <p>
        O estado final é sempre confirmado pelo provider; este ecrã não altera a
        encomenda por confiar no redirect.
      </p>
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
