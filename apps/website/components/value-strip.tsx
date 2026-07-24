const values = [
  ['selection', 'Produtos selecionados', 'Com origem e qualidade garantida'],
  [
    'service',
    'Atendimento personalizado',
    'Com o toque humano que nos distingue',
  ],
  ['delivery', 'Entrega rápida e segura', 'Em todo o país'],
];

export function ValueStrip() {
  return (
    <section className="value-strip" aria-label="Vantagens">
      {values.map(([icon, title, description]) => (
        <article key={title}>
          <span
            className={`value-icon value-icon-${icon}`}
            aria-hidden="true"
          />
          <strong>{title}</strong>
          <small>{description}</small>
        </article>
      ))}
    </section>
  );
}
