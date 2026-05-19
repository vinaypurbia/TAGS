import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { generateOrderPDF, getWhatsAppLink } from '../lib/pdfGenerator';
import { Trash2, Plus, Minus, MessageCircle, AlertCircle, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

// Safely resolve price from any product shape (price / discountedPrice / originalPrice)
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
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });
  const [isSending, setIsSending] = useState(false);
  const [orderDone, setOrderDone] = useState<{ orderId: string; name: string } | null>(null);

  const subtotal = items.reduce((sum, item) => sum + (resolvePrice(item.product) * item.quantity), 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // One click: generate PDF + open WhatsApp
  const handleSendOnWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setIsSending(true);

    try {
      const { orderId, pdfBlob } = await generateOrderPDF(items, formData);

      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Auto-register customer + save order to DB (fire and forget)
      try {
        // Upsert customer by phone
        await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            email: formData.email || '',
            address: formData.address || '',
          }),
        });

        // Save order under customer
        await fetch('/api/customers?module=orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            customerName: formData.name,
            customerPhone: formData.phone,
            customerEmail: formData.email || '',
            deliveryAddress: formData.address || '',
            items: items.map(i => ({
              productId: i.product.id,
              productName: i.product.name,
              category: i.product.category,
              image: i.product.image,
              price: resolvePrice(i.product),
              quantity: i.quantity,
              subtotal: resolvePrice(i.product) * i.quantity,
            })),
            totalAmount: items.reduce((s, i) => s + resolvePrice(i.product) * i.quantity, 0),
            status: 'pending',
            createdAt: new Date().toISOString(),
          }),
        });
      } catch (_) {
        // Silent fail — order still goes through WhatsApp
      }

      // Open WhatsApp IMMEDIATELY — must happen synchronously after user action
      // to avoid browser popup blocker (setTimeout breaks this)
      const waLink = getWhatsAppLink('916350021226', orderId, formData.name);
      window.open(waLink, '_blank');

      // Update UI state
      setIsSending(false);
      setOrderDone({ orderId, name: formData.name });
      clearCart();

    } catch (err) {
      setIsSending(false);
      alert('Something went wrong. Please try again.');
    }
  };

  // ── THANK YOU SCREEN ───────────────────────────────────────
  if (orderDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12">
          {/* Animated checkmark */}
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-2">
            Thank You, {orderDone.name.split(' ')[0]}! 🎉
          </h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">
            Order ID: {orderDone.orderId}
          </p>

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

          <Link
            to="/products"
            className="inline-flex items-center justify-center bg-[#FA5600] text-white font-black py-3 px-8 rounded-full shadow-lg hover:bg-[#E04A00] transition-colors uppercase tracking-widest text-sm"
          >
            Continue Shopping
          </Link>
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
        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Your Order List is Empty</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">Browse our catalog to add some amazing toys or adventure gear to your list.</p>
        <Link to="/products" className="inline-flex items-center justify-center bg-[#FA5600] text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-[#E04A00] transition-colors">
          Browse Catalog
        </Link>
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

        {/* Left: Items */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 flex justify-between items-center border-b border-gray-200 pb-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Selected Items ({items.length})</h2>
              <button onClick={clearCart} className="text-[10px] uppercase font-bold text-slate-500 hover:text-red-500 border border-slate-200 px-3 py-1 rounded-full hover:border-red-300 transition-colors">
                Clear All
              </button>
            </div>

            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const productId = (item.product as any)._id || item.product.id;
                const imgSrc =
                  (item.product as any).imageUrls?.[0] ||
                  (item.product as any).imageUrl ||
                  item.product.image || '';
                return (
                <li key={item.product.id} className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-4 items-center sm:items-start">

                  {/* Clickable thumbnail */}
                  <Link
                    to={`/products/${productId}`}
                    className="w-20 h-20 shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:border-[#FA5600] transition-colors group"
                  >
                    {imgSrc
                      ? <img src={imgSrc} alt={item.product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                    }
                  </Link>

                  <div className="flex-1 text-center sm:text-left">
                    {/* Clickable product name */}
                    <Link
                      to={`/products/${productId}`}
                      className="font-black uppercase text-base leading-tight mb-1 hover:text-[#FA5600] transition-colors block"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.product.category}</p>
                    <div className="font-black text-lg mt-2 text-[#E53935]">₹{resolvePrice(item.product).toFixed(2)}</div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-3">
                    <div className="flex items-center gap-0 border-2 border-gray-200 rounded-full overflow-hidden">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-2 text-black hover:bg-[#FA5600] hover:text-white transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-2 text-black hover:bg-[#FA5600] hover:text-white transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.product.id)}
                      className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
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
            <div className="bg-[#25D366] text-white p-2 shrink-0 rounded-full">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black uppercase text-sm tracking-widest text-green-800 mb-1">No Online Payment</h4>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide leading-relaxed">
                This is an order request. You will coordinate payment directly via WhatsApp after sending this form.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Form + WhatsApp Button */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-32">
            <form onSubmit={handleSendOnWhatsApp} className="flex flex-col gap-5">
              <h3 className="text-sm font-black uppercase tracking-widest border-b border-gray-200 pb-3">Your Details</h3>

              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input type="text" name="name" required value={formData.name} onChange={handleInputChange}
                  placeholder="Your name"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg font-bold text-sm outline-none focus:border-[#FA5600] transition-colors" />
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input type="tel" name="phone" required value={formData.phone} onChange={handleInputChange}
                  placeholder="+91 00000 00000"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg font-bold text-sm outline-none focus:border-[#FA5600] transition-colors" />
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase mb-2">
                  Email Address <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange}
                  placeholder="you@example.com"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg font-bold text-sm outline-none focus:border-[#FA5600] transition-colors" />
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase mb-2">
                  Delivery Address <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea name="address" rows={3} value={formData.address} onChange={handleInputChange}
                  placeholder="Street, City, PIN code"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg font-bold text-sm outline-none focus:border-[#FA5600] transition-colors resize-none" />
              </div>

              {/* Single WhatsApp Button */}
              <button type="submit" disabled={isSending}
                className={`w-full text-white font-black py-4 rounded-full flex items-center justify-center gap-2 text-sm transition-all shadow-lg ${
                  isSending ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#25D366] hover:bg-[#20bd5a]'
                }`}>
                {isSending ? (
                  <span className="animate-pulse">⏳ Preparing your order...</span>
                ) : (
                  <><MessageCircle className="w-5 h-5" /> Send Order on WhatsApp</>
                )}
              </button>

              <p className="text-[9px] text-center uppercase font-bold text-slate-400 tracking-widest">
                Generates PDF & opens WhatsApp in one click
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

export default OrderSummary;
