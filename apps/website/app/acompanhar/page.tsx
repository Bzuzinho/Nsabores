import type { Metadata } from 'next';
import { PublicTracking } from '@/components/public-tracking';

export const metadata: Metadata = {
  title: 'Acompanhar encomenda',
  description: 'Consulte o estado e o tracking da sua encomenda Nsabores.',
};

export default function TrackingPage() {
  return (
    <main id="conteudo" className="contact-page">
      <section className="contact-intro">
        <p className="eyebrow">Encomendas</p>
        <h1>Acompanhe a sua encomenda.</h1>
        <p>Consulte o estado da encomenda e das expedições associadas usando o número da encomenda e o email da compra.</p>
      </section>
      <PublicTracking />
    </main>
  );
}
