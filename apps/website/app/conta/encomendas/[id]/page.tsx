'use client';

import type { CommerceOrder } from '@nsabores/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';
import { formatPrice } from '@/data/site';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  useEffect(() => {
    void accountApi
      .get<CommerceOrder>(`/v1/account/orders/${id}`)
      .then(setOrder);
  }, [id]);
  if (!order) return <section className="account-card">A carregar…</section>;
  const canReturn = ['SHIPPED', 'DELIVERED'].includes(order.status);
  return (
    <section className="account-card">
      <p className="eyebrow">Encomenda</p>
      <h1>{order.number}</h1>
      <p>
        {order.status} · Pagamento {order.paymentStatus}
      </p>
      {order.items.map((item) => (
        <p key={item.id}>
          {item.quantity} × {item.productName} — {formatPrice(item.totalCents)}
        </p>
      ))}
      <p>
        Entrega: {order.deliveryMethod.name} ·{' '}
        {formatPrice(order.shippingCents)}
      </p>
      <p>
        <strong>Total: {formatPrice(order.totalCents)}</strong>
      </p>
      <p>
        <Link href={`/conta/encomendas/${id}/tracking`}>
          Acompanhar expedição
        </Link>
        {canReturn && (
          <>
            {' '}
            ·{' '}
            <Link href={`/conta/encomendas/${id}/devolver`}>
              Pedir devolução
            </Link>
          </>
        )}
      </p>
      <h2>Histórico</h2>
      {order.statusHistory.map((item) => (
        <p key={item.id}>
          {new Date(item.createdAt).toLocaleString('pt-PT')} — {item.toStatus}
        </p>
      ))}
      <button
        className="button"
        onClick={() =>
          void accountApi
            .post(`/v1/account/orders/${id}/repeat`)
            .then(() => router.push('/carrinho'))
        }
      >
        Repetir compra
      </button>
    </section>
  );
}
