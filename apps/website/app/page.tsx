import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Hero } from '@/components/hero';
import { ProductShowcase } from '@/components/product-showcase';
import { SectionHeading } from '@/components/section-heading';
import { ValueStrip } from '@/components/value-strip';
import { OccasionIcon } from '@/components/occasion-icon';
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

const occasions = [
  ['couple', 'Jantar a dois'],
  ['friends', 'Receber amigos'],
  ['birthday', 'Aniversário'],
  ['gift', 'Oferecer'],
  ['barbecue', 'Churrasco'],
  ['wine', 'Vinho & Queijo'],
  ['christmas', 'Natal'],
  ['easter', 'Páscoa'],
] as const;

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

      <section className="occasion-section" aria-labelledby="occasions-title">
        <h2 id="occasions-title">Comprar por ocasião</h2>
        <div className="occasion-grid">
          {occasions.map(([icon, label]) => (
            <Link href="/loja" key={label}>
              <OccasionIcon name={icon} />
              <strong>{label}</strong>
            </Link>
          ))}
        </div>
      </section>

      <ProductShowcase
        products={catalogResult.catalog.data.slice(0, 4)}
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
      </section>

      <section className="section why-section" aria-labelledby="why-title">
        <SectionHeading
          id="why-title"
          eyebrow=""
          title="Porquê escolher a Nsabores?"
        />
        <div className="why-grid">
          {pillars.map((pillar) => (
            <article key={pillar.title}>
              <span aria-hidden="true">◇</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="instagram-section" aria-labelledby="instagram-title">
        <h2 id="instagram-title">Siga-nos no Instagram</h2>
        <div className="instagram-grid">
          {[...experiences, ...experiences.slice(0, 1)].map(
            (experience, index) => (
              <Link href="/contactos" key={`${experience.title}-${index}`}>
                <Image
                  src={experience.image}
                  alt={experience.alt}
                  width={480}
                  height={360}
                  loading="eager"
                />
              </Link>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
