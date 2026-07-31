'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

type ProviderMode = { mode: 'manual' | 'mock' };
type FiscalDocument = {
  id: string;
  status: string;
  provider: string;
  externalNumber?: string | null;
  externalDocumentUrl?: string | null;
  providerReference?: string | null;
  providerError?: string | null;
};

export function FiscalProviderAdmin({ id }: { id: string }) {
  const [mode, setMode] = useState<'manual' | 'mock'>('manual');
  const [document, setDocument] = useState<FiscalDocument | null>(null);
  const [externalNumber, setExternalNumber] = useState('');
  const [externalDocumentUrl, setExternalDocumentUrl] = useState('');
  const [providerReference, setProviderReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [provider, current] = await Promise.all([
      managementApi.get<ProviderMode>('/v1/admin/fiscal/provider'),
      managementApi.get<FiscalDocument>(`/v1/admin/fiscal/documents/${id}`),
    ]);
    setMode(provider.mode);
    setDocument(current);
    setExternalNumber(current.externalNumber ?? '');
    setExternalDocumentUrl(current.externalDocumentUrl ?? '');
    setProviderReference(current.providerReference ?? '');
  }

  useEffect(() => {
    void load().catch((reason: unknown) => {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o provider fiscal.',
      );
    });
  }, [id]);

  async function registerManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await managementApi.post(`/v1/admin/fiscal/documents/${id}/provider/manual`, {
        externalNumber,
        externalDocumentUrl: externalDocumentUrl || undefined,
        providerReference: providerReference || undefined,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registar o documento externo.');
    } finally {
      setBusy(false);
    }
  }

  async function processMock(simulateFailure: boolean) {
    setBusy(true);
    setError('');
    try {
      await managementApi.post(`/v1/admin/fiscal/documents/${id}/provider/mock`, {
        simulateFailure,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível processar o documento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card">
      <h2>Provider fiscal</h2>
      <p>
        Modo configurado: <strong>{mode}</strong> · estado atual:{' '}
        <strong>{document?.status ?? '—'}</strong>
      </p>
      {document?.providerError && <p className="admin-error">{document.providerError}</p>}
      {error && <p className="admin-error">{error}</p>}

      {mode === 'manual' ? (
        <form className="admin-form" onSubmit={registerManual}>
          <label>
            Número externo
            <input
              value={externalNumber}
              onChange={(event) => setExternalNumber(event.target.value)}
              required
            />
          </label>
          <label>
            URL do documento
            <input
              type="url"
              value={externalDocumentUrl}
              onChange={(event) => setExternalDocumentUrl(event.target.value)}
            />
          </label>
          <label>
            Referência do provider
            <input
              value={providerReference}
              onChange={(event) => setProviderReference(event.target.value)}
            />
          </label>
          <button className="admin-primary" disabled={busy || !externalNumber.trim()}>
            {busy ? 'A guardar…' : document?.status === 'FAILED' ? 'Reprocessar manualmente' : 'Registar documento externo'}
          </button>
        </form>
      ) : (
        <div className="admin-actions">
          <button className="admin-primary" disabled={busy} onClick={() => void processMock(false)}>
            {document?.status === 'FAILED' ? 'Reprocessar com sucesso' : 'Processar com sucesso'}
          </button>
          <button disabled={busy} onClick={() => void processMock(true)}>
            Simular falha
          </button>
        </div>
      )}
    </section>
  );
}
