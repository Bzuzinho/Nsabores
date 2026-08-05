import type { MetadataRoute } from 'next';

const routes = [
  '',
  '/sobre',
  '/loja',
  '/servicos',
  '/clube',
  '/eventos',
  '/blog',
  '/contactos',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nsabores.pt';

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date('2026-08-05'),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
