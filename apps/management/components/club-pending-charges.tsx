'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type PendingCharge = {
  id: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  currency: string;
  status: string;
  subscriptionStatus: string;
  planName: string;
  planCode: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

type FiscalDocument = {
  id: string;
};

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

export function ClubPendingCharges() {
  const [charges, setCharges] = useState<PendingCharge[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setCharges(
      await managementApi.get<PendingCharge[]>(
        '/v1/admin/club/pending-charges',
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;
    void managementApi
      .get<PendingCharge[]>('/v1/admin/club/pending-charges')
      .then((result) => {
        if (!cancelled) setCharges(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar as cobranças.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmAndIssue(charge: PendingCharge) {
    const reference = window.prompt(
      'Referência ou comprovativo do pagamento (opcional):',
      '',
    );
    if (reference === null) return;
    const note = window.prompt(
      'Nota interna da confirmação (opcional):',
      'Pagamento do Clube confirmado manualmente.',
    );
    if (note === null) return;

    setBusyId(charge.id);
    setError('');
    try {
      await managementApi.post(
        `/v1/admin/club/subscriptions/${charge.subscriptionId}/charges/${charge.id}/confirm`,
        { reference: reference || undefined, note: note || undefined },
      );
      const document = await managementApi.post<FiscalDocument>(
        `/v1/admin/fiscal/club-charges/${charge.id}/issue`,
        {},
      );
      window.location.assign(`/documentos/${document.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível confirmar o pagamento e emitir o documento.',
      );
      setBusyId(null);
      await load().catch(() => undefined);
    }
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Clube Nsabores</p>
          <h1>Cobranças pendentes</h1>
          <p>Adesões e renovações que aguardam confirmação manual.</p>
        </div>
      </header>

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plano</th>
              <th>Período</th>
              <th>Valor</th>
              <th>Subscrição</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => (
              <tr key={charge.id}>
                <td>
                  {charge.firstName} {charge.lastName}
                  <small>{charge.email}</small>
                </td>
                <td>
                  {charge.planName}
                  <small>{charge.planCode}</small>
                </td>
                <td>
                  {new Date(charge.periodStart).toLocaleDateString('pt-PT')} —{' '}
                  {new Date(charge.periodEnd).toLocaleDateString('pt-PT')}
                </td>
                <td>{money(charge.amountCents, charge.currency)}</td>
                <td>{charge.subscriptionStatus}</td>
                <td>
                  <button
                    className="admin-primary"
                    disabled={busyId === charge.id}
                    onClick={() => void confirmAndIssue(charge)}
                  >
                    {busyId === charge.id
                      ? 'A confirmar e emitir…'
                      : 'Confirmar e emitir documento'}
                  </button>{' '}
                  <Link href={`/clube/subscricoes/${charge.subscriptionId}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!charges.length && <p>Não existem cobranças pendentes do Clube.</p>}
    </>
  );
}
