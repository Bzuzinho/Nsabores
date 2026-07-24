import type { Metadata } from 'next';
import Link from 'next/link';
import { ExperienceCard } from '@/components/experience-card';
import { Hero } from '@/components/hero';
import { NewsletterForm } from '@/components/newsletter-form';
import { ProductShowcase } from '@/components/product-showcase';
import { SectionHeading } from '@/components/section-heading';
import { ValueStrip } from '@/components/value-strip';
import {
  experiences,
  pillars,
  products as fallbackProducts,
} from '@/data/site';
import { getCategories, getProducts } from '@/lib/catalog';

export const metadata: Metadata = {
  title: {
    absolute: 'Nsabores — Sabores que ficam',
  },
  description:
    'Descubra produtos portugueses selecionados, cabazes, tábuas e experiências Nsabores.',
};

export default async function Home() {
  const [catalogResult, categories] = await Promise.all([
    getProducts(new URLSearchParams({ featured: 'true', limit: '8' }))
      .then((catalog) => ({ catalog, fallback: false }))
      .catch(() => ({
        catalog: {
          data: fallbackProducts,
          pagination: {
            page: 1,
            limit: 8,
            total: fallbackProducts.length,
            totalPages: 1,
          },
        },
        fallback: true,
      })),
    getCategories().catch(() => []),
  ]);
  return (
    <main id="conteudo">
      <Hero />
      <ValueStrip />

      <section className="section" aria-labelledby="experiencias-title">
        <SectionHeading
          eyebrow="Escolha pela ocasião"
          id="experiencias-title"
          title="As nossas melhores experiências"
        />
        <div className="experience-grid">
          {experiences.map((experience) => (
            <ExperienceCard key={experience.title} {...experience} />
          ))}
        </div>
      </section>

      <aside className="brand-band" aria-label="Compromissos Nsabores">
        <span>Produtos selecionados com paixão</span>
        <span>Tradição portuguesa, qualidade garantida</span>
        <span>Entrega em todo o país</span>
      </aside>

      <ProductShowcase
        products={catalogResult.catalog.data}
        categories={categories}
        fallback={catalogResult.fallback}
      />

      <section className="split-banner" aria-label="Clube, empresas e eventos">
        <article className="feature-panel feature-panel-club">
          <div>
            <p className="eyebrow">Clube Nsabores</p>
            <h2>Uma seleção exclusiva à sua porta.</h2>
            <p>
              Receba todos os meses produtos portugueses escolhidos para si.
            </p>
            <Link className="button button-primary" href="/clube">
              Saber mais
            </Link>
          </div>
        </article>
        <article className="feature-panel feature-panel-events">
          <div>
            <p className="eyebrow">Empresas e eventos</p>
            <h2>Soluções feitas à medida.</h2>
            <p>Cabazes empresariais, tábuas, catering e presentes especiais.</p>
            <Link className="button button-outline" href="/contactos">
              Contacte-nos
            </Link>
          </div>
        </article>
      </section>

      <section className="section why-section" aria-labelledby="why-title">
        <SectionHeading
          eyebrow="Porque escolher a Nsabores?"
          id="why-title"
          title="O atendimento de uma loja de confiança, com a conveniência do digital."
        />
        <div className="why-grid">
          {pillars.map((pillar, index) => (
            <article key={pillar.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <NewsletterForm />
    </main>
  );
}
