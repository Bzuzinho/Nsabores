'use client';

import { FormEvent, useState } from 'react';
import { accountApi } from './auth-provider';

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccess('');
    setError('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await accountApi.post('/v1/contact', {
        ...data,
        privacyAccepted: data.privacyAccepted === 'on',
      });
      setSuccess(
        'Pedido enviado. A equipa Nsabores responderá através do email indicado.',
      );
      form.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível enviar o pedido.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="contact-form" onSubmit={(event) => void submit(event)}>
      <div className="contact-form-heading">
        <p className="eyebrow">Fale connosco</p>
        <h2>Conte-nos o que tem em mente.</h2>
        <p>
          Quanto mais contexto partilhar, mais concreta poderá ser a nossa
          resposta.
        </p>
      </div>
      <label>
        Nome
        <input required name="name" autoComplete="name" maxLength={120} />
      </label>
      <label>
        Email
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          maxLength={180}
        />
      </label>
      <label>
        Telefone
        <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
      </label>
      <label>
        Assunto
        <select required name="topic" defaultValue="">
          <option value="" disabled>
            Selecione uma opção
          </option>
          <option value="PRODUCTS">Produtos e cabazes</option>
          <option value="EVENTS">Eventos e catering</option>
          <option value="BUSINESS">Empresas e B2B</option>
          <option value="CLUB">Clube Nsabores</option>
          <option value="OTHER">Outro assunto</option>
        </select>
      </label>
      <label className="contact-form-message">
        Mensagem
        <textarea required name="message" rows={7} maxLength={5000} />
      </label>
      <label className="contact-form-consent">
        <input required type="checkbox" name="privacyAccepted" />
        <span>
          Aceito que os dados sejam usados para responder a este pedido, nos
          termos da política de privacidade.
        </span>
      </label>
      <label className="contact-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary" disabled={submitting}>
        {submitting ? 'A enviar…' : 'Enviar pedido'}
      </button>
    </form>
  );
}
