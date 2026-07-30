'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Row = {
  id: string;
  number: string;
  customerName: string;
  email: string;
  status: string;
  paymentStatus: string;
  agreementStatus: string | null;
  dueAt: string | null;
  itemCount: number;
  unitCount: number;
  createdAt: string;
  customerNotes: string | null;
};

export function ProductionAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    void managementApi.get<Row[]>('/v1/admin/production').then(setRows);
  }, []);

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Produção</h1>
          <p>Fila de encomendas em preparação, independente do estado do pagamento.</p>
        </div>
      </header>
      <div className="admin-table-wrap">
        <table>
          <thead><tr><th>Encomenda</th><th>Cliente</th><th>Produção</th><th>Pagamento</th><th>Itens</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.number}<small>{new Date(row.createdAt).toLocaleString('pt-PT')}</small></td>
                <td>{row.customerName}<small>{row.email}</small></td>
                <td>{row.status}{row.customerNotes && <small>{row.customerNotes}</small>}</td>
                <td>{row.paymentStatus}<small>{row.agreementStatus ?? 'Acordo por criar'}{row.dueAt ? ` · ${new Date(row.dueAt).toLocaleDateString('pt-PT')}` : ''}</small></td>
                <td>{row.itemCount} linhas · {row.unitCount} unidades</td>
                <td><Link href={`/encomendas/${row.id}`}>Preparar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
