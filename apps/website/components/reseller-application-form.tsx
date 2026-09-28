'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '');

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
        ['tradeName', 'Nome comercial', 'text'],
        ['legalName', 'Denominação legal', 'text'],
        ['taxNumber', 'NIF/NIPC', 'text'],
        ['contactName', 'Pessoa de contacto', 'text'],
        ['email', 'Email', 'email'],
        ['phone', 'Telefone', 'tel'],
        ['activity', 'Atividade', 'text'],
        ['line1', 'Morada', 'text'],
        ['postalCode', 'Código postal', 'text'],
        ['city', 'Localidade', 'text'],
      ].map(([name, label, type]) => (
        <label key={name} className="grid gap-1">
          {label}
          <input
            required
            name={name}
            type={type}
            pattern={
              name === 'taxNumber'
                ? '\\d{9}'
                : name === 'postalCode'
                  ? '\\d{4}-\\d{3}'
                  : undefined
            }
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
