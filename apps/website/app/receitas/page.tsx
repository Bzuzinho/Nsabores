import type { Metadata } from 'next';
import Image from 'next/image';
import { EditorialPage } from '@/components/editorial-page';

export const metadata: Metadata = {
  title: 'Receitas',
  description:
    'Ideias, harmonizações e sugestões para levar sabores portugueses à sua mesa.',
};

const recipes = [
  [
    'Como montar uma tábua',
    '/images/experience-dinner-clean.jpg',
    'Equilíbrio entre texturas, intensidades e acompanhamentos.',
  ],
  [
    'Queijo à mesa',
    '/images/prod2.jpg',
    'Temperatura, corte e combinações para aproveitar cada queijo.',
  ],
  [
    'Receber sem complicar',
    '/images/experience-celebration-clean.jpg',
    'Uma mesa generosa com preparação simples e tempo para conversar.',
  ],
] as const;

export default function RecipesPage() {
  return (
    <EditorialPage
      eyebrow="Receitas e inspiração"
      title="Boas ideias começam com bons ingredientes."
      introduction="Sugestões práticas, histórias de produto e combinações para aproveitar melhor cada seleção Nsabores."
      image="/images/prod1.jpg"
      imageAlt="Tábua de produtos portugueses pronta a servir"
    >
      <div className="editorial-intro">
        <p className="eyebrow">Caderno Nsabores</p>
        <h2>Inspiração para guardar e partilhar.</h2>
      </div>
      <div className="recipe-grid">
        {recipes.map(([title, image, description]) => (
          <article key={title}>
            <Image src={image} alt="" width={640} height={420} />
            <div>
              <p className="eyebrow">Guia</p>
              <h3>{title}</h3>
              <p>{description}</p>
              <span>Conteúdo completo brevemente</span>
            </div>
          </article>
        ))}
      </div>
    </EditorialPage>
  );
}
