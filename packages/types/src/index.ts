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

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  customerProfile?: {
    taxNumber: string | null;
    marketingConsent: boolean;
    notes?: string | null;
  } | null;
}

export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  company: string | null;
  taxNumber: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface AuthSessionView {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';
export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type ManualPaymentPreference =
  'OPERATOR_CONTACT' | 'PAY_ON_DELIVERY' | 'PAY_ON_PICKUP' | 'CARRIER_COD';

export interface ManualOrderTerms {
  flow?: 'MANUAL' | 'AUTOMATIC';
  preference?: ManualPaymentPreference;
  shippingQuoteStatus?: 'PENDING' | 'CONFIRMED' | 'NOT_REQUIRED';
  shippingQuoteCents?: number | null;
  shippingQuoteNote?: string | null;
  shippingQuoteConfirmedBy?: string;
  shippingQuoteConfirmedAt?: string;
}

export interface AppliedDiscount {
  promotionId?: string | null;
  couponId?: string | null;
  source: string;
  code?: string | null;
  label: string;
  amountCents: number;
  freeShipping?: boolean;
  snapshot?: Record<string, unknown>;
}

export interface Cart {
  id: string;
  status: 'ACTIVE' | 'CONVERTED' | 'ABANDONED';
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    product: Pick<
      CatalogProduct,
      'id' | 'name' | 'slug' | 'sku' | 'imageUrl' | 'stockStatus'
    >;
  }>;
  itemCount: number;
  subtotalCents: number;
  productDiscountCents?: number;
  shippingDiscountCents?: number;
  discountCents?: number;
  shippingCents?: number;
  totalCents?: number;
  discounts?: AppliedDiscount[];
  coupon?: { id: string; code: string } | null;
  context?: {
    channel: 'B2C' | 'B2B';
    businessAccountId: string | null;
    priceListId: string | null;
    paymentTerms: string | null;
    requiresApproval: boolean;
  };
}

export interface DeliveryMethod {
  id: string;
  code: string;
  name: string;
  type: 'STANDARD' | 'LOCAL_PICKUP';
  isActive: boolean;
  priceCents: number;
  freeShippingAboveCents: number | null;
}

export interface CommerceOrder {
  id: string;
  number: string;
  email: string;
  customerName: string;
  phone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  billingAddress: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  customerNotes: string | null;
  internalNotes?: string | null;
  paymentTermsSnapshot?: ManualOrderTerms | null;
  createdAt: string;
  deliveryMethod: DeliveryMethod;
  discounts?: AppliedDiscount[];
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    sku: string;
    unitPriceCents: number;
    quantity: number;
    totalCents: number;
    imageUrl: string | null;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    method: string;
    status: PaymentStatus;
    amountCents: number;
    currency: string;
    createdAt: string;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    createdAt: string;
  }>;
}
