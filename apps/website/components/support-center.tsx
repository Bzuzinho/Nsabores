'use client';

import { FormEvent, useEffect, useState } from 'react';
import { accountApi } from './auth-provider';

type SupportCase = {
  id: string;
  number: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  comments?: Array<{
    id: string;
    body: string;
    firstName?: string;
    lastName?: string;
    createdAt: string;
  }>;
};

export function SupportCenter() {
  const [items, setItems] = useState<SupportCase[]>([]);
  const [selected, setSelected] = useState<SupportCase | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    accountApi
      .get<SupportCase[]>('/v1/account/support-cases')
      .then(setItems)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível carregar o apoio.',
        ),
      );
  useEffect(() => {
    void load();
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const value = await accountApi.post<SupportCase>(
        '/v1/account/support-cases',
        {
          type: form.get('type'),
          subject: form.get('subject'),
          description: form.get('description'),
        },
      );
      event.currentTarget.reset();
      setSelected(value);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível abrir o pedido.',
      );
    }
  }
  async function open(item: SupportCase) {
    try {
      setSelected(
        await accountApi.get<SupportCase>(
          `/v1/account/support-cases/${item.id}`,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível abrir o pedido.',
      );
    }
  }
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      setSelected(
        await accountApi.post<SupportCase>(
          `/v1/account/support-cases/${selected.id}/comments`,
          { body: form.get('body') },
        ),
      );
      event.currentTarget.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível enviar a resposta.',
      );
    }
  }
  return (
    <main className="account-page">
      <header>
        <p className="eyebrow">Apoio ao cliente</p>
        <h1>Pedidos e conversa</h1>
        <p>Abra um pedido e acompanhe todas as respostas no mesmo local.</p>
      </header>
      {error && <p className="form-error">{error}</p>}
      <section className="account-grid">
        <form className="contact-form" onSubmit={create}>
          <h2>Novo pedido</h2>
          <label>
            Tipo
            <select name="type" defaultValue="OTHER">
              <option value="DELAY">Atraso</option>
              <option value="DAMAGED_PRODUCT">Produto danificado</option>
              <option value="MISSING_ITEM">Artigo em falta</option>
              <option value="WRONG_ITEM">Artigo errado</option>
              <option value="OTHER">Outro</option>
            </select>
          </label>
          <label>
            Assunto
            <input name="subject" required />
          </label>
          <label>
            Descrição
            <textarea name="description" required rows={5} />
          </label>
          <button className="button button-primary">Abrir pedido</button>
        </form>
        <div>
          <h2>Os seus pedidos</h2>
          {items.map((item) => (
            <button
              className="account-list-row"
              key={item.id}
              onClick={() => void open(item)}
            >
              <strong>{item.number}</strong>
              <span>{item.subject}</span>
              <small>{item.status}</small>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <section className="customer-recent-orders">
          <h2>
            {selected.number} — {selected.subject}
          </h2>
          <p>{selected.description}</p>
          {selected.comments?.map((comment) => (
            <article key={comment.id}>
              <strong>
                {[comment.firstName, comment.lastName]
                  .filter(Boolean)
                  .join(' ') || 'Equipa Nsabores'}
              </strong>
              <p>{comment.body}</p>
              <small>
                {new Date(comment.createdAt).toLocaleString('pt-PT')}
              </small>
            </article>
          ))}
          <form onSubmit={reply}>
            <label>
              Responder
              <textarea name="body" required rows={4} />
            </label>
            <button className="button button-primary">Enviar resposta</button>
          </form>
        </section>
      )}
    </main>
  );
}
