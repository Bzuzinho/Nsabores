'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

type Line = {
  id: string;
  description: string;
  sku?: string | null;
  quantity: number;
};

type Document = {
  id: string;
  number?: string | null;
  type: string;
  status: string;
  lines: Line[];
};

export function CreditNoteAdmin({ documentId }: { documentId: string }) {
  const [document, setDocument] = useState<Document | null>(null);
  const [mode, setMode] = useState<'TOTAL' | 'PARTIAL'>('TOTAL');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void managementApi
      .get<Document>(`/v1/admin/fiscal/documents/${documentId}`)
      .then((response) => {
        if (!active) return;
        setDocument(response);
        setQuantities(
          Object.fromEntries(response.lines.map((line) => [line.id, 0])),
        );
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar o documento.',
          );
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const lines =
        mode === 'PARTIAL'
          ? Object.entries(quantities)
              .filter(([, quantity]) => quantity > 0)
              .map(([lineId, quantity]) => ({ lineId, quantity }))
          : undefined;
      if (mode === 'PARTIAL' && !lines?.length) {
        throw new Error('Indique pelo menos uma quantidade a creditar.');
      }
      const credit = await managementApi.post<{ id: string }>(
        `/v1/admin/fiscal/documents/${documentId}/credit-notes`,
        {
          idempotencyKey: crypto.randomUUID(),
          reason,
          lines,
        },
      );
      window.location.assign(`/documentos/${credit.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível emitir a nota de crédito.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!document) return <div className="admin-state">A carregar…</div>;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Nota de crédito</p>
          <h1>{document.number ?? document.id}</h1>
          <p>
            {document.type} · {document.status}
          </p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <form className="admin-card" onSubmit={submit}>
        <label>
          Tipo de crédito
          <select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as 'TOTAL' | 'PARTIAL')
            }
          >
            <option value="TOTAL">Total do saldo ainda creditável</option>
            <option value="PARTIAL">Parcial por linha</option>
          </select>
        </label>
        <label>
          Motivo
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </label>
        {mode === 'PARTIAL' && (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Quantidade original</th>
                  <th>Quantidade a creditar</th>
                </tr>
              </thead>
              <tbody>
                {document.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {line.description}
                      <small>{line.sku ?? ''}</small>
                    </td>
                    <td>{line.quantity}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={line.quantity}
                        value={quantities[line.id] ?? 0}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [line.id]: Number(event.target.value),
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="admin-primary" disabled={busy || !reason.trim()}>
          {busy ? 'A emitir…' : 'Emitir nota de crédito'}
        </button>
      </form>
      <p>
        <Link href={`/documentos/${documentId}`}>Voltar ao documento</Link>
      </p>
    </>
  );
}
