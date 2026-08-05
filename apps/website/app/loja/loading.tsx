export default function Loading() {
  return (
    <main id="conteudo" aria-busy="true">
      <header className="store-hero store-hero-loading">
        <p className="eyebrow">Loja Nsabores</p>
        <h1>A preparar a nossa seleção.</h1>
      </header>
      <section className="section catalog-page">
        <div className="catalog-state">A carregar catálogo…</div>
      </section>
    </main>
  );
}
