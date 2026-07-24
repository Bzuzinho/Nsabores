import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { NewsletterForm } from './newsletter-form';

interface EditorialPageProps {
  eyebrow: string;
  title: string;
  introduction: string;
  image: string;
  imageAlt: string;
  children: ReactNode;
  cta?: {
    href: string;
    label: string;
  };
}

export function EditorialPage({
  children,
  cta,
  eyebrow,
  image,
  imageAlt,
  introduction,
  title,
}: EditorialPageProps) {
  return (
    <main id="conteudo">
      <header
        className="page-hero"
        style={
          {
            '--page-hero-image': `url("${image}")`,
          } as CSSProperties
        }
      >
        <div className="page-hero-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{introduction}</p>
          {cta && (
            <Link className="button button-primary" href={cta.href}>
              {cta.label}
            </Link>
          )}
        </div>
        <span className="sr-only">{imageAlt}</span>
      </header>
      <section className="editorial-content">{children}</section>
      <NewsletterForm />
    </main>
  );
}
