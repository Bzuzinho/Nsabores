'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type AdminRecord = Record<string, unknown>;

const money = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});
const date = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is AdminRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown, key = ''): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    if (/cents$/i.test(key)) return money.format(value / 100);
    return new Intl.NumberFormat('pt-PT').format(value);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.valueOf())) return date.format(parsed);
    }
    return value.replaceAll('_', ' ');
  }
  if (Array.isArray(value))
    return `${value.length} ${value.length === 1 ? 'registo' : 'registos'}`;
  if (isRecord(value)) {
    const preferred = ['name', 'tradeName', 'number', 'email', 'sku'];
    for (const candidate of preferred) {
      if (typeof value[candidate] === 'string') return String(value[candidate]);
    }
    return 'Informação associada';
  }
  return String(value);
}

function flattenRow(row: AdminRecord) {
  const flattened: AdminRecord = {};
  Object.entries(row).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      flattened[key] = value;
      return;
    }
    if (isRecord(value)) {
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        if (!isRecord(nestedValue) && !Array.isArray(nestedValue)) {
          flattened[`${key}.${nestedKey}`] = nestedValue;
        }
      });
      return;
    }
    flattened[key] = value;
  });
  return flattened;
}

function rowsFromData(data: unknown): AdminRecord[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data) && Array.isArray(data.data))
    return data.data.filter(isRecord);
  return [];
}

function visibleColumns(rows: AdminRecord[]) {
  const ignored = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt']);
  const priority = [
    'number',
    'name',
    'tradeName',
    'product.name',
    'product.sku',
    'sku',
    'email',
    'status',
    'quantity',
    'onHandQuantity',
    'reservedQuantity',
    'totalCents',
    'createdAt',
  ];
  const keys = Array.from(
    new Set(rows.flatMap((row) => Object.keys(flattenRow(row)))),
  ).filter((key) => !ignored.has(key));
  return keys
    .sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
    })
    .slice(0, 8);
}

function RecordTable({
  rows,
  detailBasePath,
}: {
  rows: AdminRecord[];
  detailBasePath?: string;
}) {
  const columns = visibleColumns(rows);
  if (!rows.length)
    return <div className="admin-state">Ainda não existem registos.</div>;
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{humanize(column)}</th>
            ))}
            {detailBasePath && <th aria-label="Ações" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const flat = flattenRow(row);
            return (
              <tr key={typeof row.id === 'string' ? row.id : index}>
                {columns.map((column) => (
                  <td key={column}>{formatValue(flat[column], column)}</td>
                ))}
                {detailBasePath && typeof row.id === 'string' && (
                  <td className="admin-table-action">
                    <Link href={`${detailBasePath}/${row.id}`}>Abrir</Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecordDetail({ data }: { data: AdminRecord }) {
  const simple = Object.entries(data).filter(
    ([, value]) => !Array.isArray(value),
  );
  const collections = Object.entries(data).filter(([, value]) =>
    Array.isArray(value),
  );
  return (
    <div className="admin-detail-stack">
      <dl className="admin-detail-grid">
        {simple.map(([key, value]) => (
          <div key={key}>
            <dt>{humanize(key)}</dt>
            <dd>{formatValue(value, key)}</dd>
          </div>
        ))}
      </dl>
      {collections.map(([key, value]) => (
        <section className="admin-related" key={key}>
          <h2>{humanize(key)}</h2>
          <RecordTable rows={(value as unknown[]).filter(isRecord)} />
        </section>
      ))}
    </div>
  );
}

export function OperationsModule({
  title,
  endpoint,
  description,
  createHref,
  createLabel = 'Novo registo',
  detailBasePath,
}: {
  title: string;
  endpoint: string;
  description: string;
  createHref?: string;
  createLabel?: string;
  detailBasePath?: string;
}) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    managementApi
      .get<unknown>(`/v1/admin/${endpoint}`)
      .then(setData)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Erro inesperado.'),
      );
  }, [endpoint]);

  const rows = useMemo(() => rowsFromData(data), [data]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) return rows;
    return rows.filter((row) =>
      Object.entries(flattenRow(row)).some(([, value]) =>
        formatValue(value).toLocaleLowerCase('pt-PT').includes(normalized),
      ),
    );
  }, [query, rows]);
  const detail = isRecord(data) && !Array.isArray(data.data) ? data : null;

  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Gestão operacional</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {createHref && (
          <Link className="admin-primary" href={createHref}>
            {createLabel}
          </Link>
        )}
      </header>
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : data === undefined ? (
        <div className="admin-state" aria-busy="true">
          A carregar…
        </div>
      ) : detail ? (
        <RecordDetail data={detail} />
      ) : (
        <>
          <div className="admin-list-toolbar">
            <label>
              <span>Pesquisar</span>
              <input
                type="search"
                placeholder={`Pesquisar em ${title.toLocaleLowerCase('pt-PT')}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <small>
              {filteredRows.length}{' '}
              {filteredRows.length === 1 ? 'registo' : 'registos'}
            </small>
          </div>
          <RecordTable rows={filteredRows} detailBasePath={detailBasePath} />
        </>
      )}
    </section>
  );
}
