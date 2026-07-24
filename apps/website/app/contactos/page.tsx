import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contactos',
  description:
    'Fale com a Nsabores sobre produtos, cabazes, eventos ou o Clube Nsabores.',
};

export default function ContactsPage() {
  return (
    <main id="conteudo" className="contact-page">
      <section className="contact-intro">
        <p className="eyebrow">Contactos</p>
        <h1>Comecemos pela ocasião que tem em mente.</h1>
        <p>
          Conte-nos se procura uma seleção para casa, um presente ou uma solução
          para empresa e eventos. Os contactos definitivos serão publicados
          assim que estiverem confirmados.
        </p>
      </section>
      <section className="contact-grid" aria-label="Formas de contacto">
        <article>
          <span>01</span>
          <h2>Produtos e cabazes</h2>
          <p>Indique a ocasião, preferências e orçamento aproximado.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Empresas e eventos</h2>
          <p>Partilhe data, local e número estimado de pessoas.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Clube Nsabores</h2>
          <p>Registe o interesse quando os canais oficiais forem publicados.</p>
        </article>
      </section>
      <aside className="contact-placeholder">
        <p className="eyebrow">Informação por confirmar</p>
        <h2>Contacto, morada e horário serão adicionados aqui.</h2>
        <p>
          Não publicamos dados provisórios para garantir que encontra sempre
          informação correta.
        </p>
      </aside>
    </main>
  );
}
