import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Delete } from 'lucide-react';

export default function PosLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  async function submitPin(pinValue: string) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/business?module=auth&action=pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid PIN'); setPin(''); return; }
      login(data.token, data.user);
      navigate(data.user.role === 'delivery_boy' ? '/driver' : '/pos');
    } catch {
      setError('Network error. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  function pressKey(key: string) {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length >= 4) submitPin(next);
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center px-4">
      <div className="w-full max-w-xs">

        <div className="text-center mb-10">
          <div className="text-4xl font-black tracking-tighter uppercase mb-1 text-white">
            <span className="text-[#FA5600]">T</span>AGS
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">POS Login</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-8">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-150 ${i < pin.length ? 'bg-[#FA5600] scale-110' : 'bg-white/20'}`} />
          ))}
        </div>

        {error && <div className="mb-6 text-center text-xs font-bold text-red-400 uppercase tracking-widest">{error}</div>}
        {loading && <div className="mb-6 text-center text-xs font-bold text-[#FA5600] uppercase tracking-widest animate-pulse">Verifying...</div>}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PAD.map((key, i) => {
            if (key === '') return <div key={i} />;
            return (
              <button
                key={i} onClick={() => pressKey(key)} disabled={loading}
                className={`h-16 rounded-2xl text-white font-black text-xl transition-all duration-100 active:scale-95 disabled:opacity-40 ${key === '⌫' ? 'bg-white/10 hover:bg-white/20 flex items-center justify-center' : 'bg-white/10 hover:bg-[#FA5600] hover:shadow-lg'}`}
              >
                {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
              </button>
            );
          })}
        </div>

        <div className="text-center">
          <Link to="/login" className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
            Admin / Manager? Sign in with email →
          </Link>
        </div>

      </div>
    </div>
  );
}
