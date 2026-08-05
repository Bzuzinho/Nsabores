import type { BlogPost, Paginated } from '@nsabores/types';
import { serverApiOrigin } from './api-origin';

async function contentFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${serverApiOrigin()}${path}`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`Content API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export const getBlogPosts = (query = new URLSearchParams()) =>
  contentFetch<Paginated<BlogPost>>(`/v1/blog?${query}`);

export const getBlogPost = (slug: string) =>
  contentFetch<BlogPost>(`/v1/blog/${encodeURIComponent(slug)}`);
