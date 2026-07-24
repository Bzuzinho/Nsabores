export type ProductCategory = 'tabuas' | 'queijos' | 'cabazes' | 'vinhos';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  categoryLabel: string;
  price: number;
  image: string;
  description: string;
}

export const products: Product[] = [
  {
    id: 1,
    name: 'Tábua Premium',
    category: 'tabuas',
    categoryLabel: 'Tábuas',
    price: 34.9,
    image: '/images/prod1.jpg',
    description: 'Seleção de queijos, enchidos, compota e frutos secos.',
  },
  {
    id: 2,
    name: 'Queijo Serra da Estrela',
    category: 'queijos',
    categoryLabel: 'Queijos',
    price: 12.5,
    image: '/images/prod2.jpg',
    description: 'Queijo de pasta amanteigada, intenso e tradicional.',
  },
  {
    id: 3,
    name: 'Chouriço Regional',
    category: 'queijos',
    categoryLabel: 'Enchidos',
    price: 6.9,
    image: '/images/prod3.jpg',
    description: 'Enchido português selecionado, ideal para petiscar.',
  },
  {
    id: 4,
    name: 'Cabaz Gourmet',
    category: 'cabazes',
    categoryLabel: 'Cabazes',
    price: 49.9,
    image: '/images/product-hamper-clean.jpg',
    description: 'Uma oferta completa, elegante e personalizável.',
  },
  {
    id: 5,
    name: 'Vinho Tinto Reserva',
    category: 'vinhos',
    categoryLabel: 'Vinhos',
    price: 14.9,
    image: '/images/product-wine-clean.jpg',
    description: 'Um tinto estruturado para acompanhar sabores intensos.',
  },
];

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

export const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
