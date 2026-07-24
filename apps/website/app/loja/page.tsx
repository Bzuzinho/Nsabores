import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { getCategories, getProducts } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Loja',
  description: 'Explore o catálogo de sabores portugueses Nsabores.',
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function StorePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const incoming = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['category', 'search', 'sort', 'order', 'page']) {
    const value = incoming[key];
    if (typeof value === 'string') query.set(key, value);
  }
  query.set('limit', '8');
  const [catalog, categories] = await Promise.all([
    getProducts(query).catch(() => null),
    getCategories().catch(() => []),
  ]);

  return (
    <main id="conteudo">
      <header className="store-hero">
        <p className="eyebrow">Loja Nsabores</p>
        <h1>Uma seleção pequena no tamanho. Grande no sabor.</h1>
      </header>
      <section className="section catalog-page">
        <form className="catalog-toolbar">
          <input
            aria-label="Pesquisar produtos"
            name="search"
            defaultValue={query.get('search') ?? ''}
            placeholder="Pesquisar por nome, descrição ou SKU"
          />
          <select
            aria-label="Categoria"
            name="category"
            defaultValue={query.get('category') ?? ''}
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenação"
            name="sort"
            defaultValue={query.get('sort') ?? 'createdAt'}
          >
            <option value="createdAt">Mais recentes</option>
            <option value="name">Nome</option>
            <option value="price">Preço</option>
          </select>
          <button className="button button-primary" type="submit">
            Aplicar
          </button>
        </form>
        {!catalog ? (
          <div className="catalog-state" role="alert">
            Não foi possível carregar o catálogo. Tente novamente dentro de
            instantes.
          </div>
        ) : catalog.data.length === 0 ? (
          <div className="catalog-state">
            Não encontrámos produtos para estes filtros.
          </div>
        ) : (
          <>
            <div className="product-grid">
              {catalog.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <nav className="pagination" aria-label="Paginação">
              {catalog.pagination.page > 1 && (
                <Link href={`?${withPage(query, catalog.pagination.page - 1)}`}>
                  Anterior
                </Link>
              )}
              <span>
                Página {catalog.pagination.page} de{' '}
                {catalog.pagination.totalPages}
              </span>
              {catalog.pagination.page < catalog.pagination.totalPages && (
                <Link href={`?${withPage(query, catalog.pagination.page + 1)}`}>
                  Seguinte
                </Link>
              )}
            </nav>
          </>
        )}
      </section>
    </main>
  );
}

function withPage(query: URLSearchParams, page: number) {
  const next = new URLSearchParams(query);
  next.set('page', String(page));
  return next.toString();
}
