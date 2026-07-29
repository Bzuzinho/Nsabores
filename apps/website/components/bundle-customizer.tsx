'use client';

import { ApiClient } from '@nsabores/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useShop } from '@/components/shop-context';
import { formatPrice } from '@/data/site';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

type Bundle = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productPriceCents: number;
  productImageUrl: string;
  mode: 'FIXED' | 'CONFIGURABLE';
  pricingMode: 'PRODUCT_PRICE' | 'COMPONENT_TOTAL';
  minimumSelections: number | null;
  maximumSelections: number | null;
  groups: Array<{
    id: string;
    code: string;
    name: string;
    minimumSelections: number;
    maximumSelections: number | null;
  }>;
  items: Array<{
    id: string;
    productId: string;
    groupId: string | null;
    quantity: number;
    isRequired: boolean;
    minimumQuantity: number;
    maximumQuantity: number | null;
    priceDeltaCents: number;
    productName: string;
    productImageUrl: string;
    stockStatus: string;
  }>;
  personalization: null | {
    allowGiftMessage: boolean;
    allowRecipientName: boolean;
    allowSpecialPackaging: boolean;
    specialPackagingCents: number;
    allowRequestedDate: boolean;
    allowNotes: boolean;
    allowHidePrice: boolean;
    messageMaxLength: number;
    notesMaxLength: number;
  };
};

type BundlePrice = {
  priceCents: number;
  packagingCents: number;
  composition: Array<{ bundleItemId: string; productId: string; name: string; quantity: number }>;
};

export function BundleCustomizer({ slug }: { slug: string }) {
  const { refreshCart, openCart } = useShop();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [price, setPrice] = useState<BundlePrice | null>(null);
  const [specialPackaging, setSpecialPackaging] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [hidePrice, setHidePrice] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api
      .get<Bundle>(`/v1/bundles/${slug}`)
      .then((value) => {
        setBundle(value);
        const initial: Record<string, number> = {};
        for (const item of value.items) {
          if (value.mode === 'FIXED' || item.isRequired) {
            initial[item.id] = Math.max(item.quantity, item.minimumQuantity, 1);
          }
        }
        setSelections(initial);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Cabaz indisponível.'));
  }, [slug]);

  const selectionPayload = useMemo(
    () =>
      Object.entries(selections)
        .filter(([, selectedQuantity]) => selectedQuantity > 0)
        .map(([bundleItemId, selectedQuantity]) => ({
          bundleItemId,
          quantity: selectedQuantity,
        })),
    [selections],
  );

  useEffect(() => {
    if (!bundle) return;
    const timer = window.setTimeout(() => {
      void api
        .post<BundlePrice>(`/v1/bundles/${slug}/price`, {
          selections: selectionPayload,
          specialPackaging,
        })
        .then((value) => {
          setPrice(value);
          setError('');
        })
        .catch((reason) => {
          setPrice(null);
          setError(reason instanceof Error ? reason.message : 'A composição ainda não é válida.');
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [bundle, selectionPayload, slug, specialPackaging]);

  if (!bundle) {
    return <main className="section"><p>{error || 'A carregar cabaz…'}</p></main>;
  }

  async function add() {
    setSaving(true);
    setError('');
    try {
      await api.post(`/v1/cart/bundles/${slug}`, {
        quantity,
        selections: selectionPayload,
        personalization: {
          giftMessage: giftMessage || undefined,
          recipientName: recipientName || undefined,
          specialPackaging,
          requestedDate: requestedDate || undefined,
          notes: notes || undefined,
          hidePrice,
        },
      });
      await refreshCart();
      openCart();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o cabaz.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main id="conteudo" className="section">
      <p className="eyebrow">Cabaz personalizado</p>
      <h1>{bundle.productName}</h1>
      <p><Link href={`/loja/${bundle.productSlug}`}>Voltar ao produto</Link></p>

      {bundle.groups.map((group) => (
        <section key={group.id} className="account-card">
          <h2>{group.name}</h2>
          <p>Escolha entre {group.minimumSelections} e {group.maximumSelections ?? 'sem limite'} unidade(s).</p>
          {bundle.items.filter((item) => item.groupId === group.id).map((item) => (
            <BundleOption key={item.id} item={item} value={selections[item.id] ?? 0} disabled={bundle.mode === 'FIXED'} onChange={(value) => setSelections((current) => ({ ...current, [item.id]: value }))} />
          ))}
        </section>
      ))}

      {bundle.items.some((item) => !item.groupId) && (
        <section className="account-card">
          <h2>Composição</h2>
          {bundle.items.filter((item) => !item.groupId).map((item) => (
            <BundleOption key={item.id} item={item} value={selections[item.id] ?? 0} disabled={bundle.mode === 'FIXED' || item.isRequired} onChange={(value) => setSelections((current) => ({ ...current, [item.id]: value }))} />
          ))}
        </section>
      )}

      {bundle.personalization && (
        <section className="account-card">
          <h2>Personalização da oferta</h2>
          {bundle.personalization.allowRecipientName && <label>Nome do destinatário<input maxLength={200} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></label>}
          {bundle.personalization.allowGiftMessage && <label>Mensagem<textarea maxLength={bundle.personalization.messageMaxLength} value={giftMessage} onChange={(event) => setGiftMessage(event.target.value)} /></label>}
          {bundle.personalization.allowSpecialPackaging && <label><input type="checkbox" checked={specialPackaging} onChange={(event) => setSpecialPackaging(event.target.checked)} /> Embalagem especial (+{formatPrice(bundle.personalization.specialPackagingCents)})</label>}
          {bundle.personalization.allowRequestedDate && <label>Data pretendida<input type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} /></label>}
          {bundle.personalization.allowNotes && <label>Observações<textarea maxLength={bundle.personalization.notesMaxLength} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>}
          {bundle.personalization.allowHidePrice && <label><input type="checkbox" checked={hidePrice} onChange={(event) => setHidePrice(event.target.checked)} /> Não incluir valores no packing slip</label>}
        </section>
      )}

      <section className="account-card">
        <h2>Resumo</h2>
        {price ? <p><strong>{formatPrice(price.priceCents)}</strong> por cabaz</p> : <p>Complete a composição para calcular o preço.</p>}
        <label>Quantidade<input type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value))))} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="button button-primary" disabled={!price || saving} onClick={() => void add()}>{saving ? 'A adicionar…' : 'Adicionar ao carrinho'}</button>
      </section>
    </main>
  );
}

function BundleOption({ item, value, disabled, onChange }: { item: Bundle['items'][number]; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <article className="cart-item">
      <Image src={item.productImageUrl} alt="" width={72} height={72} />
      <div><strong>{item.productName}</strong><small>{item.stockStatus === 'OUT_OF_STOCK' ? 'Esgotado' : item.isRequired ? 'Obrigatório' : 'Opcional'}</small></div>
      <input aria-label={`Quantidade de ${item.productName}`} type="number" min={item.minimumQuantity} max={item.maximumQuantity ?? 99} value={value} disabled={disabled || item.stockStatus === 'OUT_OF_STOCK'} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} />
    </article>
  );
}
