import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '../data/products';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  customerId?: string;
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
  customerToken: string | null;
  setCustomerToken: (token: string | null) => void;
  logout: () => void;
  showSignIn: boolean;
  setShowSignIn: (show: boolean) => void;
  redirectAfterAuth: string | null;
  setRedirectAfterAuth: (path: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'tags_customer';
const CART_KEY = 'tags_cart';
const TOKEN_KEY = 'tags_customer_token';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { const saved = localStorage.getItem(CART_KEY); if (saved) return JSON.parse(saved); } catch {}
    return [];
  });
  const [showSignIn, setShowSignIn] = useState(false);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | null>(null);
  const [customer, setCustomerState] = useState<CustomerDetails>({ name: '', phone: '' });
  const [customerToken, setCustomerTokenState] = useState<string | null>(null);

  // Load saved customer + token on mount, verify token with backend
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedCustomer = localStorage.getItem(STORAGE_KEY);
    if (savedToken && savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer);
        if (parsed.name && parsed.phone) {
          setCustomerState(parsed);
          setCustomerTokenState(savedToken);
          // Verify token is still valid
          fetch('/api/customers?module=auth&action=verify', {
            headers: { Authorization: `Bearer ${savedToken}` }
          }).then(r => r.json()).then(data => {
            if (!data.valid) { clearSession(); } else if (data.customer) { setCustomer(data.customer); }
          }).catch(() => {});
        }
      } catch { clearSession(); }
    }
  }, []);

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setCustomerTokenState(null);
    setCustomerState({ name: '', phone: '' });
  }

  const setCustomer = (details: CustomerDetails) => {
    setCustomerState(details);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(details)); } catch {}
  };

  const setCustomerToken = (token: string | null) => {
    setCustomerTokenState(token);
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  };

  const logout = () => { clearSession(); };

  const addItem = (product: Product, quantity: number = 1) => {
    const normalizedProduct: Product = { ...product, id: product.id || (product as any)._id };
    setItems((currentItems) => {
      const existingItem = currentItems.find(item => item.product.id === normalizedProduct.id);
      if (existingItem) {
        return currentItems.map(item =>
          item.product.id === normalizedProduct.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...currentItems, { product: normalizedProduct, quantity }];
    });
  };

  const removeItem = (productId: string) => setItems((current) => current.filter(item => item.product.id !== productId));

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(productId); return; }
    setItems((current) => current.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const clearCart = () => { setItems([]); try { localStorage.removeItem(CART_KEY); } catch {} };
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart, totalItems,
      customer, setCustomer, customerToken, setCustomerToken, logout,
      showSignIn, setShowSignIn, redirectAfterAuth, setRedirectAfterAuth,
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
