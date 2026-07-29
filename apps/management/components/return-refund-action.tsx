'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type ReturnDetail = {
  id: string;
  number: string;
  status: string;
  resolution: string;
  items: Array<{ eligibleRefundCents: number }>;
};

const money = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );

export function ReturnRefundAction({ id }: { id: string }) {
  const [request, setRequest] = useState<ReturnDetail | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRequest(
        await managementApi.get<ReturnDetail>(`/v1/admin/returns/${id}`),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o reembolso.',
      );
    }
  }, [id]);

  useEffect(() => {
    // Initial synchronization with the management API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const total = useMemo(
    () =>
      request?.items.reduce((sum, item) => sum + item.eligibleRefundCents, 0) ??
      0,
    [request],
  );

  if (!request || request.resolution !== 'REFUND') return null;
  const allowed = ['INSPECTED', 'REFUND_PENDING'].includes(request.status);
  if (request.status === 'REFUNDED') {
    return (
      <p>
        <strong>Reembolso emitido: {money(total)}</strong>
      </p>
    );
  }

  async function refund() {
    if (
      !window.confirm(
        `Emitir reembolso de ${money(total)} através do provider de pagamentos?`,
      )
    )
      return;
    setWorking(true);
    setError('');
    try {
      await managementApi.post(`/v1/admin/returns/${id}/refund`);
      await reload();
      window.location.reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'O reembolso falhou.',
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="user-detail">
      <h2>Reembolso</h2>
      <p>
        Montante elegível: <strong>{money(total)}</strong>
      </p>
      {error && <p className="admin-error">{error}</p>}
      <button
        className="admin-primary"
        disabled={!allowed || working || total <= 0}
        onClick={() => void refund()}
      >
        {working ? 'A emitir…' : 'Emitir reembolso pelo provider'}
      </button>
      {!allowed && (
        <p>
          A devolução tem de estar inspecionada antes de o reembolso poder ser
          emitido.
        </p>
      )}
    </section>
  );
}
