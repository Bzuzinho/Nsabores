import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Serviços',
  description:
    'Tábuas, cabazes personalizados e soluções para eventos e empresas, preparadas pela Nsabores.',
};

const services = [
  {
    title: 'Tábuas por medida',
    description:
      'Seleções ajustadas ao número de pessoas, à ocasião e às preferências de quem vai partilhar a mesa.',
  },
  {
    title: 'Cabazes personalizados',
    description:
      'Presentes com produtos, mensagem, embalagem e entrega definidos consigo, sem fórmulas fechadas.',
  },
  {
    title: 'Eventos e empresas',
    description:
      'Soluções para reuniões, celebrações e ofertas institucionais com proposta, quantidades e preço claros.',
  },
] as const;

const audiences = [
  {
    title: 'Para particulares',
    description:
      'Jantares, aniversários, presentes e outras ocasiões em que quer servir ou oferecer algo especial.',
  },
  {
    title: 'Para empresas',
    description:
      'Cabazes, ofertas institucionais e momentos de equipa alinhados com orçamento, imagem e quantidade.',
  },
  {
    title: 'Para eventos',
    description:
      'Propostas adaptadas à data, local, número de pessoas e formato do evento.',
  },
] as const;

export default function ServicesPage() {
  return (
    <main id="conteudo" className="services-page">
      <header className="services-hero">
        <div className="services-hero-copy">
          <p className="eyebrow">Serviços</p>
          <h1>Tratamos da seleção. Você aproveita a ocasião.</h1>
          <p>
            Criamos tábuas, cabazes e soluções para eventos e empresas com uma
            proposta simples: perceber o que precisa, definir tudo com clareza
            e entregar como combinado.
          </p>
          <Link
            className="button button-primary"
            href="/contactos?assunto=proposta"
          >
            Pedir uma proposta
          </Link>
        </div>
      </header>

      <section className="services-intro" aria-labelledby="services-title">
        <header>
          <p className="eyebrow">O que fazemos</p>
          <h2 id="services-title">Três serviços. Sem misturas nem rodeios.</h2>
          <p>
            Pode escolher uma base existente ou pedir uma solução totalmente
            adaptada. Antes de avançar, sabe sempre o que está incluído, quanto
            custa e quando será entregue.
          </p>
        </header>

        <div className="services-grid">
          {services.map((service, index) => (
            <article className="services-card" key={service.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="services-audiences" aria-labelledby="audiences-title">
        <div>
          <p className="eyebrow">Para quem</p>
          <h2 id="audiences-title">A mesma exigência, contextos diferentes.</h2>
          <p>
            A solução muda consoante a ocasião. O processo não: perceber,
            propor, confirmar e entregar.
          </p>
        </div>

        <div className="services-audience-list">
          {audiences.map((audience) => (
            <article key={audience.title}>
              <h3>{audience.title}</h3>
              <p>{audience.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="services-process" aria-labelledby="process-title">
        <p className="eyebrow">Como funciona</p>
        <h2 id="process-title">Do pedido à entrega em quatro passos.</h2>
        <div className="services-steps">
          <article className="services-step">
            <strong>01 · Pedido</strong>
            <p>Indique ocasião, quantidade, preferências, local e orçamento.</p>
          </article>
          <article className="services-step">
            <strong>02 · Proposta</strong>
            <p>Recebe uma solução com composição, apresentação, prazo e preço.</p>
          </article>
          <article className="services-step">
            <strong>03 · Confirmação</strong>
            <p>Ajustamos o necessário e validamos todos os detalhes consigo.</p>
          </article>
          <article className="services-step">
            <strong>04 · Entrega</strong>
            <p>Preparamos e entregamos no local e horário combinados.</p>
          </article>
        </div>
      </section>

      <section className="services-cta">
        <div>
          <p className="eyebrow">Tem uma ocasião em mente?</p>
          <h2>Explique-nos o essencial. Respondemos com uma proposta concreta.</h2>
        </div>
        <Link
          className="button button-primary"
          href="/contactos?assunto=proposta"
        >
          Falar connosco
        </Link>
      </section>
    </main>
  );
}
