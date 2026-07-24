'use client';

import { ApiClient } from '@nsabores/api-client';
import type { Cart } from '@nsabores/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Product } from '@/data/site';

const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
);

interface ShopContextValue {
  addToCart: (product: Product) => Promise<void>;
  cart: Cart | null;
  cartCount: number;
  cartItems: Cart['items'];
  cartOpen: boolean;
  closeCart: () => void;
  openCart: () => void;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  refreshCart: () => Promise<void>;
  toast: string;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');

  const refreshCart = useCallback(async () => {
    setCart(await api.get<Cart>('/v1/cart'));
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(refreshCart)
      .catch(() => undefined);
    const refresh = () => void refreshCart().catch(() => undefined);
    window.addEventListener('nsabores-cart-refresh', refresh);
    return () => window.removeEventListener('nsabores-cart-refresh', refresh);
  }, [refreshCart]);

  const mutate = useCallback(
    async (
      optimistic: (current: Cart) => Cart,
      request: () => Promise<Cart>,
    ) => {
      const previous = cart;
      if (previous) setCart(optimistic(previous));
      try {
        setCart(await request());
      } catch (reason) {
        setCart(previous);
        setToast(
          reason instanceof Error
            ? reason.message
            : 'Não foi possível atualizar.',
        );
        throw reason;
      }
    },
    [cart],
  );

  const addToCart = useCallback(
    async (product: Product) => {
      setToast(`${product.name} adicionado ao carrinho.`);
      await mutate(
        (current) => ({
          ...current,
          itemCount: current.itemCount + 1,
          subtotalCents: current.subtotalCents + product.priceCents,
        }),
        () =>
          api.post<Cart>('/v1/cart/items', {
            productId: product.id,
            quantity: 1,
          }),
      );
      window.setTimeout(() => setToast(''), 2600);
    },
    [mutate],
  );

  const removeFromCart = useCallback(
    async (itemId: string) => {
      await mutate(
        (current) => {
          const removed = current.items.find((item) => item.id === itemId);
          return {
            ...current,
            items: current.items.filter((item) => item.id !== itemId),
            itemCount: current.itemCount - (removed?.quantity ?? 0),
            subtotalCents: current.subtotalCents - (removed?.totalCents ?? 0),
          };
        },
        () => api.delete<Cart>(`/v1/cart/items/${itemId}`),
      );
    },
    [mutate],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      await mutate(
        (current) => {
          const items = current.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  quantity,
                  totalCents: item.unitPriceCents * quantity,
                }
              : item,
          );
          return {
            ...current,
            items,
            itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
            subtotalCents: items.reduce(
              (sum, item) => sum + item.totalCents,
              0,
            ),
          };
        },
        () => api.patch<Cart>(`/v1/cart/items/${itemId}`, { quantity }),
      );
    },
    [mutate],
  );

  const value = useMemo<ShopContextValue>(
    () => ({
      addToCart,
      cart,
      cartCount: cart?.itemCount ?? 0,
      cartItems: cart?.items ?? [],
      cartOpen,
      closeCart: () => setCartOpen(false),
      openCart: () => setCartOpen(true),
      removeFromCart,
      updateQuantity,
      refreshCart,
      toast,
    }),
    [
      addToCart,
      cart,
      cartOpen,
      refreshCart,
      removeFromCart,
      toast,
      updateQuantity,
    ],
  );

  return (
    <ShopContext.Provider value={value}>
      {children}
      <div
        className={`toast ${toast ? 'toast-visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within ShopProvider');
  return context;
}
