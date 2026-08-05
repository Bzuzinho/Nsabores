import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditorialPage } from '@/components/editorial-page';
import { getBlogPost } from '@/lib/content';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug).catch(() => null);
  if (!post) return { title: 'Artigo não encontrado' } satisfies Metadata;
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { images: [{ url: post.coverImageUrl, alt: post.imageAlt }] },
  } satisfies Metadata;
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug).catch(() => null);
  if (!post) notFound();
  return (
    <EditorialPage
      eyebrow="Blog Nsabores"
      title={post.title}
      introduction={post.excerpt}
      image={post.coverImageUrl}
      imageAlt={post.imageAlt}
    >
      <article className="blog-article">
        <p className="blog-byline">
          {post.publishedAt &&
            new Date(post.publishedAt).toLocaleDateString('pt-PT', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          {post.author && ` · ${post.author.firstName} ${post.author.lastName}`}
        </p>
        {post.content.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </article>
    </EditorialPage>
  );
}
