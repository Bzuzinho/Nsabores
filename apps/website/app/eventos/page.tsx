import type { Metadata } from 'next';
import { EditorialPage } from '@/components/editorial-page';

export const metadata: Metadata = {
  title: 'Experiências e serviços',
  description:
    'Tábuas, cabazes, catering e soluções gastronómicas Nsabores para particulares, empresas e eventos.',
};

const solutions = [
  [
    'Tábuas por medida',
    'Combinações ajustadas ao número de pessoas, ao momento e às preferências dos convidados.',
  ],
  [
    'Cabazes personalizados',
    'Presentes com seleção de produtos, mensagem, embalagem e entrega preparadas consigo.',
  ],
  [
    'Eventos e catering',
    'Propostas gastronómicas para celebrações, equipas, reuniões e momentos especiais.',
  ],
  [
    'Soluções para empresas',
    'Ofertas institucionais e experiências alinhadas com a dimensão, orçamento e identidade da empresa.',
  ],
] as const;

export default function ExperiencesAndServicesPage() {
  return (
    <EditorialPage
      eyebrow="Experiências e serviços"
      title="Uma solução clara para cada ocasião."
      introduction="Reunimos numa única área as tábuas, cabazes personalizados, catering, eventos e ofertas empresariais. Diga-nos o contexto; tratamos da seleção, apresentação e entrega."
      image="/images/events-clean.jpg"
      imageAlt="Apresentação Nsabores preparada para uma experiência gastronómica"
      cta={{ href: '/contactos?assunto=proposta', label: 'Pedir uma proposta' }}
    >
      <div className="editorial-intro">
        <p className="eyebrow">O que fazemos</p>
        <h2>Sem páginas repetidas nem pacotes confusos.</h2>
        <p>
          Pode partir de uma solução existente ou pedir uma proposta feita à
          medida. Em ambos os casos, indicamos claramente o que está incluído,
          os prazos, as quantidades e o preço antes de avançar.
        </p>
      </div>

      <div className="editorial-grid editorial-grid-two">
        {solutions.map(([title, description], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>

      <div className="process-list">
        <p>
          <strong>01 · Contexto</strong>
          <span>Ocasião, pessoas, preferências, local e orçamento.</span>
        </p>
        <p>
          <strong>02 · Proposta</strong>
          <span>Seleção, quantidades, apresentação, entrega e preço.</span>
        </p>
        <p>
          <strong>03 · Confirmação</strong>
          <span>Ajustes finais e validação do que será preparado.</span>
        </p>
        <p>
          <strong>04 · Preparação e entrega</strong>
          <span>Execução cuidada no local e horário combinados.</span>
        </p>
      </div>
    </EditorialPage>
  );
}
