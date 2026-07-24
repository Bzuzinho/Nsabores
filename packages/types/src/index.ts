export type ServiceName = 'website' | 'management' | 'api';

export interface HealthResponse {
  service: ServiceName;
  status: 'ok';
  timestamp: string;
}

export const stockStatuses = [
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'PREORDER',
] as const;
export type StockStatus = (typeof stockStatuses)[number];

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string | null;
  sku: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  imageUrl: string;
  gallery: string[];
  isActive: boolean;
  isFeatured: boolean;
  stockStatus: StockStatus;
  category: Pick<CatalogCategory, 'id' | 'name' | 'slug'>;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
