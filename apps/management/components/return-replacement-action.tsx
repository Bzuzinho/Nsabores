'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type ReturnDetail = {
  id: string;
  number: string;
  status: string;
  resolution: string;
};

type ReplacementOrder = {
  id: string;
  number: string;
};

export function ReturnReplacementAction({ id }: { id: string }) {
  const [request, setRequest] = useState<ReturnDetail | null>(null);
  const [replacement, setReplacement] = useState<ReplacementOrder | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void managementApi
      .get<ReturnDetail>(`/v1/admin/returns/${id}`)
      .then(setRequest)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a substituição.'));
  }, [id]);

  if (!request || request.resolution !== 'REPLACEMENT') return null;
  const allowed = ['APPROVED', 'INSPECTED'].includes(request.status);

  async function createReplacement() {
    if (!window.confirm('Criar uma encomenda de substituição a custo zero e reservar novamente o stock?')) return;
    setWorking(true);
    setError('');
    try {
      const order = await managementApi.post<ReplacementOrder>(`/v1/admin/returns/${id}/replacement`);
      setReplacement(order);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a substituição.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="user-detail">
      <h2>Substituição</h2>
      {error && <p className="admin-error">{error}</p>}
      {replacement ? (
        <p>Encomenda criada: <Link href={`/encomendas/${replacement.id}`}>{replacement.number}</Link></p>
      ) : (
        <button className="admin-primary" disabled={!allowed || working} onClick={() => void createReplacement()}>
          {working ? 'A criar…' : 'Criar encomenda de substituição'}
        </button>
      )}
      {!allowed && !replacement && <p>A devolução tem de estar aprovada ou inspecionada antes de criar a substituição.</p>}
    </section>
  );
}
