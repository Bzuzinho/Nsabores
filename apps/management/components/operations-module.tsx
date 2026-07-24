'use client';

import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function OperationsModule({
  title,
  endpoint,
  description,
}: {
  title: string;
  endpoint: string;
  description: string;
}) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${apiUrl}/v1/admin/${endpoint}`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Não foi possível carregar os dados.');
        setData(await response.json());
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Erro inesperado.'),
      );
  }, [endpoint]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-stone-600">{description}</p>
      {error ? (
        <p className="mt-8 rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : (
        <pre className="mt-8 max-h-[65vh] overflow-auto rounded-xl bg-stone-950 p-5 text-xs text-stone-100">
          {data ? JSON.stringify(data, null, 2) : 'A carregar…'}
        </pre>
      )}
    </main>
  );
}
