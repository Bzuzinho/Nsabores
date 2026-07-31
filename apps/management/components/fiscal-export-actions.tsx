'use client';

import Link from 'next/link';

export function FiscalExportActions() {
  async function downloadDocuments() {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const response = await fetch(`${base}/v1/admin/fiscal/documents.csv`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Não foi possível exportar os documentos.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'documentos-fiscais.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-actions">
      <Link className="admin-primary" href="/documentos/reconciliacao">
        Reconciliação
      </Link>
      <button className="admin-secondary" onClick={() => void downloadDocuments()}>
        Exportar documentos CSV
      </button>
    </div>
  );
}
