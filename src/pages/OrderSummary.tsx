import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { generateOrderPDF, getWhatsAppLink } from '../lib/pdfGenerator';
import { Trash2, Plus, Minus, MessageCircle, AlertCircle, ShoppingBag, Phone, Mail, MapPin, CheckCircle, Truck, Banknote } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  COD_CITY, COD_PIN_PREFIX, COD_MIN_ORDER, LOCAL_DELIVERY_CHARGE, COURIER_RATES, COURIER_DEFAULT_CHARGE,
  DELIVERY_DAYS_LOCAL, DELIVERY_DAYS_COURIER, UPI_ID, SHOP_WHATSAPP,
} from '../lib/storePolicy';

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

const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];

// Works out the payment method, delivery charge and delivery window for an address + cart total
function getCheckoutRules(city: string, pincode: string, state: string, subtotal: number) {
  const pin = pincode.trim();
  const pinValid = /^\d{6}$/.test(pin);
  const addressReady = !!city.trim() && pinValid;
  const isUdaipur = addressReady && city.trim().toLowerCase().includes(COD_CITY) && pin.startsWith(COD_PIN_PREFIX);
  const codEligible = isUdaipur && subtotal >= COD_MIN_ORDER;
  const method: 'cod' | 'advance' = codEligible ? 'cod' : 'advance';
  const effectiveState = isUdaipur ? 'Rajasthan' : state;
  let courierCharge: number | null = null; // null = to be confirmed
  if (isUdaipur) courierCharge = LOCAL_DELIVERY_CHARGE;
  else if (addressReady && state) {
    const rate = COURIER_RATES[state.toLowerCase()];
    courierCharge = rate !== undefined ? rate : COURIER_DEFAULT_CHARGE;
  }
  const [a, b] = isUdaipur ? DELIVERY_DAYS_LOCAL : DELIVERY_DAYS_COURIER;
  return { pinValid, addressReady, isUdaipur, codEligible, method, effectiveState, courierCharge, daysFrom: a, daysTo: b, codShortBy: isUdaipur && !codEligible ? COD_MIN_ORDER - subtotal : 0 };
}

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const fmtDay = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function OrderSummary() {
  const { items, updateQuantity, removeItem, clearCart, customer, setShowSignIn, setRedirectAfterAuth } = useCart();

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [orderDone, setOrderDone] = useState<any>(null);

  const isSignedIn = !!(customer.customerId);
  const subtotal = items.reduce((sum, item) => sum + (resolvePrice(item.product) * item.quantity), 0);

  // Guest details (used when not signed in — no account needed to order)
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gEmail, setGEmail] = useState('');

  // Delivery address for THIS order — street/area from the saved profile, city/pincode/state remembered from the last order
  const saved = (() => { try { return JSON.parse(localStorage.getItem('tags_last_delivery') || '{}'); } catch { return {}; } })();
  const [deliveryAddress, setDeliveryAddress] = useState(customer.address || '');
  const [city, setCity] = useState<string>(saved.city || '');
  const [pincode, setPincode] = useState<string>(saved.pincode || '');
  const [state, setState] = useState<string>(saved.state || '');

  const rules = getCheckoutRules(city, pincode, state, subtotal);
  const courierKnown = rules.courierCharge !== null;
  const payable = subtotal + (rules.courierCharge || 0);

  const contact = isSignedIn
    ? { name: customer.name, phone: customer.phone, email: customer.email || '' }
    : { name: gName.trim(), phone: gPhone.trim(), email: gEmail.trim() };
  const phoneDigits = contact.phone.replace(/\D/g, '');
  const detailsOk = !!contact.name && phoneDigits.length >= 10;
  const addressOk = !!deliveryAddress.trim() && rules.addressReady && (rules.isUdaipur || !!state);
  const canOrder = items.length > 0 && detailsOk && addressOk && !isSending;

  const missing: string[] = [];
  if (!contact.name) missing.push('your name');
  if (phoneDigits.length < 10) missing.push('a 10-digit mobile number');
  if (!deliveryAddress.trim()) missing.push('your street address');
  if (!city.trim()) missing.push('city');
  if (!rules.pinValid) missing.push('a 6-digit pincode');
  if (!rules.isUdaipur && !state) missing.push('state');

  const handlePlaceOrder = async () => {
    if (!canOrder) return;
    setIsSending(true);
    setError('');
    try {
      const fullAddress = `${deliveryAddress.trim()}, ${city.trim()}, ${rules.effectiveState} - ${pincode.trim()}`;
      const eta = { from: addDays(rules.daysFrom), to: addDays(rules.daysTo) };

      // The PDF is optional; it is only used to get a consistent order number and a downloadable copy
      let orderId = `TAGSORD-${Date.now()}`;
      let pdfUrl = '';
      try {
        const out = await generateOrderPDF(items, { name: contact.name, phone: contact.phone, email: contact.email, address: fullAddress });
        orderId = out.orderId; pdfUrl = URL.createObjectURL(out.pdfBlob);
      } catch {}

      const res = await fetch('/api/customers?module=orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerName: contact.name,
          customerPhone: contact.phone,
          customerEmail: contact.email,
          deliveryAddress: fullAddress,
          addressLine: deliveryAddress.trim(),
          deliveryCity: city.trim(),
          deliveryState: rules.effectiveState,
          deliveryPincode: pincode.trim(),
          paymentMethod: rules.method,
          courierCharge: rules.courierCharge,
          itemsTotal: subtotal,
          estimatedDeliveryFrom: eta.from.toISOString(),
          estimatedDeliveryTo: eta.to.toISOString(),
          items: items.map(i => ({
            productId: i.product.id,
            productName: i.product.name,
            category: i.product.category,
            image: i.product.image,
            price: resolvePrice(i.product),
            quantity: i.quantity,
            subtotal: resolvePrice(i.product) * i.quantity,
          })),
          totalAmount: payable,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not place your order. Please try again.');

      try { localStorage.setItem('tags_last_delivery', JSON.stringify({ city: city.trim(), pincode: pincode.trim(), state: rules.effectiveState })); } catch {}

      const waItems = items.map(i => ({ name: i.product.name, quantity: i.quantity, price: resolvePrice(i.product) }));
      setOrderDone({
        orderId, mongoId: data._id, name: contact.name, method: rules.method, payable, subtotal,
        courierCharge: rules.courierCharge, address: fullAddress, pdfUrl,
        etaText: `${fmtDay(eta.from)} – ${fmtDay(eta.to)}`,
        waLink: getWhatsAppLink(SHOP_WHATSAPP, orderId, contact.name, waItems, payable),
      });
      clearCart();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (orderDone) {
    const cod = orderDone.method === 'cod';
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-12">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-2">Order Placed, {orderDone.name.split(' ')[0]}! 🎉</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Order ID: {orderDone.orderId}</p>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4 text-left space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">Items total</span><span className="font-black">{inr(orderDone.subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">Delivery / courier</span><span className="font-black">{orderDone.courierCharge === null ? 'To be confirmed' : orderDone.courierCharge === 0 ? 'Free' : inr(orderDone.courierCharge)}</span></div>
            <div className="flex justify-between text-base border-t border-gray-200 pt-2"><span className="font-black">{cod ? 'Pay on delivery' : 'Pay in advance'}</span><span className="font-black text-[#FA5600]">{inr(orderDone.payable)}{orderDone.courierCharge === null ? ' + courier' : ''}</span></div>
            <div className="flex items-start gap-2 text-sm pt-2"><Truck className="w-4 h-4 text-[#FA5600] mt-0.5 shrink-0" /><span><b>Estimated delivery:</b> {orderDone.etaText}</span></div>
            <div className="flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 text-[#FA5600] mt-0.5 shrink-0" /><span className="font-bold text-gray-600">{orderDone.address}</span></div>
          </div>

          {cod ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-black text-green-700 uppercase tracking-widest">Cash on Delivery</p>
              <p className="text-xs text-gray-600 mt-1">Please keep {inr(orderDone.payable)} ready in cash. You pay the delivery person when your order arrives. We will confirm your order shortly.</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-left space-y-1">
              <p className="text-xs font-black text-blue-700 uppercase tracking-widest">Advance payment needed</p>
              <p className="text-xs text-gray-600">
                {orderDone.courierCharge === null
                  ? 'We will message you the courier charge on WhatsApp. Pay the items total plus the courier charge in advance, then we dispatch your order.'
                  : `Please pay ${inr(orderDone.payable)} (items + courier charge) in advance. We dispatch your order as soon as the payment is received.`}
              </p>
              {UPI_ID && <p className="text-xs text-gray-700">UPI ID: <b>{UPI_ID}</b></p>}
              <p className="text-xs text-gray-600">After paying, send the payment screenshot with your Order ID on WhatsApp.</p>
            </div>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <a href={orderDone.waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#25D366] text-white font-black py-3 px-6 rounded-full hover:bg-[#20bd5a] transition-colors uppercase tracking-widest text-sm"><MessageCircle className="w-4 h-4" /> {cod ? 'Message us on WhatsApp' : 'Send payment proof on WhatsApp'}</a>
            {orderDone.mongoId && <Link to={`/track/${orderDone.mongoId}`} className="inline-flex items-center gap-2 border-2 border-[#FA5600] text-[#FA5600] font-black py-3 px-6 rounded-full hover:bg-orange-50 transition-colors uppercase tracking-widest text-sm">Track Order</Link>}
            {orderDone.pdfUrl && <a href={orderDone.pdfUrl} download={`${orderDone.orderId}.pdf`} className="inline-flex items-center gap-2 border-2 border-gray-300 text-gray-600 font-black py-3 px-6 rounded-full hover:border-gray-400 transition-colors uppercase tracking-widest text-sm">Download PDF</a>}
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
          {/* Payment method — decided by the delivery address and order value */}
          {!rules.addressReady ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-start gap-4">
              <div className="bg-gray-300 text-white p-2 shrink-0 rounded-full"><Banknote className="w-5 h-5" /></div>
              <div>
                <h4 className="font-black uppercase text-sm tracking-widest text-gray-700 mb-1">Payment options</h4>
                <p className="text-xs font-bold text-gray-500 leading-relaxed">Enter your delivery city and pincode to see how you can pay. Cash on Delivery is available in Udaipur for orders of {inr(COD_MIN_ORDER)} or more. Everywhere else in India we ask for advance payment, plus the courier charge.</p>
              </div>
            </div>
          ) : rules.codEligible ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-4">
              <div className="bg-[#25D366] text-white p-2 shrink-0 rounded-full"><Banknote className="w-5 h-5" /></div>
              <div>
                <h4 className="font-black uppercase text-sm tracking-widest text-green-800 mb-1">Cash on Delivery</h4>
                <p className="text-xs font-bold text-green-700 leading-relaxed">Pay {inr(payable)} in cash when your order arrives. No online payment needed.</p>
              </div>
            </div>
          ) : rules.isUdaipur ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
              <div className="bg-amber-500 text-white p-2 shrink-0 rounded-full"><AlertCircle className="w-5 h-5" /></div>
              <div>
                <h4 className="font-black uppercase text-sm tracking-widest text-amber-800 mb-1">Cash on Delivery needs {inr(COD_MIN_ORDER)}+</h4>
                <p className="text-xs font-bold text-amber-700 leading-relaxed">Add {inr(rules.codShortBy)} more to pay on delivery in Udaipur. For smaller orders, please pay in advance — we will share the payment details on WhatsApp.</p>
                <Link to="/products" className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest text-[#FA5600] hover:underline">Add more items →</Link>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
              <div className="bg-blue-600 text-white p-2 shrink-0 rounded-full"><Truck className="w-5 h-5" /></div>
              <div>
                <h4 className="font-black uppercase text-sm tracking-widest text-blue-800 mb-1">Advance payment · courier delivery</h4>
                <p className="text-xs font-bold text-blue-700 leading-relaxed">
                  Orders outside Udaipur are paid in advance, including the courier charge for your address.
                  {courierKnown ? ` Courier charge to ${state}: ${inr(rules.courierCharge as number)}.` : ' We will confirm the courier charge on WhatsApp before you pay.'}
                  {UPI_ID ? ` Pay to UPI ID ${UPI_ID} after placing your order.` : ' Payment details are shared after you place the order.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-32 space-y-5">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest border-b border-gray-200 pb-3 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" /> Your Details
              </h3>
              {isSignedIn ? (
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
                      <Phone className="w-3.5 h-3.5 text-[#FA5600] shrink-0" /><span className="font-bold">{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      <Mail className="w-3.5 h-3.5 text-[#FA5600] shrink-0" /><span className="font-bold truncate">{customer.email}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input value={gName} onChange={e => setGName(e.target.value)} placeholder="Full name *" autoComplete="name"
                    className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none transition" />
                  <input value={gPhone} onChange={e => setGPhone(e.target.value)} placeholder="Mobile number *" inputMode="tel" autoComplete="tel"
                    className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none transition" />
                  <input value={gEmail} onChange={e => setGEmail(e.target.value)} placeholder="Email (optional)" inputMode="email" autoComplete="email"
                    className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none transition" />
                  <button onClick={() => { setRedirectAfterAuth('/order'); setShowSignIn(true); }}
                    className="text-[10px] font-black uppercase tracking-widest text-[#FA5600] hover:underline">Have an account? Sign in</button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                <MapPin className="w-3 h-3 text-[#FA5600]" /> Delivery Address
              </div>
              <textarea rows={2} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="House / street / area / landmark *" autoComplete="street-address"
                className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none resize-none transition" />
              <div className="grid grid-cols-2 gap-2">
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="City *" autoComplete="address-level2"
                  className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none transition" />
                <input value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Pincode *" inputMode="numeric" autoComplete="postal-code"
                  className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none transition" />
              </div>
              {!rules.isUdaipur && (
                <select value={state} onChange={e => setState(e.target.value)}
                  className="w-full border-2 border-gray-200 focus:border-[#FA5600] rounded-xl px-3 py-2 text-xs font-bold outline-none bg-white transition">
                  <option value="">State *</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {rules.addressReady && (
                <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-[#FA5600]" /> Estimated delivery: {fmtDay(addDays(rules.daysFrom))} – {fmtDay(addDays(rules.daysTo))}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span>{inr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 font-bold">
                <span>{rules.isUdaipur ? 'Delivery' : 'Courier charge'}</span>
                <span className={rules.courierCharge === 0 ? 'text-green-600' : ''}>
                  {!rules.addressReady ? 'Enter address' : rules.courierCharge === null ? 'Confirmed on WhatsApp' : rules.courierCharge === 0 ? 'Free' : inr(rules.courierCharge)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-gray-900 border-t border-gray-200 pt-2">
                <span>{rules.addressReady && rules.method === 'cod' ? 'Pay on delivery' : 'Total'}</span>
                <span className="text-[#FA5600]">{inr(payable)}{rules.addressReady && rules.courierCharge === null ? ' + courier' : ''}</span>
              </div>
            </div>

            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
            {!canOrder && !isSending && missing.length > 0 && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Please add: {missing.join(', ')}</p>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={!canOrder}
              className={`w-full text-white font-black py-4 rounded-full flex items-center justify-center gap-2 text-sm transition-all shadow-lg ${!canOrder ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-[#FA5600] hover:bg-[#E04A00]'}`}
            >
              {isSending
                ? <span className="animate-pulse">⏳ Placing your order...</span>
                : rules.addressReady && rules.method === 'cod' ? <>Place Order · Cash on Delivery</> : <>Place Order · Pay in Advance</>}
            </button>
            <p className="text-[9px] text-center uppercase font-bold text-slate-400 tracking-widest">No payment gateway · No account needed</p>
            <p className="text-[10px] text-center text-gray-400 leading-relaxed">
              By placing your order you agree to our{' '}
              <Link to="/shipping-policy" className="underline hover:text-[#FA5600]">Shipping &amp; Delivery</Link> and{' '}
              <Link to="/return-policy" className="underline hover:text-[#FA5600]">Returns &amp; Refunds</Link> policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderSummary;
