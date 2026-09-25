'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type OrderDocument = {
  id: string;
  type: string;
  label: string;
  reference?: string | null;
  documentDate?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

const labels: Record<string, string> = {
  INVOICE: 'Fatura',
  RECEIPT: 'Recibo',
  INVOICE_RECEIPT: 'Fatura-recibo',
  CREDIT_NOTE: 'Nota de crédito',
  DELIVERY_NOTE: 'Guia / documento de entrega',
  OTHER: 'Outro documento',
};

const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function OrderDocumentsAdmin({ orderId }: { orderId: string }) {
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setDocuments(
      await managementApi.get<OrderDocument[]>(
        `/v1/admin/orders/${orderId}/documents`,
      ),
    );
  }, [orderId]);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar os documentos.',
      ),
    );
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');
    if (!(file instanceof File) || !file.size) {
      setError('Selecione um ficheiro.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await managementApi.postForm(
        `/v1/admin/orders/${orderId}/documents`,
        data,
      );
      form.reset();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível carregar o documento.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remover este documento da área do cliente?')) return;
    setError('');
    try {
      await managementApi.delete(
        `/v1/admin/orders/${orderId}/documents/${id}`,
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível remover o documento.',
      );
    }
  }

  return (
    <section className="user-detail">
      <h2>Documentos do cliente</h2>
      <p>
        Carregue aqui os documentos reais associados a esta encomenda. Ficam
        imediatamente disponíveis para consulta e descarga na área de cliente.
      </p>

      {error && <p className="admin-error">{error}</p>}

      <form className="operational-form" onSubmit={upload}>
        <label>
          Tipo de documento
          <select name="type" defaultValue="INVOICE">
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Título
          <input
            name="label"
            required
            maxLength={120}
            placeholder="Ex.: Fatura da encomenda"
          />
        </label>
        <label>
          Referência / número
          <input name="reference" maxLength={120} placeholder="Opcional" />
        </label>
        <label>
          Data do documento
          <input name="documentDate" type="date" />
        </label>
        <label className="wide">
          Ficheiro
          <input
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            required
          />
          <small>PDF, JPG ou PNG, até 8 MB.</small>
        </label>
        <button className="admin-primary" disabled={busy}>
          {busy ? 'A carregar…' : 'Disponibilizar ao cliente'}
        </button>
      </form>

      {!documents.length ? (
        <p>Ainda não foram carregados documentos para esta encomenda.</p>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Referência</th>
                <th>Data</th>
                <th>Ficheiro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <strong>{document.label}</strong>
                    <small>{labels[document.type] ?? document.type}</small>
                  </td>
                  <td>{document.reference || '—'}</td>
                  <td>
                    {document.documentDate
                      ? new Date(document.documentDate).toLocaleDateString(
                          'pt-PT',
                        )
                      : new Date(document.createdAt).toLocaleDateString('pt-PT')}
                  </td>
                  <td>
                    <a
                      href={`/v1/admin/orders/${orderId}/documents/${document.id}/download`}
                    >
                      {document.fileName}
                    </a>
                    <small>{size(document.sizeBytes)}</small>
                  </td>
                  <td>
                    <button type="button" onClick={() => void remove(document.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
