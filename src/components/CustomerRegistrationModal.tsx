import { useState } from 'react';
import { useCart } from '../context/CartContext';

export function CustomerRegistrationModal() {
  const { showRegistration, setShowRegistration, setCustomer, pendingProduct, setPendingProduct, items } = useCart();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [errors, setErrors] = useState({ name: '', phone: '' });

  if (!showRegistration) return null;

  const validate = () => {
    const newErrors = { name: '', phone: '' };
    if (!form.name.trim()) newErrors.name = 'Please enter your name.';
    if (!form.phone.trim()) newErrors.phone = 'Please enter your mobile number.';
    else if (!/^\+?[\d\s\-()]{7,}$/.test(form.phone.trim())) newErrors.phone = 'Please enter a valid number.';
    setErrors(newErrors);
    return !newErrors.name && !newErrors.phone;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setCustomer({ name: form.name.trim(), phone: form.phone.trim() });

    // Now add the pending product to cart
    if (pendingProduct) {
      const existing = items.find(i => i.product.id === pendingProduct.id);
      // We directly update via context's internal logic won't re-trigger modal
      // So we dispatch to parent via a custom event
      window.dispatchEvent(new CustomEvent('add-pending-product', { detail: pendingProduct }));
      setPendingProduct(null);
    }

    setShowRegistration(false);
  };

  const handleSkip = () => {
    // Allow skipping — just set name as Guest
    setCustomer({ name: 'Guest', phone: '' });
    if (pendingProduct) {
      window.dispatchEvent(new CustomEvent('add-pending-product', { detail: pendingProduct }));
      setPendingProduct(null);
    }
    setShowRegistration(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#25D366] p-6 text-white text-center">
          <div className="text-4xl mb-2">👋</div>
          <h2 className="text-xl font-black uppercase tracking-tight">Welcome!</h2>
          <p className="text-sm opacity-90 mt-1">Enter your details to start ordering</p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-1">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Ahmed Ali"
              className="w-full border-2 border-gray-200 rounded-lg p-3 font-bold focus:border-[#25D366] outline-none transition"
              autoFocus
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-1">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. +965 9999 9999"
              className="w-full border-2 border-gray-200 rounded-lg p-3 font-bold focus:border-[#25D366] outline-none transition"
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            Your details are saved on this device for faster ordering next time.
          </p>

          <button
            onClick={handleSubmit}
            className="w-full bg-[#25D366] text-white font-black py-3 rounded-lg hover:bg-green-600 transition uppercase tracking-widest text-sm">
            Save & Continue
          </button>

          <button
            onClick={handleSkip}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition font-bold py-1">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerRegistrationModal;
