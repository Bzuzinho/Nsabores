import Link from 'next/link';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-content">
        <p className="eyebrow">Mercearia gourmet portuguesa</p>
        <h1 id="hero-title">
          Sabores que
          <br />
          contam histórias.
        </h1>
        <p className="hero-script">Experiências que ficam.</p>
        <p className="hero-description">
          Selecionamos os melhores produtos tradicionais portugueses e criamos
          experiências únicas para momentos inesquecíveis.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/loja">
            Comprar agora
          </Link>
          <Link className="button button-outline" href="/servicos">
            Saber mais
          </Link>
        </div>
      </div>
    </section>
  );
}
