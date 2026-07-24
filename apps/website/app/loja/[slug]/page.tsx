import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { ProductDetail } from '@/components/product-detail';
import { getProduct, getProducts } from '@/lib/catalog';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  if (!product) notFound();
  const related = await getProducts(
    new URLSearchParams({ category: product.category.slug, limit: '4' }),
  ).catch(() => null);
  return (
    <main id="conteudo" className="section">
      <ProductDetail product={product} />
      {related &&
        related.data.filter((item) => item.id !== product.id).length > 0 && (
          <section aria-labelledby="related-title">
            <h2 id="related-title">Outros sabores da mesma categoria</h2>
            <div className="product-grid">
              {related.data
                .filter((item) => item.id !== product.id)
                .map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
            </div>
          </section>
        )}
    </main>
  );
}
