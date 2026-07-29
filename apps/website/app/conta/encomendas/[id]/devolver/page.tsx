'use client';

import type { CommerceOrder } from '@nsabores/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { accountApi } from '@/components/auth-provider';

type ReturnResponse = { id: string; number: string };

type ReturnLine = { quantity: number; reason: string; declaredCondition: string };

export default function ReturnOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  const [resolution, setResolution] = useState('REFUND');
  const [generalReason, setGeneralReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Record<string, ReturnLine>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void accountApi.get<CommerceOrder>(`/v1/account/orders/${id}`).then(setOrder);
  }, [id]);

  const selected = useMemo(() => Object.entries(lines).filter(([, line]) => line.quantity > 0), [lines]);

  if (!order) return <section className="account-card">A carregar…</section>;

  async function submit() {
    if (!selected.length) {
      setError('Selecione pelo menos um artigo para devolver.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await accountApi.post<ReturnResponse>('/v1/account/returns', {
        orderId: order.id,
        resolution,
        reason: generalReason || 'Devolução solicitada pelo cliente',
        customerNotes: notes || undefined,
        items: selected.map(([orderItemId, line]) => ({
          orderItemId,
          quantity: line.quantity,
          reason: line.reason || generalReason || 'Devolução solicitada pelo cliente',
          declaredCondition: line.declaredCondition || undefined,
        })),
      });
      router.push(`/devolucoes/${result.number}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o pedido de devolução.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-card">
      <p className="eyebrow">Devolução</p>
      <h1>{order.number}</h1>
      <p>Selecione os artigos e quantidades que pretende devolver.</p>
      {order.items.map((item) => {
        const value = lines[item.id] ?? { quantity: 0, reason: '', declaredCondition: '' };
        const update = (patch: Partial<ReturnLine>) => setLines((current) => ({ ...current, [item.id]: { ...value, ...patch } }));
        return (
          <article key={item.id}>
            <h2>{item.productName}</h2>
            <p>Comprado: {item.quantity}</p>
            <label>Quantidade
              <input type="number" min={0} max={item.quantity} value={value.quantity} onChange={(event) => update({ quantity: Math.max(0, Math.min(item.quantity, Number(event.target.value))) })} />
            </label>
            {value.quantity > 0 && <>
              <label>Motivo<input value={value.reason} onChange={(event) => update({ reason: event.target.value })} /></label>
              <label>Condição do artigo<input value={value.declaredCondition} onChange={(event) => update({ declaredCondition: event.target.value })} /></label>
            </>}
          </article>
        );
      })}
      <label>Resolução pretendida
        <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
          <option value="REFUND">Reembolso</option><option value="REPLACEMENT">Substituição</option><option value="CREDIT">Crédito</option><option value="OTHER">Outra</option>
        </select>
      </label>
      <label>Motivo geral<input value={generalReason} onChange={(event) => setGeneralReason(event.target.value)} /></label>
      <label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="button" disabled={saving || !['SHIPPED', 'DELIVERED'].includes(order.status)} onClick={() => void submit()}>
        {saving ? 'A submeter…' : 'Submeter pedido'}
      </button>
      {!['SHIPPED', 'DELIVERED'].includes(order.status) && <p>Esta encomenda ainda não está elegível para devolução.</p>}
    </section>
  );
}
