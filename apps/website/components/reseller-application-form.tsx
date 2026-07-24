'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function ResellerApplicationForm() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    const response = await fetch(`${apiUrl}/v1/reseller-applications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tradeName: value('tradeName'),
        legalName: value('legalName'),
        taxNumber: value('taxNumber'),
        contactName: value('contactName'),
        email: value('email'),
        phone: value('phone'),
        activity: value('activity'),
        message: value('message'),
        address: {
          line1: value('line1'),
          postalCode: value('postalCode'),
          city: value('city'),
          countryCode: 'PT',
        },
      }),
    });
    if (response.ok) router.push('/revendedores/candidatura/sucesso');
    else setError('Não foi possível enviar a candidatura. Confirme os dados.');
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {[
        'tradeName',
        'legalName',
        'taxNumber',
        'contactName',
        'email',
        'phone',
        'activity',
        'line1',
        'postalCode',
        'city',
      ].map((name) => (
        <label key={name} className="grid gap-1 capitalize">
          {name}
          <input
            required
            name={name}
            className="rounded border border-stone-300 p-3"
          />
        </label>
      ))}
      <label className="grid gap-1">
        Mensagem
        <textarea
          name="message"
          className="rounded border border-stone-300 p-3"
        />
      </label>
      {error && <p className="text-red-700">{error}</p>}
      <button className="rounded bg-stone-900 px-5 py-3 text-white">
        Enviar candidatura
      </button>
    </form>
  );
}
