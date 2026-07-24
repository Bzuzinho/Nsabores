import type { Metadata } from 'next';
import { EditorialPage } from '@/components/editorial-page';
import { pillars } from '@/data/site';

export const metadata: Metadata = {
  title: 'Quem somos',
  description:
    'Conheça a curadoria, a proximidade e o compromisso da Nsabores com os sabores portugueses.',
};

export default function AboutPage() {
  return (
    <EditorialPage
      eyebrow="Quem somos"
      title="Escolhemos sabores que merecem ser partilhados."
      introduction="A Nsabores nasce da vontade de aproximar bons produtores, produtos com história e pessoas que valorizam cada momento à mesa."
      image="/images/hero.jpg"
      imageAlt="Seleção de queijos e enchidos portugueses"
      cta={{ href: '/loja', label: 'Conhecer a seleção' }}
    >
      <div className="editorial-intro">
        <p className="eyebrow">A nossa forma de fazer</p>
        <h2>Critério na escolha. Cuidado em cada detalhe.</h2>
        <p>
          Procuramos produtos autênticos, respeitamos a sua origem e ajudamos
          cada cliente a encontrar uma combinação ajustada ao momento. A
          tecnologia simplifica a descoberta, sem substituir a conversa e o
          aconselhamento.
        </p>
      </div>
      <div className="editorial-grid">
        {pillars.map((pillar, index) => (
          <article key={pillar.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{pillar.title}</h3>
            <p>{pillar.description}</p>
          </article>
        ))}
      </div>
    </EditorialPage>
  );
}
