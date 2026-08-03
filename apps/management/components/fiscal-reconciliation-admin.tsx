'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type PaymentGap = {
  sourceType: string;
  sourceId: string;
  reference: string;
  customer: string;
  email: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

type DocumentGap = {
  id: string;
  number?: string | null;
  type: string;
  status: string;
  sourceType: string;
  sourceId?: string | null;
  totalCents: number;
  currency: string;
  issuedAt?: string | null;
  reason: string;
};

type Report = {
  metrics: {
    paymentsWithoutDocument: number;
    documentsWithoutFinancialMatch: number;
  };
  paymentsWithoutDocument: PaymentGap[];
  documentsWithoutFinancialMatch: DocumentGap[];
};

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(
    cents / 100,
  );

function downloadCsv(filename: string, rows: unknown[][]) {
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };
  const content = rows.map((row) => row.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FiscalReconciliationAdmin() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void managementApi
      .get<Report>('/v1/admin/fiscal/reconciliation')
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Não foi possível carregar a reconciliação fiscal.',
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const exportReport = () => {
    if (!report) return;
    downloadCsv('reconciliacao-fiscal.csv', [
      [
        'tipo',
        'origem',
        'id_origem',
        'referencia',
        'cliente',
        'email',
        'valor_centimos',
        'moeda',
        'data',
        'motivo',
      ],
      ...report.paymentsWithoutDocument.map((item) => [
        'PAGAMENTO_SEM_DOCUMENTO',
        item.sourceType,
        item.sourceId,
        item.reference,
        item.customer,
        item.email,
        item.amountCents,
        item.currency,
        item.createdAt,
        '',
      ]),
      ...report.documentsWithoutFinancialMatch.map((item) => [
        'DOCUMENTO_SEM_CORRESPONDENCIA_FINANCEIRA',
        item.sourceType,
        item.sourceId,
        item.number,
        '',
        '',
        item.totalCents,
        item.currency,
        item.issuedAt,
        item.reason,
      ]),
    ]);
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Faturação</p>
          <h1>Reconciliação documental</h1>
          <p>
            Controlo entre pagamentos confirmados e documentos comerciais
            emitidos.
          </p>
        </div>
        <button
          className="admin-primary"
          disabled={!report}
          onClick={exportReport}
        >
          Exportar CSV
        </button>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {!report ? (
        <p className="admin-state">A carregar…</p>
      ) : (
        <>
          <div className="admin-metrics">
            <article>
              <strong>{report.metrics.paymentsWithoutDocument}</strong>
              <span>Pagamentos sem documento</span>
            </article>
            <article>
              <strong>{report.metrics.documentsWithoutFinancialMatch}</strong>
              <span>Documentos sem correspondência</span>
            </article>
          </div>

          <section className="admin-card">
            <h2>Pagamentos confirmados sem documento</h2>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Origem</th>
                    <th>Referência</th>
                    <th>Cliente</th>
                    <th>Valor</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentsWithoutDocument.map((item) => (
                    <tr key={`${item.sourceType}:${item.sourceId}`}>
                      <td>
                        {item.sourceType}
                        <small>{item.sourceId}</small>
                      </td>
                      <td>{item.reference}</td>
                      <td>
                        {item.customer}
                        <small>{item.email}</small>
                      </td>
                      <td>{money(item.amountCents, item.currency)}</td>
                      <td>
                        {new Date(item.createdAt).toLocaleString('pt-PT')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.paymentsWithoutDocument.length && (
                <p className="admin-state">
                  Sem pagamentos pendentes de documento.
                </p>
              )}
            </div>
          </section>

          <section className="admin-card">
            <h2>Documentos sem correspondência financeira</h2>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Origem</th>
                    <th>Valor</th>
                    <th>Motivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {report.documentsWithoutFinancialMatch.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.number ?? 'Sem número'}
                        <small>
                          {item.type} · {item.status}
                        </small>
                      </td>
                      <td>
                        {item.sourceType}
                        <small>{item.sourceId ?? 'sem origem'}</small>
                      </td>
                      <td>{money(item.totalCents, item.currency)}</td>
                      <td>{item.reason}</td>
                      <td>
                        <Link href={`/documentos/${item.id}`}>Abrir</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.documentsWithoutFinancialMatch.length && (
                <p className="admin-state">
                  Sem documentos com inconsistências financeiras.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      <p>
        <Link href="/documentos">Voltar aos documentos</Link>
      </p>
    </>
  );
}
