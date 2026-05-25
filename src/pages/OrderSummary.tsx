import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { generateOrderPDF, getWhatsAppLink } from '../lib/pdfGenerator';
import { Trash2, Plus, Minus, MessageCircle, AlertCircle, ShoppingBag, User, Phone, Mail, MapPin, Edit2, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const resolvePrice = (product: any): number => {
  const candidates = [product.discountedPrice, product.price, product.originalPrice];
  for (const v of candidates) {
    if (v !== undefined && v !== null) {
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return 0;
};

export function OrderSummary() {
  const { items, updateQuantity, removeItem, clearCart, customer, setShowSignIn, setRedirectAfterAuth } = useCart();
  const navigate = useNavigate();

  const [isSending, setIsSending] = useState(false);
  const [orderDone, setOrderDone] = useState<{ orderId: string; name: string } | null>(null);
  // Delivery address for THIS order — starts from saved profile, can be overridden without saving to account
  const [deliveryAddress, setDeliveryAddress] = useState(customer.address || '');
  const [editingAddress, setEditingAddress] = useState(!customer.address);

  const isSignedIn = !!(customer.customerId);
  const subtotal = items.reduce((sum, item) => sum + (resolvePrice(item.product) * item.quantity), 0);

  const handleSendOnWhatsApp = async () => {
    if (items.length === 0 || !isSignedIn) return;
    setIsSending(true);
    try {
      const formData = { name: customer.name, phone: customer.phone, email: customer.email || '', address: deliveryAddress || '' };
      const { orderId, pdfBlob } = await generateOrderPDF(items, formData);

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `${orderId}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      try {
        await fetch('/api/customers?module=orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email || '',
            deliveryAddress: deliveryAddress || '',
            items: items.map(i => ({
              productId: i.product.id,
              productName: i.product.name,
              category: i.product.category,
              image: i.product.image,
              price: resolvePrice(i.product),
              quantity: i.quantity,
              subtotal: resolvePrice(i.product) * i.quantity,
            })),
            totalAmount: subtotal,
            status: 'pending',
            createdAt: new Date().toISOString(),
          }),
        });
      } catch (_) {}

      const waItems = items.map(i => ({ name: i.product.name, quantity: i.quantity, price: resolvePrice(i.product) }));
      const waLink = getWhatsAppLink('916350021226', orderId, customer.name, waItems, subtotal);
      window.open(waLink, '_blank');

      setIsSending(false);
      setOrderDone({ orderId, name: customer.name });
      clearCart();
    } catch {
      setIsSending(false);
      alert('Something went wrong. Please try again.');
    }
  };

  if (orderDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-2">Thank You, {orderDone.name.split(' ')[0]}! 🎉</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Order ID: {orderDone.orderId}</p>
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6 text-left space-y-2">
            <p className="text-sm font-black text-[#FA5600] uppercase tracking-widest mb-3">What happens next?</p>
            <p className="text-sm font-bold text-gray-700">📄 Your order PDF has been downloaded automatically.</p>
            <p className="text-sm font-bold text-gray-700">💬 WhatsApp has opened — please <span className="text-[#FA5600]">attach the PDF</span> and send the message.</p>
            <p className="text-sm font-bold text-gray-700">✅ We will confirm your order and contact you shortly.</p>
          </div>
          <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl p-4 mb-8">
            <p className="text-xs font-black text-[#25D366] uppercase tracking-widest">No payment needed now</p>
            <p className="text-xs text-gray-500 mt-1">Payment details will be shared via WhatsApp after confirmation.</p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/account" className="inline-flex items-center gap-2 border-2 border-[#FA5600] text-[#FA5600] font-black py-3 px-6 rounded-full hover:bg-orange-50 transition-colors uppercase tracking-widest text-sm">View Orders</Link>
            <Link to="/products" className="inline-flex items-center justify-center bg-[#FA5600] text-white font-black py-3 px-8 rounded-full shadow-lg hover:bg-[#E04A00] transition-colors uppercase tracking-widest text-sm">Continue Shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#FA5600]">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-400 text-sm mb-6">Add some items before checking out.</p>
        <Link to="/products" className="inline-flex items-center gap-2 bg-[#FA5600] text-white font-black py-3 px-8 rounded-full hover:bg-[#E04A00] transition-colors uppercase tracking-widest text-sm">Browse Catalog</Link>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="flex justify-between items-end mb-8 border-b-4 border-[#FA5600] pb-4">
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none uppercase">Order Summary</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-black uppercase tracking-widest border-b border-gray-200 pb-4 mb-4">Selected Items ({items.length})</h2>
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const imgSrc = (item.product as any).imageUrls?.[0] || (item.product as any).imageUrl || item.product.image || '';
              return (
                <li key={item.product.id} className="py-3 flex items-center gap-3">
                  <div className="w-12 h-12 shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    {imgSrc ? <img src={imgSrc} alt={item.product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm uppercase leading-tight truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-400">× {item.quantity}</p>
                  </div>
                  <p className="font-black text-[#FA5600] text-sm shrink-0">₹{(resolvePrice(item.product) * item.quantity).toFixed(2)}</p>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 p-4 bg-[#FA5600] text-white flex justify-between items-center rounded-xl">
            <span className="text-xs uppercase font-bold tracking-widest opacity-80">Estimated Total</span>
            <span className="text-2xl font-black">₹{subtotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border-2 border-[#FA5600] p-8 text-center">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-[#FA5600]" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 mb-2">Sign In to Checkout</h3>
          <p className="text-gray-500 text-sm mb-6">Sign in or create an account to place your order. Your cart will be saved.</p>
          <button
            onClick={() => { setRedirectAfterAuth('/order'); setShowSignIn(true); }}
            className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3.5 rounded-xl hover:bg-[#E04A00] transition"
          >
            Sign In / Sign Up
          </button>
          <p className="text-xs text-gray-400 mt-4">Your cart items are saved and will be here when you return.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-end mb-8 border-b-4 border-[#FA5600] pb-4">
        <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none uppercase">Order Summary</h1>
        <span className="text-slate-400 font-bold uppercase text-xs tracking-widest hidden sm:inline">Checkout</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 flex justify-between items-center border-b border-gray-200 pb-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Selected Items ({items.length})</h2>
              <button onClick={clearCart} className="text-[10px] uppercase font-bold text-slate-500 hover:text-red-500 border border-slate-200 px-3 py-1 rounded-full hover:border-red-300 transition-colors">Clear All</button>
            </div>
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const productId = (item.product as any)._id || item.product.id;
                const imgSrc = (item.product as any).imageUrls?.[0] || (item.product as any).imageUrl || item.product.image || '';
                return (
                  <li key={item.product.id} className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                    <Link to={`/products/${productId}`} className="w-20 h-20 shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:border-[#FA5600] transition-colors group">
                      {imgSrc ? <img src={imgSrc} alt={item.product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" /> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                    </Link>
                    <div className="flex-1 text-center sm:text-left">
                      <Link to={`/products/${productId}`} className="font-black uppercase text-base leading-tight mb-1 hover:text-[#FA5600] transition-colors block">{item.product.name}</Link>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.product.category}</p>
                      <div className="font-black text-lg mt-2 text-[#E53935]">₹{resolvePrice(item.product).toFixed(2)}</div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-3">
                      <div className="flex items-center gap-0 border-2 border-gray-200 rounded-full overflow-hidden">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-2 text-black hover:bg-[#FA5600] hover:text-white transition-colors"><Minus className="w-3 h-3" /></button>
                        <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-2 text-black hover:bg-[#FA5600] hover:text-white transition-colors"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => removeItem(item.product.id)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3" /> Remove</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 p-4 bg-[#FA5600] text-white flex justify-between items-center rounded-xl">
              <span className="text-xs uppercase font-bold tracking-widest opacity-80">Estimated Total</span>
              <span className="text-3xl font-black">₹{subtotal.toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-4">
            <div className="bg-[#25D366] text-white p-2 shrink-0 rounded-full"><AlertCircle className="w-5 h-5" /></div>
            <div>
              <h4 className="font-black uppercase text-sm tracking-widest text-green-800 mb-1">No Online Payment</h4>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide leading-relaxed">This is an order request. You will coordinate payment directly via WhatsApp after sending this form.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-32 space-y-5">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" /> Delivering To
              </h3>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-[#FA5600] rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-base">{customer.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-black text-sm text-gray-900">{customer.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Account holder</p>
                  </div>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <Phone className="w-3.5 h-3.5 text-[#FA5600] shrink-0" />
                    <span className="font-bold">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <Mail className="w-3.5 h-3.5 text-[#FA5600] shrink-0" />
                    <span className="font-bold truncate">{customer.email}</span>
                  </div>
                )}
                {/* Delivery address — editable inline for this order only */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <MapPin className="w-3 h-3 text-[#FA5600]" /> Delivery Address
                    </div>
                    <button
                      onClick={() => setEditingAddress(v => !v)}
                      className="text-[10px] font-black uppercase tracking-widest text-[#FA5600] hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      {editingAddress ? 'Done' : deliveryAddress ? 'Change' : 'Add'}
                    </button>
                  </div>
                  {editingAddress ? (
                    <div className="space-y-1.5">
                      <textarea
                        rows={2}
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        placeholder="Enter delivery address for this order..."
                        autoFocus
                        className="w-full border-2 border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none resize-none focus:ring-2 focus:ring-[#FA5600]/20 transition"
                      />
                      {customer.address && customer.address !== deliveryAddress && (
                        <button
                          onClick={() => { setDeliveryAddress(customer.address || ''); setEditingAddress(false); }}
                          className="text-[9px] text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest"
                        >
                          ↩ Use saved address
                        </button>
                      )}
                    </div>
                  ) : deliveryAddress ? (
                    <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-bold leading-relaxed">{deliveryAddress}</span>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingAddress(true)}
                      className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-100 transition"
                    >
                      <span className="font-bold">Tap to add delivery address</span>
                    </div>
                  )}
                  {deliveryAddress && customer.address && deliveryAddress !== customer.address && (
                    <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest">
                      ⚠ Delivering to a different address this time
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>Delivery</span>
                <span className="text-green-600">To be confirmed</span>
              </div>
              <div className="flex justify-between text-sm font-black text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span className="text-[#FA5600]">₹{subtotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleSendOnWhatsApp}
              disabled={isSending}
              className={`w-full text-white font-black py-4 rounded-full flex items-center justify-center gap-2 text-sm transition-all shadow-lg ${isSending ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#25D366] hover:bg-[#20bd5a]'}`}
            >
              {isSending ? <span className="animate-pulse">⏳ Preparing your order...</span> : <><MessageCircle className="w-5 h-5" /> Place Order on WhatsApp</>}
            </button>
            <p className="text-[9px] text-center uppercase font-bold text-slate-400 tracking-widest">Generates PDF & opens WhatsApp in one click</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderSummary;
