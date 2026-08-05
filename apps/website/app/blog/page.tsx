import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { EditorialPage } from '@/components/editorial-page';
import { getBlogPosts } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Ideias, histórias e sugestões para levar os sabores portugueses à sua mesa.',
};

export default async function BlogPage() {
  const result = await getBlogPosts(new URLSearchParams({ limit: '24' })).catch(
    () => null,
  );
  const posts = result?.data ?? [];

  return (
    <EditorialPage
      eyebrow="Blog Nsabores"
      title="Histórias, produtos e ideias para saborear."
      introduction="Conteúdos práticos sobre produtos portugueses, combinações, ocasiões e tudo o que torna uma mesa memorável."
      image="/images/experience-dinner-clean.jpg"
      imageAlt="Mesa com uma seleção de produtos portugueses"
    >
      <div className="editorial-intro blog-heading">
        <p className="eyebrow">Caderno Nsabores</p>
        <h2>Inspiração para guardar e partilhar.</h2>
      </div>
      {posts.length ? (
        <div className="blog-grid">
          {posts.map((post) => (
            <article key={post.id} className="blog-card">
              <Link href={`/blog/${post.slug}`}>
                <Image
                  src={post.coverImageUrl}
                  alt={post.imageAlt}
                  width={720}
                  height={480}
                />
                <div>
                  <p className="eyebrow">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('pt-PT')
                      : 'Blog'}
                  </p>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <span>Ler artigo</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="catalog-state">
          Ainda não existem artigos publicados. Volte em breve.
        </div>
      )}
    </EditorialPage>
  );
}
