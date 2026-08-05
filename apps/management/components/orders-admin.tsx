'use client';

import type {
  CommerceOrder,
  ManualPaymentPreference,
  OrderStatus,
  Paginated,
} from '@nsabores/types';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );

const paymentPreferenceLabels: Record<ManualPaymentPreference, string> = {
  OPERATOR_CONTACT: 'Contactar para combinar',
  PAY_ON_DELIVERY: 'Contra entrega',
  PAY_ON_PICKUP: 'Pagamento na recolha',
  CARRIER_COD: 'Envio à cobrança',
};

const paymentPreference = (order: CommerceOrder) => {
  const preference = order.paymentTermsSnapshot?.preference;
  return preference ? paymentPreferenceLabels[preference] : 'A combinar';
};

type OrderShipment = {
  id: string;
  number: string;
  status: string;
  items: Array<{ orderItemId: string; quantity: number }>;
};

export function OrdersAdmin() {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  useEffect(() => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    if (payment) query.set('paymentStatus', payment);
    void managementApi
      .get<Paginated<CommerceOrder>>(`/v1/admin/orders?${query}`)
      .then(({ data }) => setOrders(data));
  }, [payment, search, status]);

  function exportCsv() {
    const rows = [
      [
        'Número',
        'Data',
        'Cliente',
        'Email',
        'Estado',
        'Pagamento',
        'Preferência de cobrança',
        'Transporte',
        'Total',
      ],
      ...orders.map((order) => [
        order.number,
        order.createdAt,
        order.customerName,
        order.email,
        order.status,
        order.paymentStatus,
        paymentPreference(order),
        order.paymentTermsSnapshot?.shippingQuoteStatus ?? 'NOT_REQUIRED',
        String(order.totalCents),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','),
      )
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'encomendas.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Encomendas</h1>
          <p>
            Pagamento e transporte são confirmados manualmente pela equipa
            Nsabores.
          </p>
        </div>
        <button className="admin-primary" onClick={exportCsv}>
          Exportar CSV
        </button>
      </header>
      <div className="admin-filters">
        <input
          aria-label="Pesquisar"
          placeholder="Número, cliente ou email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Todos os estados</option>
          {(
            [
              'PENDING_PAYMENT',
              'PAID',
              'PROCESSING',
              'READY',
              'SHIPPED',
              'DELIVERED',
              'CANCELLED',
              'REFUNDED',
            ] satisfies OrderStatus[]
          ).map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Pagamento"
          value={payment}
          onChange={(event) => setPayment(event.target.value)}
        >
          <option value="">Todos os pagamentos</option>
          {[
            'PENDING',
            'AUTHORIZED',
            'PAID',
            'FAILED',
            'CANCELLED',
            'REFUNDED',
            'PARTIALLY_REFUNDED',
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Produção</th>
              <th>Cobrança</th>
              <th>Transporte</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  {order.number}
                  <small>
                    {new Date(order.createdAt).toLocaleString('pt-PT')}
                  </small>
                </td>
                <td>
                  {order.customerName}
                  <small>{order.email}</small>
                </td>
                <td>{order.status}</td>
                <td>
                  {paymentPreference(order)}
                  <small>{order.paymentStatus}</small>
                </td>
                <td>
                  {order.paymentTermsSnapshot?.shippingQuoteStatus === 'PENDING'
                    ? 'A confirmar'
                    : money(order.shippingCents)}
                </td>
                <td>{money(order.totalCents)}</td>
                <td>
                  <Link href={`/encomendas/${order.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function OrderAdmin({ id }: { id: string }) {
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  const [shipments, setShipments] = useState<OrderShipment[]>([]);
  const [shipmentQuantities, setShipmentQuantities] = useState<
    Record<string, number>
  >({});
  const [error, setError] = useState('');
  const [shippingBusy, setShippingBusy] = useState(false);
  const reload = useCallback(async () => {
    const [currentOrder, currentShipments] = await Promise.all([
      managementApi.get<CommerceOrder>(`/v1/admin/orders/${id}`),
      managementApi.get<OrderShipment[]>(
        `/v1/admin/shipments?orderId=${encodeURIComponent(id)}`,
      ),
    ]);
    setOrder(currentOrder);
    setShipments(currentShipments);
  }, [id]);
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      managementApi.get<CommerceOrder>(`/v1/admin/orders/${id}`),
      managementApi.get<OrderShipment[]>(
        `/v1/admin/shipments?orderId=${encodeURIComponent(id)}`,
      ),
    ])
      .then(([currentOrder, currentShipments]) => {
        if (cancelled) return;
        setOrder(currentOrder);
        setShipments(currentShipments);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível carregar a encomenda.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!order)
    return (
      <div className="admin-state">{error || 'A carregar a encomenda…'}</div>
    );

  const act = async (path: string, body?: unknown) => {
    if (!window.confirm('Confirma esta ação?')) return;
    setError('');
    try {
      setOrder(
        body === undefined
          ? await managementApi.post(path)
          : await managementApi.patch(path, body),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operação falhou.');
    }
  };

  const confirmShipping = async () => {
    const value = window.prompt(
      'Custo de transporte em euros (ex.: 7,50):',
      order.shippingCents ? (order.shippingCents / 100).toFixed(2) : '0,00',
    );
    if (value === null) return;
    const normalized = value.replace(',', '.').trim();
    const euros = Number(normalized);
    if (!Number.isFinite(euros) || euros < 0) {
      setError('Introduza um valor de transporte válido.');
      return;
    }
    const note =
      window.prompt('Transportadora, referência ou nota (opcional):', '') ?? '';
    if (!window.confirm('Confirmar o custo de transporte desta encomenda?'))
      return;
    setError('');
    try {
      setOrder(
        await managementApi.patch(`/v1/admin/orders/${id}/shipping-quote`, {
          amountCents: Math.round(euros * 100),
          note,
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível confirmar o transporte.',
      );
    }
  };

  const markPaid = async () => {
    const method = window.prompt(
      'Método de pagamento (ex.: transferência, numerário na entrega, recolha, à cobrança):',
      paymentPreference(order),
    );
    if (method === null) return;
    const reference =
      window.prompt('Referência/comprovativo (opcional):', '') ?? '';
    const note = window.prompt('Nota interna (opcional):', '') ?? '';
    if (!window.confirm('Confirmar que o pagamento foi recebido?')) return;
    setError('');
    try {
      setOrder(
        await managementApi.post(`/v1/admin/orders/${id}/mark-paid`, {
          method,
          reference,
          note,
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível confirmar o pagamento.',
      );
    }
  };

  const shippingPending =
    order.paymentTermsSnapshot?.shippingQuoteStatus === 'PENDING';
  const remainingItems = order.items.map((item) => {
    const shipped = shipments.reduce(
      (total, shipment) =>
        total +
        (shipment.status === 'CANCELLED'
          ? 0
          : shipment.items
              .filter((line) => line.orderItemId === item.id)
              .reduce((sum, line) => sum + line.quantity, 0)),
      0,
    );
    return { ...item, remaining: Math.max(0, item.quantity - shipped) };
  });
  const canCreateShipment =
    ['PAID', 'PROCESSING', 'READY'].includes(order.status) &&
    remainingItems.some((item) => item.remaining > 0);

  const createShipment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = remainingItems
      .map((item) => ({
        orderItemId: item.id,
        quantity: shipmentQuantities[item.id] ?? item.remaining,
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setError('Selecione pelo menos um artigo para expedir.');
      return;
    }
    setShippingBusy(true);
    setError('');
    try {
      await managementApi.post('/v1/admin/shipments', {
        orderId: id,
        service: form.get('service'),
        idempotencyKey: crypto.randomUUID(),
        items,
        weightGrams: form.get('weightGrams')
          ? Number(form.get('weightGrams'))
          : undefined,
        costCents: form.get('cost')
          ? Math.round(Number(form.get('cost')) * 100)
          : undefined,
      });
      setShipmentQuantities({});
      event.currentTarget.reset();
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operação falhou.');
    } finally {
      setShippingBusy(false);
    }
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>{order.number}</h1>
          <p>
            {order.customerName} · {order.email} · {order.phone}
          </p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <section className="user-detail">
        <p>
          Produção: <strong>{order.status}</strong> · Pagamento:{' '}
          <strong>{order.paymentStatus}</strong>
        </p>
        <p>
          Preferência do cliente: <strong>{paymentPreference(order)}</strong>
        </p>
        <p>
          Entrega: <strong>{order.deliveryMethod.name}</strong> · Transporte:{' '}
          <strong>
            {shippingPending ? 'A confirmar' : money(order.shippingCents)}
          </strong>
        </p>
        {shippingPending && order.paymentStatus === 'PENDING' && (
          <p>
            <button
              className="admin-primary"
              onClick={() => void confirmShipping()}
            >
              Confirmar custo de transporte
            </button>
          </p>
        )}
        {order.paymentStatus === 'PENDING' && (
          <p>
            <button className="admin-primary" onClick={() => void markPaid()}>
              Marcar pagamento como recebido
            </button>
          </p>
        )}
        {order.items.map((item) => (
          <p key={item.id}>
            {item.quantity} × {item.productName} ({item.sku}) —{' '}
            {money(item.totalCents)}
          </p>
        ))}
        {canCreateShipment && (
          <form className="operational-form" onSubmit={createShipment}>
            <h2>Nova expedição</h2>
            {remainingItems
              .filter((item) => item.remaining > 0)
              .map((item) => (
                <label key={item.id}>
                  {item.productName} · {item.remaining} por expedir
                  <input
                    min="0"
                    max={item.remaining}
                    type="number"
                    value={shipmentQuantities[item.id] ?? item.remaining}
                    onChange={(event) =>
                      setShipmentQuantities((current) => ({
                        ...current,
                        [item.id]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            <label>
              Serviço/transportadora
              <input name="service" required defaultValue="standard" />
            </label>
            <label>
              Peso total (gramas)
              <input min="1" name="weightGrams" type="number" />
            </label>
            <label>
              Custo (€)
              <input min="0" name="cost" step="0.01" type="number" />
            </label>
            <button className="admin-primary" disabled={shippingBusy}>
              {shippingBusy ? 'A criar…' : 'Criar expedição'}
            </button>
          </form>
        )}
        {shipments.length > 0 && (
          <div>
            <h2>Expedições</h2>
            {shipments.map((shipment) => (
              <p key={shipment.id}>
                <Link href={`/expedicoes/${shipment.id}`}>
                  {shipment.number}
                </Link>{' '}
                · {shipment.status}
              </p>
            ))}
          </div>
        )}
        <p>Morada: {JSON.stringify(order.shippingAddress)}</p>
        <p>
          <strong>
            {shippingPending ? 'Total provisório' : 'Total a receber'}:{' '}
            {money(order.totalCents)}
          </strong>
        </p>
        {order.paymentTermsSnapshot?.shippingQuoteNote && (
          <p>
            Nota de transporte: {order.paymentTermsSnapshot.shippingQuoteNote}
          </p>
        )}
        <label>
          Novo estado de produção
          <select
            defaultValue=""
            onChange={(event) =>
              event.target.value &&
              void act(`/v1/admin/orders/${id}/status`, {
                status: event.target.value,
              })
            }
          >
            <option value="">Selecionar…</option>
            {['PROCESSING', 'READY'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Nota interna
          <textarea
            defaultValue={order.internalNotes ?? ''}
            onBlur={(event) =>
              void managementApi.patch(`/v1/admin/orders/${id}/notes`, {
                note: event.target.value,
              })
            }
          />
        </label>
        <button onClick={() => void act(`/v1/admin/orders/${id}/cancel`)}>
          Cancelar encomenda
        </button>
        {order.paymentStatus === 'PAID' && (
          <button onClick={() => void act(`/v1/admin/orders/${id}/refund`)}>
            Registar reembolso
          </button>
        )}
        <h2>Histórico de produção</h2>
        {order.statusHistory.map((item) => (
          <p key={item.id}>
            {new Date(item.createdAt).toLocaleString('pt-PT')} — {item.toStatus}{' '}
            {item.note}
          </p>
        ))}
      </section>
    </>
  );
}
