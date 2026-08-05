'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

type Supplier = {
  id: string;
  tradeName: string;
  legalName: string | null;
  taxNumber: string | null;
  email: string;
  phone: string;
  website: string | null;
  primaryContact: string | null;
  address: Record<string, unknown>;
  paymentTerms: string | null;
  averageLeadTimeDays: number | null;
  internalNotes: string | null;
  isActive: boolean;
  products?: unknown[];
  purchaseOrders?: unknown[];
};

export function SuppliersAdmin({ supplierId }: { supplierId?: string }) {
  const router = useRouter();
  const formMode = supplierId !== undefined;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (supplierId) {
        setSupplier(
          await managementApi.get<Supplier>(
            `/v1/admin/suppliers/${supplierId}`,
          ),
        );
      } else if (!formMode) {
        setSuppliers(
          await managementApi.get<Supplier[]>('/v1/admin/suppliers'),
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, [formMode, supplierId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) return suppliers;
    return suppliers.filter((item) =>
      `${item.tradeName} ${item.legalName ?? ''} ${item.email} ${item.taxNumber ?? ''}`
        .toLocaleLowerCase('pt-PT')
        .includes(normalized),
    );
  }, [query, suppliers]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      tradeName: data.tradeName,
      legalName: data.legalName || undefined,
      taxNumber: data.taxNumber || undefined,
      email: data.email,
      phone: data.phone,
      website: data.website || undefined,
      primaryContact: data.primaryContact || undefined,
      address: {
        line1: data.line1,
        postalCode: data.postalCode,
        city: data.city,
        countryCode: data.countryCode,
      },
      paymentTerms: data.paymentTerms || undefined,
      averageLeadTimeDays: data.averageLeadTimeDays
        ? Number(data.averageLeadTimeDays)
        : undefined,
      internalNotes: data.internalNotes || undefined,
      isActive: data.isActive === 'on',
    };
    try {
      await managementApi.request(
        supplierId
          ? `/v1/admin/suppliers/${supplierId}`
          : '/v1/admin/suppliers',
        {
          method: supplierId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      router.push('/fornecedores');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Supplier) => {
    if (
      !confirm(
        `Eliminar ${item.tradeName}? Se tiver histórico, será apenas desativado.`,
      )
    )
      return;
    try {
      await managementApi.delete(`/v1/admin/suppliers/${item.id}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  };

  if (loading)
    return (
      <div className="admin-state" aria-busy="true">
        A carregar fornecedores…
      </div>
    );

  if (formMode) {
    const address = supplier?.address ?? {};
    return (
      <section className="admin-page">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Compras e stock</p>
            <h1>{supplierId ? 'Editar fornecedor' : 'Novo fornecedor'}</h1>
            <p>Contactos, condições e dados de abastecimento.</p>
          </div>
          <Link className="admin-secondary" href="/fornecedores">
            Voltar
          </Link>
        </header>
        {error && <p className="admin-error">{error}</p>}
        <form className="admin-form" onSubmit={(event) => void submit(event)}>
          <label>
            Nome comercial
            <input
              required
              name="tradeName"
              defaultValue={supplier?.tradeName}
            />
          </label>
          <label>
            Denominação legal
            <input name="legalName" defaultValue={supplier?.legalName ?? ''} />
          </label>
          <label>
            NIF
            <input name="taxNumber" defaultValue={supplier?.taxNumber ?? ''} />
          </label>
          <label>
            Contacto principal
            <input
              name="primaryContact"
              defaultValue={supplier?.primaryContact ?? ''}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              name="email"
              defaultValue={supplier?.email}
            />
          </label>
          <label>
            Telefone
            <input required name="phone" defaultValue={supplier?.phone} />
          </label>
          <label className="wide">
            Website
            <input name="website" defaultValue={supplier?.website ?? ''} />
          </label>
          <label className="wide">
            Morada
            <input
              required
              name="line1"
              defaultValue={String(address.line1 ?? '')}
            />
          </label>
          <label>
            Código postal
            <input
              required
              name="postalCode"
              defaultValue={String(address.postalCode ?? '')}
            />
          </label>
          <label>
            Localidade
            <input
              required
              name="city"
              defaultValue={String(address.city ?? '')}
            />
          </label>
          <label>
            País
            <input
              required
              name="countryCode"
              maxLength={2}
              defaultValue={String(address.countryCode ?? 'PT')}
            />
          </label>
          <label>
            Prazo médio, dias
            <input
              type="number"
              min="0"
              name="averageLeadTimeDays"
              defaultValue={supplier?.averageLeadTimeDays ?? ''}
            />
          </label>
          <label className="wide">
            Condições de pagamento
            <input
              name="paymentTerms"
              defaultValue={supplier?.paymentTerms ?? ''}
            />
          </label>
          <label className="wide">
            Notas internas
            <textarea
              name="internalNotes"
              defaultValue={supplier?.internalNotes ?? ''}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={supplier?.isActive ?? true}
            />{' '}
            Ativo
          </label>
          <button className="admin-primary" disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar fornecedor'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Compras e stock</p>
          <h1>Fornecedores</h1>
          <p>Parceiros, contactos e condições de compra.</p>
        </div>
        <Link className="admin-primary" href="/fornecedores/novo">
          Novo fornecedor
        </Link>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-list-toolbar">
        <label>
          <span>Pesquisar</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <small>{filtered.length} fornecedores</small>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Contacto</th>
              <th>NIF</th>
              <th>Estado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.tradeName}</strong>
                  <small>{item.legalName}</small>
                </td>
                <td>
                  {item.email}
                  <small>{item.phone}</small>
                </td>
                <td>{item.taxNumber ?? '—'}</td>
                <td>{item.isActive ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <Link href={`/fornecedores/${item.id}`}>Editar</Link>
                  <button type="button" onClick={() => void remove(item)}>
                    {item.isActive ? 'Eliminar' : 'Remover'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
