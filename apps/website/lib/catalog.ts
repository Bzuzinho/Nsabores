import type { CatalogCategory, Paginated } from '@nsabores/types';
import type { Product } from '@/data/site';
import { serverApiOrigin } from './api-origin';

async function catalogFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${serverApiOrigin()}${path}`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`Catalog API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export const getCategories = () =>
  catalogFetch<CatalogCategory[]>('/v1/categories');
export const getProducts = (query: URLSearchParams) =>
  catalogFetch<Paginated<Product>>(`/v1/products?${query}`);
export const getProduct = (slug: string) =>
  catalogFetch<Product>(`/v1/products/${encodeURIComponent(slug)}`);
