'use client';

import { ApiClient } from '@nsabores/api-client';
import type { CommerceOrder, DeliveryMethod } from '@nsabores/types';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useShop } from '@/components/shop-context';
import { formatPrice } from '@/data/site';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

type LoyaltyAccount = {
  availablePoints: number;
  pendingPoints: number;
  reservedPoints: number;
};

type CheckoutOrder = CommerceOrder & {
  paymentFlowMode?: 'manual' | 'automatic';
};

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, refreshCart } = useShop();
  const router = useRouter();
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [points, setPoints] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api.get<DeliveryMethod[]>('/v1/delivery-methods').then(setMethods);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoyalty(null);
      return;
    }
    void api
      .get<LoyaltyAccount>('/v1/account/loyalty')
      .then(setLoyalty)
      .catch(() => setLoyalty(null));
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const address = {
      firstName: String(data.get('firstName')),
      lastName: String(data.get('lastName')),
      line1: String(data.get('line1')),
      line2: String(data.get('line2') ?? ''),
      postalCode: String(data.get('postalCode')),
      city: String(data.get('city')),
      countryCode: 'PT',
      taxNumber: String(data.get('taxNumber') ?? '') || undefined,
    };
    try {
      const order = await api.post<CheckoutOrder>('/v1/checkout', {
        email: String(data.get('email')),
        customerName: `${address.firstName} ${address.lastName}`,
        phone: String(data.get('phone')),
        shippingAddress: address,
        billingAddress: address,
        deliveryMethodId: String(data.get('deliveryMethodId')),
        termsAccepted: data.get('termsAccepted') === 'on',
        privacyAccepted: data.get('privacyAccepted') === 'on',
        marketingConsent: data.get('marketingConsent') === 'on',
        customerNotes: String(data.get('customerNotes') ?? ''),
        loyaltyPoints: points > 0 ? points : undefined,
        giftCardCode: giftCardCode.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      await refreshCart();
      if (order.paymentFlowMode === 'manual' || order.status === 'PROCESSING') {
        router.push(`/checkout/sucesso?orderId=${order.id}&manual=1`);
        return;
      }
      if (order.totalCents > 0) {
        const payment = await api.post<{ redirectUrl: string }>(
          `/v1/orders/${order.id}/payment`,
          { idempotencyKey: crypto.randomUUID() },
        );
        router.push(payment.redirectUrl);
      } else {
        router.push(`/checkout/sucesso?orderId=${order.id}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Checkout falhou.');
      setSubmitting(false);
    }
  }

  const selected = methods[0];
  const hasFreeShippingPromotion = (cart?.discounts ?? []).some(
    (discount) => discount.freeShipping,
  );
  const shipping =
    selected &&
    !hasFreeShippingPromotion &&
    (selected.freeShippingAboveCents === null ||
      (cart?.subtotalCents ?? 0) < selected.freeShippingAboveCents)
      ? selected.priceCents
      : 0;
  const productDiscount =
    cart?.productDiscountCents ?? cart?.discountCents ?? 0;
  const estimatedBeforeBenefits = Math.max(
    0,
    (cart?.subtotalCents ?? 0) + shipping - productDiscount,
  );
  const requestedPoints = Math.min(
    points,
    loyalty?.availablePoints ?? 0,
    estimatedBeforeBenefits,
  );
  const estimatedTotal = Math.max(0, estimatedBeforeBenefits - requestedPoints);

  return (
    <main id="conteudo" className="account-page">
      <form className="account-card auth-form" onSubmit={submit}>
        <p className="eyebrow">Pedido de encomenda</p>
        <h1>Dados de entrega</h1>
        <p>
          A encomenda segue para preparação assim que for confirmada. O pagamento
          será combinado diretamente entre a Nsabores e o cliente e posteriormente
          confirmado pela empresa.
        </p>
        {!cart?.items.length && <p>O carrinho está vazio.</p>}
        <label>Email<input name="email" type="email" defaultValue={user?.email} required /></label>
        <label>Telefone<input name="phone" type="tel" defaultValue={user?.phone ?? ''} required /></label>
        <label>Nome<input name="firstName" defaultValue={user?.firstName} required /></label>
        <label>Apelido<input name="lastName" defaultValue={user?.lastName} required /></label>
        <label>Morada<input name="line1" required /></label>
        <label>Complemento<input name="line2" /></label>
        <label>Código postal<input name="postalCode" pattern="\d{4}-\d{3}" placeholder="0000-000" required /></label>
        <label>Localidade<input name="city" required /></label>
        <label>NIF (opcional)<input name="taxNumber" pattern="\d{9}" /></label>
        <label>
          Método de entrega
          <select
            name="deliveryMethodId"
            required
            onChange={(event) => {
              const method = methods.find(({ id }) => id === event.target.value);
              if (method) setMethods([method, ...methods.filter(({ id }) => id !== method.id)]);
            }}
          >
            {methods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name} — {formatPrice(method.priceCents)}
              </option>
            ))}
          </select>
        </label>

        {user && loyalty && (
          <label>
            Pontos a utilizar
            <input
              type="number"
              min="0"
              max={Math.min(loyalty.availablePoints, estimatedBeforeBenefits)}
              value={points}
              onChange={(event) => setPoints(Math.max(0, Number(event.target.value) || 0))}
            />
            <small>Disponíveis: {loyalty.availablePoints}. 1 ponto corresponde a 1 cêntimo.</small>
          </label>
        )}

        <label>
          Vale-oferta
          <input
            value={giftCardCode}
            onChange={(event) => setGiftCardCode(event.target.value)}
            placeholder="NS-XXXXXXXXXXXX"
            autoComplete="off"
          />
          <small>O saldo e a validade são confirmados no servidor.</small>
        </label>

        <label>Notas<textarea name="customerNotes" /></label>
        <label><input name="termsAccepted" type="checkbox" required /> Aceito os <a href="/termos">termos e condições</a>.</label>
        <label><input name="privacyAccepted" type="checkbox" required /> Li a <a href="/privacidade">política de privacidade</a>.</label>
        <label><input name="marketingConsent" type="checkbox" /> Quero receber novidades (opcional).</label>

        <div className="checkout-summary">
          <p>Subtotal: {formatPrice(cart?.subtotalCents ?? 0)}</p>
          {(cart?.discounts ?? [])
            .filter((discount) => !discount.freeShipping)
            .map((discount, index) => (
              <p key={`${discount.promotionId ?? discount.label}-${index}`}>
                {discount.label}{discount.code ? ` (${discount.code})` : ''}: −{formatPrice(discount.amountCents)}
              </p>
            ))}
          <p>Entrega: {hasFreeShippingPromotion ? 'Grátis' : formatPrice(shipping)}</p>
          {requestedPoints > 0 && <p>Pontos solicitados: −{formatPrice(requestedPoints)}</p>}
          {giftCardCode.trim() && <p>Vale-oferta: valor confirmado no servidor</p>}
          <p><strong>Total estimado: {formatPrice(estimatedTotal)}</strong></p>
          <small>O valor final é confirmado no servidor. O pagamento não é cobrado automaticamente.</small>
        </div>

        {error && <p role="alert">{error}</p>}
        <button className="button button-primary" disabled={submitting || !cart?.items.length}>
          {submitting ? 'A confirmar encomenda…' : 'Confirmar encomenda'}
        </button>
      </form>
    </main>
  );
}
