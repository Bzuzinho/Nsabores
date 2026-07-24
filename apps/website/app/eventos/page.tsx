import type { Metadata } from 'next';
import { EditorialPage } from '@/components/editorial-page';

export const metadata: Metadata = {
  title: 'Eventos',
  description:
    'Soluções gastronómicas Nsabores para celebrações, equipas e presentes empresariais.',
};

export default function EventsPage() {
  return (
    <EditorialPage
      eyebrow="Empresas e eventos"
      title="Soluções feitas à medida."
      introduction="Cabazes empresariais, tábuas, catering e presentes especiais pensados para a dimensão, contexto e identidade de cada evento."
      image="/images/events-clean.jpg"
      imageAlt="Apresentação Nsabores preparada para empresas e eventos"
      cta={{ href: '/contactos', label: 'Contar-nos o seu evento' }}
    >
      <div className="editorial-intro">
        <p className="eyebrow">Do primeiro contacto à entrega</p>
        <h2>Uma proposta clara, acompanhada por pessoas.</h2>
        <p>
          Começamos por perceber a ocasião, número de convidados, preferências e
          orçamento. Depois apresentamos uma seleção e combinamos todos os
          detalhes de apresentação e entrega.
        </p>
      </div>
      <div className="process-list">
        <p>
          <strong>01 · Conversa</strong>
          <span>Contexto, necessidades e preferências.</span>
        </p>
        <p>
          <strong>02 · Proposta</strong>
          <span>Seleção, quantidades e apresentação.</span>
        </p>
        <p>
          <strong>03 · Preparação</strong>
          <span>Montagem cuidada e confirmação final.</span>
        </p>
        <p>
          <strong>04 · Entrega</strong>
          <span>Coordenação no local e hora combinados.</span>
        </p>
      </div>
    </EditorialPage>
  );
}
