import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { X, Phone, User, Mail, MapPin, MessageCircle, Loader } from 'lucide-react';

export function CustomerRegistrationModal() {
  const { showSignIn, setShowSignIn, setCustomer } = useCart();

  const [mode, setMode] = useState<'lookup' | 'register' | 'found'>('lookup');
  const [phone, setPhone] = useState('');
  const [form, setForm] = useState({ name: '', whatsapp: '', email: '', address: '' });
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!showSignIn) return null;

  function close() {
    setShowSignIn(false);
    setMode('lookup');
    setPhone('');
    setForm({ name: '', whatsapp: '', email: '', address: '' });
    setFoundCustomer(null);
    setError('');
  }

  // Step 1: Look up by phone
  async function handleLookup() {
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/customers?phone=${encodeURIComponent(phone.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setFoundCustomer(data);
        setCustomer({
          name: data.name,
          phone: data.phone,
          whatsapp: data.whatsapp || data.phone,
          email: data.email || '',
          address: data.address || '',
          customerId: data._id?.toString(),
        });
        setMode('found');
      } else {
        // Not found — go to registration
        setForm(f => ({ ...f, whatsapp: phone.trim() }));
        setMode('register');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2a: Register new customer
  async function handleRegister() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!phone.trim()) { setError('Phone is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: phone.trim(),
          whatsapp: form.whatsapp.trim() || phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
        }),
      });
      const data = await res.json();
      if (data.success || data._id) {
        setCustomer({
          name: form.name.trim(),
          phone: phone.trim(),
          whatsapp: form.whatsapp.trim() || phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          customerId: data._id?.toString(),
        });
        close();
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#FA5600] px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-lg uppercase tracking-tight">
              {mode === 'lookup' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Welcome Back!'}
            </h2>
            <p className="text-white/80 text-xs mt-0.5">
              {mode === 'lookup' ? 'Enter your phone to continue' :
               mode === 'register' ? 'Fill your details to get started' :
               'Your account is ready'}
            </p>
          </div>
          <button onClick={close} className="text-white/70 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* ── LOOKUP MODE ── */}
          {mode === 'lookup' && (
            <>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel" value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLookup()}
                    placeholder="+91 98765 43210"
                    autoFocus
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                  />
                </div>
                {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
              </div>
              <button
                onClick={handleLookup} disabled={loading}
                className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Checking...' : 'Continue →'}
              </button>
              <p className="text-center text-xs text-gray-400">
                New customer? Enter your phone and we'll create your account.
              </p>
            </>
          )}

          {/* ── REGISTER MODE ── */}
          {mode === 'register' && (
            <>
              <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                No account found for <strong>{phone}</strong> — fill your details to create one.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">WhatsApp Number</label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" value={form.whatsapp}
                      onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="WhatsApp number (if different)"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Delivery Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Your delivery address"
                      rows={2}
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition resize-none"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                onClick={handleRegister} disabled={loading}
                className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Creating Account...' : 'Create Account & Continue'}
              </button>

              <button onClick={() => setMode('lookup')} className="w-full text-xs text-gray-400 hover:text-gray-600 transition py-1">
                ← Back
              </button>
            </>
          )}

          {/* ── FOUND MODE ── */}
          {mode === 'found' && foundCustomer && (
            <>
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="w-10 h-10 bg-[#FA5600] rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-lg">{foundCustomer.name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-black text-sm text-gray-900">{foundCustomer.name}</p>
                  <p className="text-xs text-gray-500">{foundCustomer.phone}</p>
                  {foundCustomer.email && <p className="text-xs text-gray-400">{foundCustomer.email}</p>}
                </div>
              </div>

              {foundCustomer.totalOrders > 0 && (
                <p className="text-xs text-center text-gray-500">
                  You have <strong>{foundCustomer.totalOrders}</strong> previous order{foundCustomer.totalOrders > 1 ? 's' : ''} with us.
                  <a href="/account" className="text-[#FA5600] font-bold ml-1">View history →</a>
                </p>
              )}

              <button
                onClick={close}
                className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition"
              >
                Continue Shopping
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default CustomerRegistrationModal;
