'use client';

import type { CommerceOrder } from '@nsabores/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';
import { formatPrice } from '@/data/site';

export default function OrdersPage() {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  useEffect(() => {
    void accountApi.get<CommerceOrder[]>('/v1/account/orders').then(setOrders);
  }, []);
  return (
    <section className="account-card">
      <p className="eyebrow">Conta</p>
      <h1>Encomendas</h1>
      {orders.length ? (
        orders.map((order) => (
          <article key={order.id}>
            <h2>
              <Link href={`/conta/encomendas/${order.id}`}>{order.number}</Link>
            </h2>
            <p>
              {new Date(order.createdAt).toLocaleDateString('pt-PT')} ·{' '}
              {order.status} · {formatPrice(order.totalCents)}
            </p>
          </article>
        ))
      ) : (
        <p>Ainda não existem encomendas.</p>
      )}
    </section>
  );
}
