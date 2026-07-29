'use client';

import { FormEvent, useState } from 'react';

type TrackingResponse = {
  order: { number: string; status: string };
  shipments: Array<{
    id: string;
    number: string;
    provider: string;
    service: string;
    status: string;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    estimatedDeliveryAt?: string | null;
    deliveredAt?: string | null;
  }>;
};

export function PublicTracking() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const response = await fetch(`${baseUrl}/v1/tracking`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderNumber, email }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          body?.message ?? 'Não foi possível localizar a encomenda.',
        );
      }
      setResult((await response.json()) as TrackingResponse);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível consultar o tracking.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="contact-grid" aria-label="Acompanhar encomenda">
      <article>
        <span>01</span>
        <h2>Dados da encomenda</h2>
        <form onSubmit={submit}>
          <label>
            Número da encomenda
            <input
              required
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="Ex.: NS-2026-..."
            />
          </label>
          <label>
            Email usado na compra
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'A consultar…' : 'Acompanhar'}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </article>
      <article>
        <span>02</span>
        <h2>Estado</h2>
        {!result && (
          <p>
            Introduza o número da encomenda e o email para consultar o estado.
          </p>
        )}
        {result && (
          <>
            <p>
              <strong>{result.order.number}</strong> · {result.order.status}
            </p>
            {!result.shipments.length && (
              <p>A encomenda ainda não tem expedição associada.</p>
            )}
            {result.shipments.map((shipment) => (
              <div key={shipment.id}>
                <p>
                  <strong>{shipment.number}</strong> · {shipment.status}
                </p>
                <p>
                  {shipment.provider} · {shipment.service}
                </p>
                {shipment.trackingUrl ? (
                  <p>
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
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
              </div>
            ))}
          </>
        )}
      </article>
    </section>
  );
}
