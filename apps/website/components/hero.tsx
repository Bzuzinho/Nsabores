import Link from 'next/link';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-content">
        <p className="eyebrow">Sabores que ficam. Momentos que contam.</p>
        <h1 id="hero-title">
          Mais do que produtos.
          <br />
          Criamos experiências.
        </h1>
        <p className="hero-description">
          Selecionamos queijos, enchidos e iguarias portuguesas com critério,
          paixão e atendimento próximo.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/loja">
            Descobrir a loja
          </Link>
          <Link className="button button-outline" href="/servicos">
            Conhecer experiências
          </Link>
        </div>
      </div>
    </section>
  );
}
