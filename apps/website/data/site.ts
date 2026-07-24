import type { CatalogProduct } from '@nsabores/types';

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: { id: string; name: string; slug: string };
  priceCents: number;
  imageUrl: string;
  shortDescription: string;
  description: string | null;
  gallery: string[];
  sku: string;
  compareAtPriceCents: number | null;
  isActive: boolean;
  isFeatured: boolean;
  stockStatus: CatalogProduct['stockStatus'];
  createdAt: string;
  updatedAt: string;
}

export const products: Product[] = [
  {
    id: 'fallback-1',
    slug: 'tabua-premium',
    name: 'Tábua Premium',
    category: { id: 'tabuas', slug: 'tabuas', name: 'Tábuas' },
    priceCents: 3490,
    imageUrl: '/images/prod1.jpg',
    shortDescription: 'Seleção de queijos, enchidos, compota e frutos secos.',
  },
  {
    id: 'fallback-2',
    slug: 'queijo-serra-da-estrela',
    name: 'Queijo Serra da Estrela',
    category: { id: 'queijos', slug: 'queijos', name: 'Queijos' },
    priceCents: 1250,
    imageUrl: '/images/prod2.jpg',
    shortDescription: 'Queijo de pasta amanteigada, intenso e tradicional.',
  },
  {
    id: 'fallback-3',
    slug: 'chourico-regional',
    name: 'Chouriço Regional',
    category: { id: 'enchidos', slug: 'enchidos', name: 'Enchidos' },
    priceCents: 690,
    imageUrl: '/images/prod3.jpg',
    shortDescription: 'Enchido português selecionado, ideal para petiscar.',
  },
  {
    id: 'fallback-4',
    slug: 'cabaz-gourmet',
    name: 'Cabaz Gourmet',
    category: { id: 'cabazes', slug: 'cabazes', name: 'Cabazes' },
    priceCents: 4990,
    imageUrl: '/images/product-hamper-clean.jpg',
    shortDescription: 'Uma oferta completa, elegante e personalizável.',
  },
  {
    id: 'fallback-5',
    slug: 'vinho-tinto-reserva',
    name: 'Vinho Tinto Reserva',
    category: { id: 'vinhos', slug: 'vinhos', name: 'Vinhos' },
    priceCents: 1490,
    imageUrl: '/images/product-wine-clean.jpg',
    shortDescription: 'Um tinto estruturado para acompanhar sabores intensos.',
  },
] as Product[];

for (const product of products) {
  Object.assign(product, {
    description: null,
    gallery: [],
    sku: product.id.toUpperCase(),
    compareAtPriceCents: null,
    isActive: true,
    isFeatured: true,
    stockStatus: 'IN_STOCK',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });
}

export const experiences = [
  {
    title: 'Jantar a dois',
    description: 'A combinação perfeita para um momento especial.',
    image: '/images/experience-dinner-clean.jpg',
    alt: 'Tábua portuguesa preparada para um jantar a dois',
  },
  {
    title: 'Receber amigos',
    description: 'Tudo o que precisa para uma noite memorável.',
    image: '/images/experience-friends-clean.jpg',
    alt: 'Petiscos portugueses para receber amigos',
  },
  {
    title: 'Cabaz para oferecer',
    description: 'Presentes personalizados que deixam boas memórias.',
    image: '/images/experience-hamper-clean.jpg',
    alt: 'Cabaz gourmet com queijos e produtos portugueses',
  },
  {
    title: 'Festa especial',
    description: 'Sabor e tradição para os grandes momentos.',
    image: '/images/experience-celebration-clean.jpg',
    alt: 'Mesa com enchidos e petiscos para uma festa especial',
  },
];

export const pillars = [
  {
    title: 'Curadoria',
    description:
      'Não vendemos tudo. Escolhemos o que merece chegar à sua mesa.',
  },
  {
    title: 'Personalização',
    description: 'Adaptamos produtos, quantidades e apresentação à ocasião.',
  },
  {
    title: 'Proximidade',
    description: 'A tecnologia facilita a compra, sem retirar o lado humano.',
  },
  {
    title: 'Tradição',
    description: 'Valorizamos produtores e sabores genuinamente portugueses.',
  },
];

export const formatPrice = (priceCents: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceCents / 100);
