'use client';

import type { DeliveryMethod } from '@nsabores/types';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

export function DeliveryMethodsAdmin() {
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setMethods(
        await managementApi.get<DeliveryMethod[]>('/v1/admin/delivery-methods'),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function save(
    event: FormEvent<HTMLFormElement>,
    method: DeliveryMethod,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId(method.id);
    setError('');
    try {
      await managementApi.patch(`/v1/admin/delivery-methods/${method.id}`, {
        isActive: form.get('isActive') === 'on',
        priceCents: Math.round(Number(form.get('price')) * 100),
        freeShippingAboveCents: form.get('freeShippingAbove')
          ? Math.round(Number(form.get('freeShippingAbove')) * 100)
          : null,
      });
      setMessage(`${method.name} atualizado.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setBusyId('');
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await managementApi.post('/v1/admin/delivery-methods', {
        code: form.get('code'),
        name: form.get('name'),
        type: form.get('type'),
        isActive: true,
        priceCents: Math.round(Number(form.get('price')) * 100),
        freeShippingAboveCents: null,
      });
      event.currentTarget.reset();
      setMessage('Método de entrega criado.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível criar.',
      );
    }
  }

  async function remove(method: DeliveryMethod) {
    if (
      !confirm(
        `Eliminar ${method.name}? Se tiver histórico será apenas desativado.`,
      )
    )
      return;
    try {
      await managementApi.delete(`/v1/admin/delivery-methods/${method.id}`);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível eliminar.',
      );
    }
  }

  return (
    <section className="admin-page operational-stack">
      {message && <div className="admin-message">{message}</div>}
      {error && <div className="admin-error">{error}</div>}
      <header className="admin-header">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Métodos de entrega</h1>
          <p>Disponibilidade, custo base e limiar para portes gratuitos.</p>
        </div>
      </header>
      <form className="admin-card operational-form" onSubmit={create}>
        <h2>Novo método</h2>
        <label>
          Código
          <input name="code" required />
        </label>
        <label>
          Nome
          <input name="name" required />
        </label>
        <label>
          Tipo
          <select name="type">
            <option value="STANDARD">Entrega</option>
            <option value="LOCAL_PICKUP">Recolha local</option>
          </select>
        </label>
        <label>
          Preço (€)
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
          />
        </label>
        <button className="admin-primary">Criar método</button>
      </form>
      <div className="delivery-method-grid">
        {methods.map((method) => (
          <form
            className="admin-card operational-form"
            key={method.id}
            onSubmit={(event) => void save(event, method)}
          >
            <div>
              <p className="eyebrow">{method.type}</p>
              <h2>{method.name}</h2>
              <small>{method.code}</small>
            </div>
            <label>
              Preço (€)
              <input
                min="0"
                name="price"
                required
                step="0.01"
                type="number"
                defaultValue={method.priceCents / 100}
              />
            </label>
            <label>
              Portes grátis a partir de (€)
              <input
                min="0"
                name="freeShippingAbove"
                step="0.01"
                type="number"
                defaultValue={
                  method.freeShippingAboveCents === null
                    ? ''
                    : method.freeShippingAboveCents / 100
                }
              />
            </label>
            <label className="operational-check">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={method.isActive}
              />
              Disponível no checkout
            </label>
            <button className="admin-primary" disabled={busyId === method.id}>
              {busyId === method.id ? 'A guardar…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => void remove(method)}>
              Eliminar/desativar
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
