'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Product } from '@/data/site';

interface CartItem extends Product {
  quantity: number;
}

interface ShopContextValue {
  addToCart: (product: Product) => void;
  cartCount: number;
  cartItems: CartItem[];
  cartOpen: boolean;
  closeCart: () => void;
  openCart: () => void;
  removeFromCart: (productId: string) => void;
  toast: string;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');

  const addToCart = useCallback((product: Product) => {
    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setToast(`${product.name} adicionado ao carrinho.`);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCartItems((current) => current.filter((item) => item.id !== productId));
  }, []);

  const value = useMemo(
    () => ({
      addToCart,
      cartCount: cartItems.reduce((total, item) => total + item.quantity, 0),
      cartItems,
      cartOpen,
      closeCart: () => setCartOpen(false),
      openCart: () => setCartOpen(true),
      removeFromCart,
      toast,
    }),
    [addToCart, cartItems, cartOpen, removeFromCart, toast],
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
  if (!context) {
    throw new Error('useShop must be used within ShopProvider');
  }
  return context;
}
