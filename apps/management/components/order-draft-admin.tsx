'use client';

import type {
  CatalogProduct,
  CommerceOrder,
  DeliveryMethod,
  Paginated,
} from '@nsabores/types';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { managementApi } from './management-auth';

type DraftLine = {
  productId: string;
  quantity: number;
  unitPriceCents?: number;
};

export function OrderDraftAdmin({ id }: { id?: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([
    { productId: '', quantity: 1 },
  ]);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      managementApi.get<Paginated<CatalogProduct>>(
        '/v1/admin/catalog/products?limit=100',
      ),
      managementApi.get<DeliveryMethod[]>('/v1/admin/delivery-methods'),
      id
        ? managementApi.get<CommerceOrder>(`/v1/admin/orders/${id}`)
        : Promise.resolve(null),
    ])
      .then(([catalog, methods, current]) => {
        setProducts(catalog.data);
        setDeliveryMethods(methods);
        setOrder(current);
        if (current)
          setLines(
            current.items.map((item) => ({
              productId: item.productId ?? '',
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
            })),
          );
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível carregar os dados.',
        ),
      );
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const address = {
      firstName: String(form.get('firstName')),
      lastName: String(form.get('lastName')),
      line1: String(form.get('line1')),
      postalCode: String(form.get('postalCode')),
      city: String(form.get('city')),
      countryCode: 'PT',
    };
    const body = {
      email: String(form.get('email')),
      customerName: `${address.firstName} ${address.lastName}`.trim(),
      phone: String(form.get('phone')),
      billingAddress: address,
      shippingAddress: address,
      deliveryMethodId: String(form.get('deliveryMethodId')),
      source: String(form.get('source')),
      requiresApproval: form.get('requiresApproval') === 'on',
      customerNotes: String(form.get('customerNotes') ?? ''),
      internalNotes: String(form.get('internalNotes') ?? ''),
      items: lines.filter((line) => line.productId),
    };
    setError('');
    try {
      const saved = id
        ? await managementApi.patch<CommerceOrder>(
            `/v1/admin/orders/${id}/draft`,
            body,
          )
        : await managementApi.post<CommerceOrder>('/v1/admin/orders', body);
      router.push(`/encomendas/${saved.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível guardar.',
      );
    }
  }

  const address = (order?.shippingAddress ?? {}) as Record<string, string>;
  return (
    <>
      <header className="admin-header">
        <div>
          <h1>{id ? 'Editar rascunho' : 'Nova encomenda'}</h1>
          <p>
            Registe pedidos recebidos por telefone, email, presencialmente ou
            por vendedor.
          </p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <form className="operational-form" onSubmit={save}>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue={order?.email}
          />
        </label>
        <label>
          Nome
          <input
            name="firstName"
            required
            defaultValue={
              address.firstName ?? order?.customerName?.split(' ')[0]
            }
          />
        </label>
        <label>
          Apelido
          <input
            name="lastName"
            required
            defaultValue={
              address.lastName ??
              order?.customerName?.split(' ').slice(1).join(' ')
            }
          />
        </label>
        <label>
          Telefone
          <input name="phone" required defaultValue={order?.phone} />
        </label>
        <label>
          Morada
          <input name="line1" required defaultValue={address.line1} />
        </label>
        <label>
          Código postal
          <input
            name="postalCode"
            required
            pattern="\d{4}-\d{3}"
            defaultValue={address.postalCode}
          />
        </label>
        <label>
          Localidade
          <input name="city" required defaultValue={address.city} />
        </label>
        <label>
          Origem
          <select name="source" defaultValue={order?.source ?? 'PHONE'}>
            <option value="PHONE">Telefone</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="IN_PERSON">Presencial</option>
            <option value="SALES">Vendedor</option>
            <option value="B2B">B2B</option>
          </select>
        </label>
        <label>
          Entrega
          <select
            name="deliveryMethodId"
            required
            defaultValue={order?.deliveryMethod.id}
          >
            {deliveryMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            name="requiresApproval"
            type="checkbox"
            defaultChecked={order?.requiresApproval}
          />{' '}
          Exige aprovação
        </label>
        <h2>Artigos</h2>
        {lines.map((line, index) => (
          <div className="admin-filters" key={index}>
            <select
              value={line.productId}
              required
              onChange={(event) =>
                setLines((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, productId: event.target.value }
                      : item,
                  ),
                )
              }
            >
              <option value="">Selecionar produto</option>
              {products.map((product) => (
                <option value={product.id} key={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Quantidade"
              type="number"
              min="1"
              value={line.quantity}
              onChange={(event) =>
                setLines((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, quantity: Number(event.target.value) }
                      : item,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() =>
                setLines((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setLines((current) => [...current, { productId: '', quantity: 1 }])
          }
        >
          + Artigo
        </button>
        <label>
          Notas do cliente
          <textarea
            name="customerNotes"
            defaultValue={order?.customerNotes ?? ''}
          />
        </label>
        <label>
          Notas internas
          <textarea
            name="internalNotes"
            defaultValue={order?.internalNotes ?? ''}
          />
        </label>
        <button className="admin-primary">Guardar rascunho</button>
      </form>
    </>
  );
}
