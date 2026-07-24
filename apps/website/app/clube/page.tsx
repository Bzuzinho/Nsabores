import type { Metadata } from 'next';
import { EditorialPage } from '@/components/editorial-page';

export const metadata: Metadata = {
  title: 'Clube Nsabores',
  description:
    'Descubra o conceito do Clube Nsabores: uma seleção portuguesa exclusiva todos os meses.',
};

export default function ClubPage() {
  return (
    <EditorialPage
      eyebrow="Clube Nsabores"
      title="Uma seleção exclusiva à sua porta."
      introduction="Todos os meses, uma história diferente contada através de produtores, regiões e sabores portugueses escolhidos para si."
      image="/images/club-clean.jpg"
      imageAlt="Seleção mensal de produtos portugueses do Clube Nsabores"
      cta={{ href: '/contactos', label: 'Manifestar interesse' }}
    >
      <div className="editorial-intro">
        <p className="eyebrow">Como será</p>
        <h2>Descoberta, contexto e tempo para saborear.</h2>
        <p>
          O Clube está em preparação. A proposta prevê uma caixa temática, notas
          sobre os produtores, sugestões de harmonização e flexibilidade para
          pausar ou ajustar preferências.
        </p>
      </div>
      <div className="editorial-grid editorial-grid-three">
        <article>
          <span>01</span>
          <h3>Curadoria mensal</h3>
          <p>Uma seleção coerente, nunca um conjunto aleatório.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Histórias de origem</h3>
          <p>Conheça quem produz e o território por detrás de cada sabor.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Sem compromisso atual</h3>
          <p>Registe apenas o seu interesse enquanto finalizamos o serviço.</p>
        </article>
      </div>
    </EditorialPage>
  );
}
