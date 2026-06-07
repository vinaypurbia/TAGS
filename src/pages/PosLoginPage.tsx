import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function PosLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) { setError('Username and password are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/business?module=auth&action=staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid credentials'); return; }
      login(data.token, data.user);
      navigate(data.user.role === 'delivery_boy' ? '/driver' : '/pos');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm font-bold focus:ring-2 focus:ring-[#FA5600] focus:border-[#FA5600] outline-none placeholder-white/20 transition';

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center px-4">
      <div className="w-full max-w-xs">

        <div className="text-center mb-10">
          <div className="text-4xl font-black tracking-tighter uppercase mb-1 text-white">
            <span className="text-[#FA5600]">T</span>AGS
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Staff Login</p>
        </div>

        <div className="space-y-3">
          {/* Username */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1.5">Username or Email</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Your name or email"
              autoComplete="username"
              className={inputCls}
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={inputCls + ' pr-12'}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-center text-xs font-bold text-red-400 uppercase tracking-widest bg-red-400/10 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl hover:bg-[#E04A00] transition active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>

        <div className="text-center mt-8">
          <Link to="/login" className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
            Admin / Manager? Sign in with email →
          </Link>
        </div>

        <div className="text-center mt-4">
          <a
            href="/"
            className="text-[10px] font-bold uppercase tracking-widest text-white/25 hover:text-white/50 transition-colors"
          >
            ← Back to Website
          </a>
        </div>

      </div>
    </div>
  );
}
