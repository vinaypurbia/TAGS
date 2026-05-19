import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '../data/products';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  customer: CustomerDetails;
  setCustomer: (details: CustomerDetails) => void;
  showRegistration: boolean;
  setShowRegistration: (show: boolean) => void;
  pendingProduct: Product | null;
  setPendingProduct: (product: Product | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'playandgear_customer';
const CART_KEY = 'tags_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [showRegistration, setShowRegistration] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [customer, setCustomerState] = useState<CustomerDetails>({ name: '', phone: '' });

  // Load saved customer from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name && parsed.phone) setCustomerState(parsed);
      }
    } catch {}
  }, []);

  const setCustomer = (details: CustomerDetails) => {
    setCustomerState(details);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
    } catch {}
  };

  const addItem = (product: Product, quantity: number = 1) => {
    // Normalize: ensure product always has `id` set (API returns `_id`)
    const normalizedProduct: Product = {
      ...product,
      id: product.id || (product as any)._id,
    };

    setItems((currentItems) => {
      const existingItem = currentItems.find(item => item.product.id === normalizedProduct.id);
      if (existingItem) {
        return currentItems.map(item =>
          item.product.id === normalizedProduct.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...currentItems, { product: normalizedProduct, quantity }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((current) => current.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(productId); return; }
    setItems((current) =>
      current.map(item => item.product.id === productId ? { ...item, quantity } : item)
    );
  };

  // Persist cart to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const clearCart = () => {
    setItems([]);
    try { localStorage.removeItem(CART_KEY); } catch {}
  };
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart, totalItems,
      customer, setCustomer,
      showRegistration, setShowRegistration,
      pendingProduct, setPendingProduct,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
}
