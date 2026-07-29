import type { Metadata } from 'next';
import { ClubPlans } from '@/components/club-plans';

export const metadata: Metadata = {
  title: 'Planos do Clube Nsabores',
  description: 'Conheça os planos disponíveis do Clube Nsabores.',
};

export default function ClubPlansPage() {
  return (
    <main className="contact-page">
      <section className="contact-intro">
        <p className="eyebrow">Clube Nsabores</p>
        <h1>Escolha a forma como quer descobrir novos sabores.</h1>
        <p>
          Planos configurados no Clube, com preço e periodicidade sempre
          confirmados no servidor.
        </p>
      </section>
      <ClubPlans />
    </main>
  );
}
