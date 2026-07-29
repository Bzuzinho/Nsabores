import type { Metadata } from 'next';
import { ClubPlans } from '@/components/club-plans';
import { EditorialPage } from '@/components/editorial-page';

export const metadata: Metadata = {
  title: 'Clube Nsabores',
  description:
    'Descubra o Clube Nsabores e os planos disponíveis para receber uma seleção portuguesa com regularidade.',
};

export default function ClubPage() {
  return (
    <EditorialPage
      eyebrow="Clube Nsabores"
      title="Uma seleção exclusiva à sua porta."
      introduction="Descubra produtores, regiões e sabores portugueses através de planos do Clube com periodicidade e benefícios definidos de forma transparente."
      image="/images/club-clean.jpg"
      imageAlt="Seleção de produtos portugueses do Clube Nsabores"
      cta={{ href: '/clube/planos', label: 'Ver planos do Clube' }}
    >
      <div className="editorial-intro">
        <p className="eyebrow">Como funciona</p>
        <h2>Escolha o plano. Nós tratamos da próxima descoberta.</h2>
        <p>
          Cada plano apresenta o preço, a periodicidade e os benefícios
          aplicáveis. A subscrição pode ser consultada na conta e, quando
          solicitado, o cancelamento fica agendado para o fim do período já
          contratado.
        </p>
      </div>
      <ClubPlans compact />
      <div className="editorial-grid editorial-grid-three">
        <article>
          <span>01</span>
          <h3>Curadoria portuguesa</h3>
          <p>
            Seleções pensadas em torno de produtores, territórios e momentos de
            consumo.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Plano transparente</h3>
          <p>
            Preço, periodicidade, trial e benefícios são confirmados antes da
            adesão.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Controlo na sua conta</h3>
          <p>
            Consulte períodos e cobranças e agende ou reverta o cancelamento
            quando permitido.
          </p>
        </article>
      </div>
    </EditorialPage>
  );
}
