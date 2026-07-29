'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

type Shipment = {
  id: string;
  number: string;
  provider: string;
  service: string;
  status: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  events?: Array<{
    id: string;
    description: string;
    location?: string | null;
    occurredAt: string;
  }>;
};

export default function AccountTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void accountApi
      .get<Shipment[]>(`/v1/account/orders/${id}/tracking`)
      .then(setShipments)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível carregar o tracking.',
        ),
      );
  }, [id]);

  return (
    <section className="account-card">
      <p className="eyebrow">Tracking</p>
      <h1>Acompanhar encomenda</h1>
      {error && <p role="alert">{error}</p>}
      {!error && !shipments.length && (
        <p>A encomenda ainda não tem expedição associada.</p>
      )}
      {shipments.map((shipment) => (
        <article key={shipment.id}>
          <h2>{shipment.number}</h2>
          <p>
            {shipment.provider} · {shipment.service} · {shipment.status}
          </p>
          {shipment.trackingUrl ? (
            <p>
              <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                Abrir tracking {shipment.trackingNumber ?? ''}
              </a>
            </p>
          ) : shipment.trackingNumber ? (
            <p>Tracking: {shipment.trackingNumber}</p>
          ) : null}
          {shipment.estimatedDeliveryAt && (
            <p>
              Entrega estimada:{' '}
              {new Date(shipment.estimatedDeliveryAt).toLocaleDateString(
                'pt-PT',
              )}
            </p>
          )}
          {shipment.deliveredAt && (
            <p>
              Entregue em{' '}
              {new Date(shipment.deliveredAt).toLocaleString('pt-PT')}
            </p>
          )}
          {!!shipment.events?.length && (
            <div>
              <h3>Histórico</h3>
              {shipment.events.map((event) => (
                <p key={event.id}>
                  {new Date(event.occurredAt).toLocaleString('pt-PT')} —{' '}
                  {event.description}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
              ))}
            </div>
          )}
        </article>
      ))}
      <p>
        <Link href={`/conta/encomendas/${id}`}>Voltar à encomenda</Link>
      </p>
    </section>
  );
}
