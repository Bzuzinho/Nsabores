'use client';

import { ApiClient } from '@nsabores/api-client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

export function GiftCardPurchaseForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.post<{ redirectUrl: string }>(
        '/v1/gift-card-purchases',
        {
          purchaserEmail: String(data.get('purchaserEmail')),
          recipientEmail: String(data.get('recipientEmail')),
          recipientName: String(data.get('recipientName') ?? '') || undefined,
          message: String(data.get('message') ?? '') || undefined,
          amountCents: Number(data.get('amountEuros')) * 100,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      router.push(result.redirectUrl);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível iniciar a compra do vale.',
      );
      setBusy(false);
    }
  }

  return (
    <form className="account-card auth-form" onSubmit={submit}>
      <p className="eyebrow">Vale-oferta Nsabores</p>
      <h1>Comprar vale</h1>
      <label>
        O seu email
        <input name="purchaserEmail" type="email" required />
      </label>
      <label>
        Email do destinatário
        <input name="recipientEmail" type="email" required />
      </label>
      <label>
        Nome do destinatário
        <input name="recipientName" maxLength={120} />
      </label>
      <label>
        Montante
        <select name="amountEuros" defaultValue="50">
          <option value="10">10 €</option>
          <option value="25">25 €</option>
          <option value="50">50 €</option>
          <option value="75">75 €</option>
          <option value="100">100 €</option>
        </select>
      </label>
      <label>
        Mensagem
        <textarea name="message" maxLength={500} />
      </label>
      <p>
        O vale só será emitido depois da confirmação do pagamento. O código será
        apresentado uma única vez.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className="button button-primary" disabled={busy}>
        {busy ? 'A iniciar pagamento…' : 'Continuar para pagamento'}
      </button>
    </form>
  );
}
