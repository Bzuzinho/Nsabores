const values = [
  ['◇', 'Seleção de qualidade', 'Produtos escolhidos com rigor'],
  ['♧', 'Atendimento personalizado', 'Aconselhamento próximo'],
  ['▣', 'Entrega cuidada', 'Rápida, segura e com carinho'],
  ['✦', 'Experiências únicas', 'Mais do que produtos'],
];

export function ValueStrip() {
  return (
    <section className="value-strip" aria-label="Vantagens">
      {values.map(([icon, title, description]) => (
        <article key={title}>
          <span aria-hidden="true">{icon}</span>
          <strong>{title}</strong>
          <small>{description}</small>
        </article>
      ))}
    </section>
  );
}
