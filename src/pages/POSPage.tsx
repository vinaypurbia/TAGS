import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  X, CheckCircle, User, LogOut
} from 'lucide-react';
import { useAuth, authHeaders } from '../context/AuthContext';

interface Product {
  _id: string;
  name: string;
  price: string;
  discountedPrice?: string;
  category?: string;
  image?: string;
  imageUrl?: string;
  imageUrls?: string[];
  sku?: string;
}

interface CartItem extends Product {
  qty: number;
  unitPrice: number;
}

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
}

// Matches BusinessEmbed exactly
const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Lowercase to match your existing sales API (cash, upi, card, mixed)
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'mixed', label: 'Mixed' },
];

export default function POSPage() {
  const { user, token, logout, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Product[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState('');

  // Login guard — redirect to pos-login if not authenticated
  useEffect(() => {
    if (!token && !user) navigate('/pos-login', { replace: true });
  }, [token, user, navigate]);

  // Load products — matches BusinessEmbed: data.products || []
  useEffect(() => {
    fetch('/api/products?limit=500', { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.products || []);
        setProducts(list);
        setFiltered(list.slice(0, 20));
      })
      .catch(() => {});
    searchRef.current?.focus();
  }, [token]);

  // Filter products on search
  useEffect(() => {
    if (!search.trim()) { setFiltered(products.slice(0, 20)); return; }
    const q = search.toLowerCase();
    setFiltered(
      products.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      ).slice(0, 40)
    );
  }, [search, products]);

  // Customer search — matches BusinessEmbed customers fetch: data.customers || []
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) { setCustomers([]); return; }
    const timer = setTimeout(() => {
      fetch('/api/customers', { headers: authHeaders(token) })
        .then(r => r.json())
        .then(data => {
          const all: Customer[] = data.customers || [];
          const q = customerSearch.toLowerCase();
          setCustomers(all.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(customerSearch)).slice(0, 5));
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, token]);

  function addToCart(product: Product) {
    const unitPrice = parseFloat(product.discountedPrice || product.price || '0');
    setCart(prev => {
      const existing = prev.find(i => i._id === product._id);
      if (existing) return prev.map(i => i._id === product._id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1, unitPrice }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i._id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(i => i._id !== id));
  }

  function clearCart() {
    setCart([]); setDiscount(0);
    setSelectedCustomer(null); setCustomerSearch('');
    setNotes(''); setPaymentMode('cash');
  }

  async function createCustomer() {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) return;
    setSavingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ name: newCustomerName.trim(), phone: newCustomerPhone.trim() }),
      });
      const data = await res.json();
      if (data.success || data._id) {
        setSelectedCustomer({ _id: data._id?.toString() || '', name: newCustomerName.trim(), phone: newCustomerPhone.trim() });
        setShowNewCustomer(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        setCustomerSearch('');
      }
    } catch {}
    finally { setSavingCustomer(false); }
  }

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const discountAmt = Math.min(discount, subtotal);
  const total = subtotal - discountAmt;

  // Checkout — payload matches SalesModule handleSubmit exactly
  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const payload = {
        customerName: selectedCustomer?.name || 'Walk-in',
        customerPhone: selectedCustomer?.phone || '',
        customerAddress: '',
        paymentMode,
        notes,
        items: cart.map(i => ({
          productId: i._id,
          productName: i.name,
          price: i.unitPrice,
          quantity: i.qty,
        })),
        // POS-specific extras — your sales API ignores unknown fields safely
        discount: discountAmt,
        totalOverride: total,
        source: 'pos',
        associateId: user?.id,
        associateName: user?.name,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      setLastSaleNumber(data.saleNumber || '');
      setSuccess(true);
      setTimeout(() => { setSuccess(false); clearCart(); searchRef.current?.focus(); }, 3000);
    } catch (err: any) {
      alert(err.message || 'Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center text-white px-4">
        <CheckCircle className="w-20 h-20 text-[#FA5600] mb-6 animate-bounce" />
        <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Sale Complete!</h2>
        <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Total Charged</p>
        <p className="text-5xl font-black text-[#FA5600] mb-4">{fmt(total)}</p>
        <p className="text-white/40 text-xs uppercase tracking-widest">{PAYMENT_MODES.find(m => m.value === paymentMode)?.label} · {selectedCustomer?.name || 'Walk-in'}</p>
        {lastSaleNumber && <p className="text-white/30 text-xs mt-2">Sale #{lastSaleNumber}</p>}
        <p className="text-white/30 text-xs mt-6 animate-pulse">Resetting in 3 seconds...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Top bar */}
      <header className="bg-[#1A1A1A] text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-tighter uppercase">
            <span className="text-[#FA5600]">T</span>AGS
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 border-l border-white/10 pl-4">
            Point of Sale
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <User className="w-3.5 h-3.5" />
            <span className="font-bold">{user?.name}</span>
            <span className="bg-[#FA5600]/20 text-[#FA5600] text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
              {user?.role}
            </span>
          </div>
          {(isAdmin || isManager) && (
            <button onClick={() => navigate('/admin')} className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
              Admin →
            </button>
          )}
          <button
            onClick={() => { logout(); navigate('/pos-login'); }}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Out
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — product grid */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200">

          {/* Search */}
          <div className="bg-white px-4 py-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search products by name, category or SKU..."
                className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl pl-9 pr-10 py-2.5 text-sm font-bold outline-none transition"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-gray-400 text-sm font-bold py-16">No products found</div>
            )}
            {filtered.map(p => {
              const price = parseFloat(p.discountedPrice || p.price || '0');
              const inCart = cart.find(i => i._id === p._id);
              return (
                <button
                  key={p._id} onClick={() => addToCart(p)}
                  className={`bg-white rounded-xl border-2 p-3 text-left transition-all hover:shadow-md active:scale-95 ${inCart ? 'border-[#FA5600]' : 'border-gray-200 hover:border-[#FA5600]/50'}`}
                >
                  {(p.imageUrls?.[0] || p.imageUrl || p.image) ? (
                    <img src={p.imageUrls?.[0] || p.imageUrl || p.image} alt={p.name} className="w-full aspect-square object-cover rounded-lg mb-2 bg-gray-100" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-orange-50 flex items-center justify-center mb-2">
                      <ShoppingCart className="w-6 h-6 text-[#FA5600]/30" />
                    </div>
                  )}
                  <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mb-1">{p.name}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">{p.category || '—'}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-[#FA5600]">{fmt(price)}</p>
                    {inCart && (
                      <span className="bg-[#FA5600] text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center">{inCart.qty}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — cart + checkout */}
        <div className="w-[360px] shrink-0 flex flex-col bg-white overflow-hidden">

          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#FA5600]" />
              <span className="text-sm font-black uppercase tracking-widest text-gray-800">Cart</span>
              {cart.length > 0 && (
                <span className="bg-[#FA5600] text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-[10px] text-gray-400 hover:text-red-400 font-black uppercase tracking-widest transition-colors">Clear</button>
            )}
          </div>

          {/* Customer search — mirrors CustomerSearchInput in BusinessEmbed */}
          <div className="px-4 py-3 border-b border-gray-100 relative">
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                <div>
                  <p className="text-xs font-black text-gray-900">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-gray-400">{selectedCustomer.phone || 'Customer'}</p>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-gray-400 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              {showNewCustomer ? (
                <div className="space-y-2">
                  <input
                    type="text" value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    placeholder="Customer name *"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                  />
                  <input
                    type="tel" value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                    placeholder="Phone number *"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={createCustomer} disabled={savingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()}
                      className="flex-1 bg-[#FA5600] text-white text-xs font-black uppercase tracking-widest py-2 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-40"
                    >
                      {savingCustomer ? 'Saving...' : 'Save Customer'}
                    </button>
                    <button onClick={() => setShowNewCustomer(false)} className="px-3 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-200 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text" value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                    onFocus={() => setShowCustomerDrop(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
                    placeholder="Search customer (optional)"
                    className="w-full border-2 border-gray-200 rounded-xl pl-8 pr-20 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                  />
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest bg-[#FA5600] text-white px-2 py-1 rounded-lg hover:bg-[#E04A00] transition"
                  >
                    + New
                  </button>
                  {showCustomerDrop && customers.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 bg-white border-2 border-[#FA5600] rounded-xl mt-1 shadow-xl max-h-40 overflow-y-auto">
                      {customers.map(c => (
                        <button
                          key={c._id} type="button"
                          onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDrop(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="text-sm font-bold text-gray-800">{c.name}</p>
                          {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                <ShoppingCart className="w-12 h-12" />
                <p className="text-xs font-black uppercase tracking-widest">Cart is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {cart.map(item => (
                  <div key={item._id} className="px-4 py-3 flex items-center gap-3">
                    {(item.imageUrls?.[0] || item.imageUrl || item.image)
                      ? <img src={item.imageUrls?.[0] || item.imageUrl || item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-orange-50 shrink-0 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-[#FA5600]/30" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{fmt(item.unitPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => updateQty(item._id, -1)} className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:border-[#FA5600] hover:text-[#FA5600] transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item._id, 1)} className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:border-[#FA5600] hover:text-[#FA5600] transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-right shrink-0 min-w-[60px]">
                      <p className="text-xs font-black text-gray-900">{fmt(item.unitPrice * item.qty)}</p>
                      <button onClick={() => removeFromCart(item._id)} className="text-gray-300 hover:text-red-400 transition-colors mt-0.5">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + checkout */}
          <div className="border-t border-gray-100 px-4 py-4 space-y-3">

            {/* Discount — admin/manager only */}
            {(isAdmin || isManager) && cart.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 w-20 shrink-0">Discount ₹</label>
                <input
                  type="number" min={0} max={subtotal}
                  value={discount || ''} onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                />
              </div>
            )}

            {/* Payment mode */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 w-20 shrink-0">Payment</label>
              <div className="flex gap-1.5 flex-wrap">
                {PAYMENT_MODES.map(m => (
                  <button
                    key={m.value} onClick={() => setPaymentMode(m.value)}
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 transition-all ${paymentMode === m.value ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-[#FA5600]/50'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Order notes (optional)"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
            />

            {/* Summary */}
            <div className="bg-orange-50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-xs text-green-600 font-bold">
                  <span>Discount</span><span>- {fmt(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-[#1A1A1A] pt-1.5 border-t border-orange-200">
                <span>Total</span>
                <span className="text-[#FA5600]">{fmt(total)}</span>
              </div>
            </div>

            {/* Checkout */}
            <button
              onClick={handleCheckout} disabled={cart.length === 0 || checkoutLoading}
              className="w-full bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? 'Processing...' : `Charge ${fmt(total)}`}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
