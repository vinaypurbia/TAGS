import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { X, Phone, User, Mail, MapPin, MessageCircle, Loader, Eye, EyeOff, Lock, KeyRound } from 'lucide-react';

type Mode = 'phone' | 'login-password' | 'login-otp' | 'otp-sent' | 'register' | 'done';

export function CustomerRegistrationModal() {
  const { showSignIn, setShowSignIn, setCustomer, setCustomerToken, redirectAfterAuth, setRedirectAfterAuth } = useCart();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [existingCustomer, setExistingCustomer] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', address: '', whatsapp: '', password: '', confirmPassword: '' });
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!showSignIn) return null;

  function close(shouldRedirect = false) {
    setShowSignIn(false);
    setMode('phone');
    setPhone('');
    setForm({ name: '', email: '', address: '', whatsapp: '', password: '', confirmPassword: '' });
    setOtp('');
    setError('');
    setSuccessMsg('');
    setExistingCustomer(null);
    if (shouldRedirect && redirectAfterAuth) {
      const path = redirectAfterAuth;
      setRedirectAfterAuth(null);
      navigate(path);
    }
  }

  function saveSession(token: string, customerData: any) {
    setCustomerToken(token);
    setCustomer({
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email || '',
      customerId: customerData.customerId,
    });
    close(true);
  }

  // Step 1: Check phone
  async function handlePhoneLookup() {
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/customers?phone=${encodeURIComponent(phone.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setExistingCustomer(data);
        // Existing account — show login options
        setMode(data.passwordHash ? 'login-password' : 'login-otp');
      } else {
        // New customer — register
        setForm(f => ({ ...f, whatsapp: phone.trim() }));
        setMode('register');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  // Password login
  async function handlePasswordLogin() {
    if (!form.password) { setError('Please enter your password'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/customers?module=auth&action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password: form.password }),
      });
      const data = await res.json();
      if (data.success) { saveSession(data.token, data.customer); }
      else { setError(data.error || 'Login failed'); }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  // Send OTP
  async function handleSendOTP() {
    if (!existingCustomer?.email) { setError('No email on your account. Please use password login or contact the store.'); return; }
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await fetch('/api/customers?module=auth&action=send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), email: existingCustomer.email }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`OTP sent to ${existingCustomer.email}`);
        setMode('otp-sent');
      } else { setError(data.error || 'Failed to send OTP'); }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  // Verify OTP
  async function handleVerifyOTP() {
    if (otp.length < 6) { setError('Please enter the 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/customers?module=auth&action=verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), otp }),
      });
      const data = await res.json();
      if (data.success) { saveSession(data.token, data.customer); }
      else { setError(data.error || 'Invalid OTP'); }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  // Register new customer
  async function handleRegister() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.password || form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/customers?module=auth&action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success) { saveSession(data.token, data.customer); }
      else { setError(data.error || 'Registration failed'); }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  const modeTitle: Record<Mode, string> = {
    'phone': 'Sign In',
    'login-password': 'Welcome Back!',
    'login-otp': 'Login with OTP',
    'otp-sent': 'Enter OTP',
    'register': 'Create Account',
    'done': 'Done',
  };

  const modeSubtitle: Record<Mode, string> = {
    'phone': 'Enter your phone to continue',
    'login-password': 'Enter your password',
    'login-otp': 'We\'ll send an OTP to your email',
    'otp-sent': `Check ${existingCustomer?.email || 'your email'}`,
    'register': 'Create your account',
    'done': '',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#FA5600] px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-lg uppercase tracking-tight">{modeTitle[mode]}</h2>
            <p className="text-white/80 text-xs mt-0.5">{modeSubtitle[mode]}</p>
          </div>
          <button onClick={() => close()} className="text-white/70 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">

          {/* ── PHONE LOOKUP ── */}
          {mode === 'phone' && (
            <>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handlePhoneLookup()}
                    placeholder="+91 98765 43210" autoFocus
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                  />
                </div>
                {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
              </div>
              <button onClick={handlePhoneLookup} disabled={loading}
                className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Checking...' : 'Continue →'}
              </button>
              <p className="text-center text-xs text-gray-400">New customer? Enter your phone and we'll create your account.</p>
            </>
          )}

          {/* ── PASSWORD LOGIN ── */}
          {mode === 'login-password' && (
            <>
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                <div className="w-9 h-9 bg-[#FA5600] rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white font-black">{existingCustomer?.name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-black text-sm text-gray-900">{existingCustomer?.name}</p>
                  <p className="text-xs text-gray-400">{phone}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordLogin()}
                    placeholder="Your password" autoFocus
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
              </div>

              <button onClick={handlePasswordLogin} disabled={loading}
                className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              {existingCustomer?.email && (
                <button onClick={() => { setError(''); setMode('login-otp'); }}
                  className="w-full text-xs font-bold text-[#FA5600] hover:underline py-1">
                  Forgot password? Use Email OTP instead →
                </button>
              )}
              <button onClick={() => setMode('phone')} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">← Back</button>
            </>
          )}

          {/* ── OTP LOGIN ── */}
          {mode === 'login-otp' && (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 font-bold">
                We'll send a 6-digit OTP to <strong>{existingCustomer?.email || 'your email'}</strong>
              </div>
              {!existingCustomer?.email && (
                <p className="text-xs text-red-500">No email on this account. Please contact the store to reset your password.</p>
              )}
              {error && <p className="text-red-500 text-xs">{error}</p>}
              {existingCustomer?.email && (
                <button onClick={handleSendOTP} disabled={loading}
                  className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {loading ? 'Sending OTP...' : 'Send OTP to Email'}
                </button>
              )}
              <button onClick={() => setMode('login-password')} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">← Use Password instead</button>
            </>
          )}

          {/* ── OTP SENT — enter code ── */}
          {mode === 'otp-sent' && (
            <>
              {successMsg && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700 font-bold">
                  ✅ {successMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">6-Digit OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" inputMode="numeric" maxLength={6} value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                    placeholder="Enter 6-digit OTP" autoFocus
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold tracking-widest focus:border-[#FA5600] outline-none transition"
                  />
                </div>
                {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
              </div>
              <button onClick={handleVerifyOTP} disabled={loading || otp.length < 6}
                className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button onClick={handleSendOTP} disabled={loading} className="w-full text-xs text-[#FA5600] hover:underline py-1">
                Resend OTP
              </button>
            </>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <>
              <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                No account found for <strong>{phone}</strong> — create one below.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Email (for OTP login)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Password * (min 6 chars)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPass ? 'text' : 'password'} value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Create a password"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="password" value={form.confirmPassword}
                      onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="Repeat password"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">Passwords don't match</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Delivery Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Your delivery address" rows={2}
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition resize-none" />
                  </div>
                </div>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button onClick={handleRegister} disabled={loading}
                className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Creating Account...' : 'Create Account & Continue →'}
              </button>
              <button onClick={() => setMode('phone')} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">← Back</button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default CustomerRegistrationModal;
