import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ContactForm } from '@/components/contact-form';

export const metadata: Metadata = {
  title: 'Contactos',
  description:
    'Fale com a Nsabores sobre produtos, cabazes, eventos, empresas ou o Clube Nsabores.',
};

export default function ContactsPage() {
  return (
    <main id="conteudo">
      <header
        className="page-hero contact-hero"
        style={
          {
            '--page-hero-image':
              'url("/images/experience-celebration-clean.jpg")',
          } as CSSProperties
        }
      >
        <div className="page-hero-copy">
          <p className="eyebrow">Contactos</p>
          <h1>Comecemos pela ocasião que tem em mente.</h1>
          <p>
            Produtos, presentes, eventos ou soluções para empresas: explique o
            essencial e a equipa responde com uma proposta concreta.
          </p>
        </div>
      </header>
      <section className="contact-content">
        <ContactForm />
        <aside className="contact-guidance">
          <p className="eyebrow">Para respondermos melhor</p>
          <h2>O detalhe certo poupa uma troca de emails.</h2>
          <ul>
            <li>Para cabazes, indique ocasião, quantidade e orçamento.</li>
            <li>Para eventos, inclua data, local e número de pessoas.</li>
            <li>Para empresas, indique a organização e o objetivo.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
