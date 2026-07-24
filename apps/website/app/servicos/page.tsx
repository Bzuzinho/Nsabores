import type { Metadata } from 'next';
import { EditorialPage } from '@/components/editorial-page';

export const metadata: Metadata = {
  title: 'Serviços',
  description:
    'Tábuas, cabazes, catering e soluções Nsabores pensadas para cada ocasião.',
};

const services = [
  [
    'Tábuas por medida',
    'Combinações ajustadas ao número de pessoas e ocasião.',
  ],
  [
    'Cabazes personalizados',
    'Presentes com seleção, mensagem e apresentação cuidada.',
  ],
  [
    'Catering de proximidade',
    'Uma proposta simples e elegante para reunir pessoas.',
  ],
];

export default function ServicesPage() {
  return (
    <EditorialPage
      eyebrow="Serviços"
      title="Cada ocasião pede uma seleção diferente."
      introduction="Da mesa mais íntima a um encontro de equipa, criamos propostas com produtos portugueses, apresentação cuidada e acompanhamento próximo."
      image="/images/exp2.jpg"
      imageAlt="Mesa com petiscos portugueses preparada para convívio"
      cta={{ href: '/contactos', label: 'Pedir uma proposta' }}
    >
      <div className="editorial-intro">
        <p className="eyebrow">Feito consigo</p>
        <h2>Experiências que se adaptam, não pacotes fechados.</h2>
      </div>
      <div className="editorial-grid editorial-grid-three">
        {services.map(([title, description], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </EditorialPage>
  );
}
