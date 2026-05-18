import { useState, useEffect, useRef, useCallback } from 'react';
import { ProductManagerEmbed } from './ProductManagerEmbed';
import { ManageCategoriesEmbed } from './ManageCategoriesEmbed';
import { InventoryEmbed } from './InventoryEmbed';
import { BusinessEmbed } from './BusinessEmbed';
import {
  Lock, LogOut, Megaphone, Image, Tag, Package, FolderTree,
  Save, Check, Trash2, Eye, Upload, BarChart2,
  LayoutDashboard, ShoppingBag, Menu, X,
  TrendingUp, TrendingDown, Users, AlertTriangle, DollarSign,
  KeyRound, EyeOff,
} from 'lucide-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';
const SESSION_KEY    = 'adminAuth';
const VISIBILITY_KEY = 'tagsAdminVisibility';

type Section =
  | 'dashboard' | 'promo' | 'banner' | 'category-images'
  | 'products' | 'categories' | 'inventory' | 'business' | 'settings' | 'import';

interface BannerSlide { image: string; text: string; description: string; }
interface PromoLine   { text: string; }

const ALL_MODULES: { id: Section; label: string; icon: any; desc: string }[] = [
  { id: 'dashboard',       label: 'Dashboard',       icon: LayoutDashboard, desc: 'Overview & quick stats' },
  { id: 'business',        label: 'Business',         icon: BarChart2,       desc: 'Sales, PO, Cash Flow, Reports' },
  { id: 'inventory',       label: 'Inventory',        icon: ShoppingBag,     desc: 'Stock management' },
  { id: 'products',        label: 'Products',         icon: Package,         desc: 'Add & edit products' },
  { id: 'categories',      label: 'Categories',       icon: FolderTree,      desc: 'Manage categories' },
  { id: 'category-images', label: 'Category Images',  icon: Tag,             desc: 'Upload category covers' },
  { id: 'banner',          label: 'Hero Banners',     icon: Image,           desc: 'Homepage banners' },
  { id: 'promo',           label: 'Offer Bar',        icon: Megaphone,       desc: 'Scrolling announcements' },
  { id: 'import',          label: 'Import Products',  icon: Upload,          desc: 'Bulk import via CSV' },
  { id: 'settings',        label: 'Settings',         icon: SettingsIcon,    desc: 'Module visibility' },
];

// ── Change Password Form (shared between login screen and Settings) ──────────
function ChangePasswordForm({ onSuccess, onCancel }: {
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [current,   setCurrent]   = useState('');
  const [next,      setNext]      = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!current || !next || !confirm) { setError('All fields are required.'); return; }
    if (next.length < 6)               { setError('New password must be at least 6 characters.'); return; }
    if (next !== confirm)              { setError('New passwords do not match.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to change password.'); return; }
      setSuccess(true);
      setCurrent(''); setNext(''); setConfirm('');
      setTimeout(() => { setSuccess(false); onSuccess?.(); }, 1800);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:ring-2 focus:ring-[#FA5600] focus:border-[#FA5600] outline-none placeholder-white/20 transition';

  return (
    <div className="space-y-3">
      {/* Current password */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Current Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            placeholder="Enter current password"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* New password */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">New Password</label>
        <input
          type={showPw ? 'text' : 'password'}
          value={next}
          onChange={e => setNext(e.target.value)}
          placeholder="Min 6 characters"
          className={inputCls}
        />
      </div>

      {/* Confirm */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Confirm New Password</label>
        <input
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Repeat new password"
          className={inputCls}
        />
      </div>

      {/* Strength hint */}
      {next.length > 0 && (
        <div className="flex gap-1">
          {[1,2,3,4].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
              next.length >= i * 3
                ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-yellow-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-400'
                : 'bg-white/10'
            }`} />
          ))}
        </div>
      )}

      {error   && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}
      {success && <p className="text-green-400 text-xs font-bold text-center">✅ Password changed successfully!</p>}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 border border-white/10 text-white/50 hover:text-white hover:border-white/30 font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition">
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving || success}
          className={`flex-1 font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition flex items-center justify-center gap-2
            ${success ? 'bg-green-500 text-white' : 'bg-[#FA5600] hover:bg-[#E04A00] text-white'} disabled:opacity-60`}>
          {success ? <><Check className="w-3.5 h-3.5" /> Changed!</> : saving ? 'Saving...' : <><KeyRound className="w-3.5 h-3.5" /> Update Password</>}
        </button>
      </div>
    </div>
  );
}

// ── Settings: Change Password card (light theme for inside admin) ─────────────
function ChangePasswordCard() {
  const [open,    setOpen]    = useState(false);
  const [success, setSuccess] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-[#FA5600]" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900 uppercase tracking-tight">Admin Password</p>
            <p className="text-[10px] text-gray-400">Change your login password</p>
          </div>
        </div>
        <button
          onClick={() => { setOpen(o => !o); setSuccess(false); }}
          className="text-xs font-black text-[#FA5600] hover:text-[#E04A00] uppercase tracking-widest transition">
          {open ? 'Cancel' : 'Change'}
        </button>
      </div>

      {open && (
        <div className="px-5 py-5 bg-[#1A1A1A] space-y-3">
          <ChangePasswordForm
            onSuccess={() => { setSuccess(true); setTimeout(() => setOpen(false), 1800); }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}

      {!open && success && (
        <div className="px-5 py-3 bg-green-50 text-green-700 text-xs font-bold text-center">
          ✅ Password updated successfully
        </div>
      )}
    </div>
  );
}

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput]     = useState('');
  const [passwordError, setPasswordError]     = useState('');
  const [showLoginPw,   setShowLoginPw]       = useState(false);
  const [showChangePw,  setShowChangePw]      = useState(false);
  const [activeSection, setActiveSection]     = useState<Section>('dashboard');
  const [sidebarOpen,   setSidebarOpen]       = useState(false);
  const [idleWarning,   setIdleWarning]       = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_MS = 10 * 60 * 1000;
  const WARN_MS = 9  * 60 * 1000;

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    setIdleWarning(false);
    warnTimerRef.current = setTimeout(() => setIdleWarning(true), WARN_MS);
    idleTimerRef.current = setTimeout(() => {
      sessionStorage.removeItem(SESSION_KEY);
      setIsAuthenticated(false);
      setIdleWarning(false);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const events = ['mousemove','mousedown','keydown','touchstart','scroll','click'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };
  }, [isAuthenticated, resetIdleTimer]);

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(VISIBILITY_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    const defaults: Record<string, boolean> = {};
    ALL_MODULES.forEach(m => { defaults[m.id] = true; });
    return defaults;
  });

  const [promoLines,     setPromoLines]     = useState<PromoLine[]>([
    { text: '🔥 TAGS · Free Shipping on Orders Over ₹999 · Up to 90% Off Today!' },
    { text: '' }, { text: '' }, { text: '' }, { text: '' },
  ]);
  const [promoSaved,    setPromoSaved]    = useState(false);
  const [promoLoading,  setPromoLoading]  = useState(false);

  const [bannerSlides,  setBannerSlides]  = useState<BannerSlide[]>([
    { image: '', text: '', description: '' }, { image: '', text: '', description: '' },
    { image: '', text: '', description: '' }, { image: '', text: '', description: '' },
    { image: '', text: '', description: '' },
  ]);
  const [bannerSaved,     setBannerSaved]     = useState(false);
  const [bannerLoading,   setBannerLoading]   = useState(false);
  const [bannerUploading, setBannerUploading] = useState<number | null>(null);
  const bannerRefs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [categories,   setCategories]   = useState<any[]>([]);
  const [catSaving,    setCatSaving]    = useState<string | null>(null);
  const [catSaved,     setCatSaved]     = useState<string | null>(null);
  const [catUploading, setCatUploading] = useState<string | null>(null);
  const [catImages,    setCatImages]    = useState<Record<string, string>>({});
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [dashStats,     setDashStats]     = useState<any>(null);
  const [dashLoading,   setDashLoading]   = useState(true);
  const [shortage,      setShortage]      = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetch('/api/banner').then(r => r.json()).then(data => {
      if (data.promoLines && Array.isArray(data.promoLines)) {
        const lines = [...data.promoLines];
        while (lines.length < 5) lines.push({ text: '' });
        setPromoLines(lines.slice(0, 5));
      } else if (data.promoText) {
        setPromoLines(prev => { const n = [...prev]; n[0] = { text: data.promoText }; return n; });
      }
      if (data.bannerSlides && Array.isArray(data.bannerSlides)) {
        const slides = data.bannerSlides.map((s: any) => ({ image: s.image || '', text: s.text || '', description: s.description || '' }));
        while (slides.length < 5) slides.push({ image: '', text: '', description: '' });
        setBannerSlides(slides.slice(0, 5));
      } else if (data.bannerImage) {
        setBannerSlides(prev => { const n = [...prev]; n[0] = { image: data.bannerImage, text: data.bannerText || '', description: '' }; return n; });
      }
    }).catch(() => {});

    fetch('/api/categories').then(r => r.json()).then(data => {
      const main = Array.isArray(data) ? data.filter((c: any) => !c.parentId) : [];
      setCategories(main);
      const imgs: Record<string, string> = {};
      main.forEach((c: any) => { imgs[c._id] = c.image || ''; });
      setCatImages(imgs);
    }).catch(() => {});

    setDashLoading(true);
    Promise.all([
      fetch('/api/sales?period=month').then(r => r.json()).catch(() => ({})),
      fetch('/api/business?module=cashflow&period=month').then(r => r.json()).catch(() => ({})),
      fetch('/api/business?module=reports&type=stock-shortage').then(r => r.json()).catch(() => []),
      fetch('/api/customers').then(r => r.json()).catch(() => ({})),
      fetch('/api/inventory').then(r => r.json()).catch(() => []),
      fetch('/api/sales?status=pending').then(r => r.json()).catch(() => ({})),
    ]).then(([sales, cash, stockShortage, customers, inventory, pendingSales]) => {
      const invArr = Array.isArray(inventory) ? inventory : [];
      setDashStats({
        revenue:       sales?.summary?.totalRevenue  || 0,
        orders:        sales?.summary?.totalOrders   || 0,
        profit:        cash?.summary?.profit         || 0,
        expense:       cash?.summary?.expense        || 0,
        customers:     customers?.summary?.totalCustomers || 0,
        totalProducts: invArr.length,
        inStock:       invArr.filter((p: any) =>  p.stock?.trackInventory && p.stock?.isInStock).length,
        outOfStock:    invArr.filter((p: any) =>  p.stock?.trackInventory && !p.stock?.isInStock).length,
      });
      setShortage(Array.isArray(stockShortage) ? stockShortage.slice(0, 5) : []);
      const pending = Array.isArray(pendingSales?.sales) ? pendingSales.sales : [];
      setPendingOrders(pending.slice(0, 15));
    }).finally(() => setDashLoading(false));
  }, [isAuthenticated]);

  const toggleVisibility = (id: string) => {
    setVisibility(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const visibleModules = ALL_MODULES.filter(m => m.id === 'settings' || m.id === 'dashboard' || visibility[m.id] !== false);

  // ── Login: verify via /api/admin first, fall back to env var ─────────────
  const handlePasswordSubmit = async () => {
    try {
      const res  = await fetch(`/api/admin?action=check&password=${encodeURIComponent(passwordInput)}`);
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        setIsAuthenticated(true);
        setPasswordError('');
      } else {
        setPasswordError('Incorrect password.');
        setPasswordInput('');
      }
    } catch {
      // Fallback to env var if API unreachable
      if (passwordInput === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        setIsAuthenticated(true);
        setPasswordError('');
      } else {
        setPasswordError('Incorrect password.');
        setPasswordInput('');
      }
    }
  };

  const handleLock = () => { sessionStorage.removeItem(SESSION_KEY); setIsAuthenticated(false); };

  const uploadImage = async (file: File): Promise<string> => {
    const res  = await fetch('/api/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
    const data = await res.json();
    if (!data.url) throw new Error('Upload failed');
    return data.url;
  };

  const handleBannerImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBannerUploading(index);
    try { const url = await uploadImage(file); setBannerSlides(prev => { const n = [...prev]; n[index] = { ...n[index], image: url }; return n; }); }
    catch { alert('Image upload failed.'); } finally { setBannerUploading(null); }
  };

  const handleCatImageUpload = async (catId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCatUploading(catId);
    try { const url = await uploadImage(file); setCatImages(prev => ({ ...prev, [catId]: url })); }
    catch { alert('Image upload failed.'); } finally { setCatUploading(null); }
  };

  const handleSavePromo = async () => {
    setPromoLoading(true);
    try {
      const activeLines = promoLines.filter(l => l.text.trim());
      await fetch('/api/banner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoLines, promoText: activeLines[0]?.text || '', bannerSlides, bannerImage: bannerSlides[0]?.image || '', bannerText: bannerSlides[0]?.text || '' }) });
      setPromoSaved(true); setTimeout(() => setPromoSaved(false), 2500);
    } catch { alert('Failed to save.'); } finally { setPromoLoading(false); }
  };

  const handleSaveBanners = async () => {
    setBannerLoading(true);
    try {
      const activeLines = promoLines.filter(l => l.text.trim());
      await fetch('/api/banner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoLines, promoText: activeLines[0]?.text || '', bannerSlides, bannerImage: bannerSlides[0]?.image || '', bannerText: bannerSlides[0]?.text || '' }) });
      setBannerSaved(true); setTimeout(() => setBannerSaved(false), 2500);
    } catch { alert('Failed to save.'); } finally { setBannerLoading(false); }
  };

  const handleSaveCategoryImage = async (catId: string) => {
    setCatSaving(catId);
    try {
      await fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: catId, image: catImages[catId] }) });
      setCatSaved(catId); setTimeout(() => setCatSaved(null), 2500);
    } catch { alert('Failed to save.'); } finally { setCatSaving(null); }
  };

  const confirmOrder = async (id: string) => {
    await fetch('/api/sales', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'confirmed' }) });
    setPendingOrders(prev => prev.filter(o => o._id !== id));
  };

  // ── PASSWORD SCREEN ───────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] px-4">
        <div className="bg-[#1A1A1A] border border-white/10 p-10 rounded-2xl shadow-2xl w-full max-w-sm">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#FA5600] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
              <span className="text-white font-black text-2xl">T</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">TAGS Admin</h2>
            <p className="text-sm text-white/40 mt-1">
              {showChangePw ? 'Change your password' : 'Enter your password to continue'}
            </p>
          </div>

          {/* ── LOGIN FORM ── */}
          {!showChangePw && (
            <>
              <div className="relative mb-3">
                <input
                  type={showLoginPw ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                  placeholder="Password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pr-10 text-center text-white text-lg focus:ring-2 focus:ring-[#FA5600] focus:border-[#FA5600] outline-none placeholder-white/20 transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition">
                  {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordError && <p className="text-red-400 text-sm text-center mb-3">{passwordError}</p>}

              <button
                onClick={handlePasswordSubmit}
                className="w-full bg-[#FA5600] text-white font-black py-3 rounded-xl hover:bg-[#E04A00] transition uppercase tracking-widest mb-4">
                Enter
              </button>

              {/* Change password link */}
              <div className="text-center">
                <button
                  onClick={() => { setShowChangePw(true); setPasswordError(''); }}
                  className="text-xs text-white/30 hover:text-white/60 transition font-bold uppercase tracking-widest flex items-center gap-1.5 mx-auto">
                  <KeyRound className="w-3.5 h-3.5" />
                  Change Password
                </button>
              </div>
            </>
          )}

          {/* ── CHANGE PASSWORD FORM (on login screen) ── */}
          {showChangePw && (
            <>
              <ChangePasswordForm
                onSuccess={() => {
                  setTimeout(() => setShowChangePw(false), 1800);
                }}
                onCancel={() => setShowChangePw(false)}
              />
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowChangePw(false)}
                  className="text-xs text-white/30 hover:text-white/60 transition font-bold uppercase tracking-widest">
                  ← Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN LAYOUT ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F0F2F5] flex">

      {idleWarning && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-yellow-400 text-yellow-900 text-xs font-black uppercase tracking-widest px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
          <span>⚠️ You'll be logged out in 1 minute due to inactivity</span>
          <button onClick={resetIdleTimer} className="bg-yellow-900 text-yellow-100 px-3 py-1 rounded-lg hover:bg-yellow-800 transition">
            Stay Logged In
          </button>
        </div>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-[#1A1A1A] transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-60' : 'w-0 lg:w-16'} overflow-hidden`}>
        <div className="flex items-center gap-3 px-3 py-4 border-b border-white/10 shrink-0">
          <div className="w-10 h-10 bg-[#FA5600] rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
            <span className="text-white font-black text-lg">T</span>
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-white font-black text-sm uppercase tracking-widest whitespace-nowrap">TAGS</p>
              <p className="text-white/40 text-[10px] uppercase tracking-widest whitespace-nowrap">Admin Panel</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 space-y-1 px-2 overflow-y-auto">
          {visibleModules.map(item => {
            const isActive        = activeSection === item.id;
            const isPendingBadge  = item.id === 'business' && pendingOrders.length > 0;
            return (
              <button key={item.id}
                onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                title={!sidebarOpen ? item.label : ''}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all relative
                  ${isActive ? 'bg-[#FA5600] text-white shadow-lg shadow-orange-500/20' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}>
                <div className="relative shrink-0">
                  <item.icon className="w-5 h-5" />
                  {isPendingBadge && !sidebarOpen && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1A1A1A]" />
                  )}
                </div>
                {sidebarOpen && (
                  <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap flex-1 text-left">{item.label}</span>
                )}
                {sidebarOpen && isPendingBadge && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">{pendingOrders.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2 space-y-1 shrink-0">
          <a href="/" target="_blank"
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition-all">
            <Eye className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">View Site</span>}
          </a>
          <button onClick={handleLock}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-white/50 hover:bg-red-500/20 hover:text-red-400 transition-all">
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">Lock</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}>

        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition text-gray-600">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-black text-gray-900 uppercase tracking-widest">
              {ALL_MODULES.find(m => m.id === activeSection)?.label || 'Dashboard'}
            </h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest hidden sm:block">
              {ALL_MODULES.find(m => m.id === activeSection)?.desc}
            </p>
          </div>
          {pendingOrders.length > 0 && (
            <button onClick={() => setActiveSection('dashboard')}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs font-black px-3 py-1.5 rounded-xl hover:bg-red-100 transition">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {pendingOrders.length} Pending
            </button>
          )}
          <div className="w-8 h-8 bg-[#FA5600] rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs">T</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden">

          {/* ── DASHBOARD ── */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Welcome back 👋</h2>
                <p className="text-sm text-gray-400">Here's what's happening with TAGS this month</p>
              </div>

              {dashLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-24" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Revenue',    value: `₹${Number(dashStats?.revenue  || 0).toLocaleString('en-IN')}`, icon: TrendingUp,   color: 'bg-green-50 text-green-600',   border: 'border-green-100' },
                    { label: 'Orders',     value: String(dashStats?.orders  || 0),                                 icon: ShoppingBag,  color: 'bg-blue-50 text-blue-600',     border: 'border-blue-100' },
                    { label: 'Customers',  value: String(dashStats?.customers || 0),                               icon: Users,        color: 'bg-purple-50 text-purple-600', border: 'border-purple-100' },
                    { label: 'Net Profit', value: `₹${Number(dashStats?.profit   || 0).toLocaleString('en-IN')}`, icon: DollarSign,   color: 'bg-orange-50 text-[#FA5600]',  border: 'border-orange-100' },
                  ].map(card => (
                    <div key={card.label} className={`bg-white rounded-2xl p-5 border ${card.border} shadow-sm`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                        <card.icon className="w-5 h-5" />
                      </div>
                      <p className="text-2xl font-black text-gray-900">{card.value}</p>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{card.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Products', value: dashStats?.totalProducts || 0, icon: Package,       color: 'text-gray-600 bg-gray-100' },
                  { label: 'In Stock',        value: dashStats?.inStock       || 0, icon: Check,         color: 'text-green-600 bg-green-100' },
                  { label: 'Out of Stock',    value: dashStats?.outOfStock    || 0, icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                      <card.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-gray-900">{card.value}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{card.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 bg-orange-50 border-b border-orange-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#FA5600] rounded-full animate-pulse" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Pending Deliveries</h3>
                  </div>
                  {pendingOrders.length > 0 && (
                    <span className="bg-[#FA5600] text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                      {pendingOrders.length} orders
                    </span>
                  )}
                </div>

                {dashLoading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="font-black text-sm text-gray-400 uppercase tracking-widest">All orders delivered — nothing pending!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pendingOrders.map((order: any) => (
                      <div key={order._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-orange-50/50 transition">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 font-black text-[#FA5600] text-base">
                          {(order.customerName || 'W')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-gray-900">{order.customerName || 'Walk-in Customer'}</p>
                            <span className="text-[9px] bg-yellow-100 text-yellow-700 font-black uppercase px-1.5 py-0.5 rounded-full">Pending</span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {order.saleNumber} · {order.customerPhone || 'No phone'} · {new Date(order.date).toLocaleDateString('en-IN')}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {order.items?.slice(0, 3).map((item: any, i: number) => (
                              <span key={i} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                {item.productName} ×{item.quantity}
                              </span>
                            ))}
                            {order.items?.length > 3 && (
                              <span className="text-[9px] text-gray-400">+{order.items.length - 3} more</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="font-black text-sm text-[#FA5600]">₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}</p>
                          <div className="flex gap-1.5 justify-end">
                            {order.customerPhone && (
                              <a href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-[10px] bg-[#25D366] text-white font-black px-2 py-0.5 rounded-full hover:bg-[#20bd5a] transition">WA</a>
                            )}
                            <button onClick={() => confirmOrder(order._id)}
                              className="text-[10px] bg-green-500 text-white font-black px-2 py-0.5 rounded-full hover:bg-green-600 transition">✓ Done</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pendingOrders.length > 0 && (
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400">Mark as Done to remove from this list</p>
                    <button onClick={() => setActiveSection('business')}
                      className="text-xs text-[#FA5600] font-black uppercase tracking-widest hover:underline">View all in Business →</button>
                  </div>
                )}
              </div>

              {shortage.length > 0 && (
                <div className="bg-white rounded-2xl border border-yellow-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Low Stock Alerts</h3>
                    <span className="ml-auto bg-yellow-100 text-yellow-700 text-xs font-black px-2 py-0.5 rounded-full">{shortage.length}</span>
                  </div>
                  <div className="space-y-2">
                    {shortage.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl">
                        {item.image && <img src={item.image} alt={item.productName} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                          <p className="text-xs text-gray-400">{item.category}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black text-sm ${item.isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`}>{item.availableStock} left</p>
                          <p className="text-[10px] text-gray-400">min {item.lowStockAlert}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {visibleModules.filter(m => m.id !== 'dashboard' && m.id !== 'settings').map(item => (
                    <button key={item.id} onClick={() => setActiveSection(item.id)}
                      className="bg-white rounded-2xl p-4 border border-gray-200 hover:border-[#FA5600] hover:shadow-md transition-all text-left group">
                      <div className="w-10 h-10 bg-orange-50 group-hover:bg-[#FA5600] rounded-xl flex items-center justify-center mb-3 transition-colors">
                        <item.icon className="w-5 h-5 text-[#FA5600] group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-xs font-black text-gray-900 uppercase tracking-tight">{item.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── OFFER BAR ── */}
          {activeSection === 'promo' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <SectionHeader icon={Megaphone} title="Offer Bar" desc="Add up to 5 scrolling announcement lines" />
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
                {promoLines.map((line, i) => (
                  <div key={i}>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                      Line {i + 1} {i === 0 && <span className="text-[#FA5600]">*</span>}
                    </label>
                    <input type="text" value={line.text}
                      onChange={e => setPromoLines(prev => { const n = [...prev]; n[i] = { text: e.target.value }; return n; })}
                      placeholder={i === 0 ? '🔥 TAGS · Free Shipping...' : `Optional line ${i + 1}...`}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold focus:border-[#FA5600] outline-none transition" />
                  </div>
                ))}
                <div className="bg-[#FA5600] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-center rounded-xl">
                  {promoLines.filter(l => l.text.trim()).map((l, i, arr) => (
                    <span key={i}>{l.text}{i < arr.length - 1 ? '  ·  ' : ''}</span>
                  ))}
                </div>
                <SaveButton onClick={handleSavePromo} loading={promoLoading} saved={promoSaved} />
              </div>
            </div>
          )}

          {/* ── HERO BANNERS ── */}
          {activeSection === 'banner' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <SectionHeader icon={Image} title="Hero Banners" desc="Upload up to 5 banners — auto-rotate every 5 seconds" />
              {bannerSlides.map((slide, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
                    Banner {i + 1} {i === 0 && <span className="text-[#FA5600]">*</span>}
                  </p>
                  <div className="flex gap-4">
                    <div onClick={() => bannerRefs[i].current?.click()}
                      className="w-28 h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#FA5600] cursor-pointer flex items-center justify-center overflow-hidden shrink-0 transition bg-gray-50">
                      {bannerUploading === i
                        ? <p className="text-[10px] text-gray-400 font-bold">Uploading...</p>
                        : slide.image
                          ? <img src={slide.image} alt="" className="w-full h-full object-cover" />
                          : <div className="text-center"><Upload className="w-5 h-5 text-gray-300 mx-auto mb-1" /><p className="text-[9px] text-gray-400 font-bold uppercase">Upload</p></div>}
                      <input ref={bannerRefs[i]} type="file" accept="image/png,image/jpeg,image/webp"
                        onChange={e => handleBannerImageUpload(i, e)} className="hidden" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <input type="text" value={slide.text}
                        onChange={e => setBannerSlides(prev => { const n = [...prev]; n[i] = { ...n[i], text: e.target.value }; return n; })}
                        placeholder="Overlay Heading"
                        className="w-full border-2 border-gray-200 rounded-xl p-2.5 font-bold focus:border-[#FA5600] outline-none text-sm" />
                      <input type="text" value={slide.description}
                        onChange={e => setBannerSlides(prev => { const n = [...prev]; n[i] = { ...n[i], description: e.target.value }; return n; })}
                        placeholder="Description text"
                        className="w-full border-2 border-gray-200 rounded-xl p-2.5 font-bold focus:border-[#FA5600] outline-none text-sm" />
                      {slide.image && (
                        <button onClick={() => setBannerSlides(prev => { const n = [...prev]; n[i] = { image: '', text: '', description: '' }; return n; })}
                          className="text-xs text-red-400 hover:text-red-600 font-bold flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {slide.image && (
                    <div className="mt-3 relative h-20 rounded-xl overflow-hidden border border-gray-200">
                      <img src={slide.image} alt="preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center px-4">
                        {slide.text && <p className="text-white font-black text-xs uppercase text-center">{slide.text}</p>}
                        {slide.description && <p className="text-white/80 text-[10px] text-center mt-1">{slide.description}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <SaveButton onClick={handleSaveBanners} loading={bannerLoading} saved={bannerSaved} />
            </div>
          )}

          {activeSection === 'products'   && <div className="max-w-5xl mx-auto"><SectionHeader icon={Package}    title="Products"   desc="Browse, filter & edit all your products" /><ProductManagerEmbed /></div>}
          {activeSection === 'categories' && <div className="max-w-2xl mx-auto"><SectionHeader icon={FolderTree} title="Categories" desc="Add, edit or delete categories and subcategories" /><ManageCategoriesEmbed /></div>}
          {activeSection === 'inventory'  && <div className="max-w-5xl mx-auto"><SectionHeader icon={ShoppingBag} title="Inventory" desc="Track stock levels" /><InventoryEmbed /></div>}
          {activeSection === 'business'   && <div className="max-w-5xl mx-auto"><SectionHeader icon={BarChart2}  title="Business"   desc="Sales, PO, Cash Flow, Reports" /><BusinessEmbed /></div>}
          {activeSection === 'import'     && <div className="max-w-2xl mx-auto"><ImportProductsSection /></div>}

          {/* ── CATEGORY IMAGES ── */}
          {activeSection === 'category-images' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <SectionHeader icon={Tag} title="Category Images" desc="Upload a cover image for each category" />
              {categories.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm shadow-sm">No categories found. Add some first!</div>
              )}
              {categories.map(cat => (
                <div key={cat._id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-700 mb-3">{cat.name}</p>
                  <div className="flex items-center gap-4">
                    <div onClick={() => catRefs.current[cat._id]?.click()}
                      className="w-20 h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#FA5600] cursor-pointer flex items-center justify-center overflow-hidden shrink-0 transition bg-gray-50">
                      {catUploading === cat._id
                        ? <p className="text-[9px] text-gray-400 font-bold">...</p>
                        : catImages[cat._id]
                          ? <img src={catImages[cat._id]} alt={cat.name} className="w-full h-full object-cover" />
                          : <div className="text-center"><Upload className="w-4 h-4 text-gray-300 mx-auto mb-0.5" /><p className="text-[9px] text-gray-400 font-bold uppercase">Upload</p></div>}
                      <input ref={el => { catRefs.current[cat._id] = el; }} type="file" accept="image/png,image/jpeg,image/webp"
                        onChange={e => handleCatImageUpload(cat._id, e)} className="hidden" />
                    </div>
                    <div className="flex-1">
                      <input type="text" value={catImages[cat._id] || ''}
                        onChange={e => setCatImages(prev => ({ ...prev, [cat._id]: e.target.value }))}
                        placeholder="Or paste image URL"
                        className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:border-[#FA5600] outline-none" />
                    </div>
                    <button onClick={() => handleSaveCategoryImage(cat._id)} disabled={catSaving === cat._id}
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition ${catSaved === cat._id ? 'bg-green-500 text-white' : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'} disabled:opacity-60`}>
                      {catSaved === cat._id ? '✓' : catSaving === cat._id ? '...' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeSection === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <SectionHeader icon={SettingsIcon} title="Settings" desc="Configure modules and security" />

              {/* ── Change Password card ── */}
              <ChangePasswordCard />

              {/* ── Module Visibility ── */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 pb-3 border-b border-gray-100">Module Visibility</p>
                <div className="space-y-3">
                  {ALL_MODULES.filter(m => m.id !== 'dashboard' && m.id !== 'settings').map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${visibility[item.id] !== false ? 'bg-orange-50' : 'bg-gray-100'}`}>
                          <item.icon className={`w-4 h-4 ${visibility[item.id] !== false ? 'text-[#FA5600]' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-black uppercase tracking-tight ${visibility[item.id] !== false ? 'text-gray-900' : 'text-gray-400'}`}>{item.label}</p>
                          <p className="text-[10px] text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleVisibility(item.id)}
                        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${visibility[item.id] !== false ? 'bg-[#FA5600]' : 'bg-gray-200'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${visibility[item.id] !== false ? 'left-6' : 'left-0.5'}`} />
                      </button>
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 pt-3 border-t border-gray-100">
                    Dashboard and Settings are always visible. Changes save automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0 border border-orange-100">
        <Icon className="w-6 h-6 text-[#FA5600]" />
      </div>
      <div>
        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{title}</h2>
        <p className="text-sm text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition shadow-sm ${saved ? 'bg-green-500 text-white' : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'} disabled:opacity-60`}>
      {saved ? <><Check className="w-4 h-4" /> Saved!</> : loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
    </button>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ImportProductsSection() {
  const [status,   setStatus]   = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results,  setResults]  = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [preview,  setPreview]  = useState<any[]>([]);
  const [message,  setMessage]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const CSV_COLUMNS = ['name','category','subcategory','originalPrice','discountedPrice','description','videoUrl','imageUrl'];

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values: string[] = [];
      let cur = ''; let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      values.push(cur.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/"/g, ''); });
      return obj;
    }).filter(row => row.name?.trim());
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setStatus('idle'); setMessage(''); setPreview([]); setResults([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target?.result as string);
        if (rows.length === 0) { setMessage('❌ No valid rows found. Check your CSV has a "name" column.'); return; }
        setPreview(rows.slice(0, 5));
        setMessage(`✅ ${rows.length} products ready to import. Preview shows first 5.`);
      } catch { setMessage('❌ Could not parse CSV. Please check the format.'); }
    };
    reader.readAsText(file);
  };

  const saveProduct = async (row: Record<string, string>) => {
    const imageUrls: string[] = [];
    if (row.imageUrl?.trim()) imageUrls.push(row.imageUrl.trim());
    const payload = { name: row.name || '', category: row.category || '', subcategory: row.subcategory || '', originalPrice: row.originalPrice || '', discountedPrice: row.discountedPrice || '', description: row.description || '', videoUrl: row.videoUrl || '', imageUrl: imageUrls[0] || '', image: imageUrls[0] || '', imageUrls };
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]; if (!file) return;
    const rows = parseCSV(await file.text());
    setStatus('loading'); setProgress({ current: 0, total: rows.length }); setResults([]); setMessage('');
    const newResults: { name: string; ok: boolean; error?: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      try { await saveProduct(rows[i]); newResults.push({ name: rows[i].name, ok: true }); }
      catch (err: any) { newResults.push({ name: rows[i].name, ok: false, error: err.message }); }
      setProgress({ current: i + 1, total: rows.length });
      setResults([...newResults]);
    }
    const failed = newResults.filter(r => !r.ok).length;
    setStatus(failed === 0 ? 'success' : 'error');
    setMessage(failed === 0 ? `✅ All ${rows.length} products imported successfully!` : `⚠️ ${rows.length - failed} imported, ${failed} failed.`);
    if (fileRef.current) fileRef.current.value = '';
    setPreview([]);
  };

  const downloadTemplate = () => {
    const header   = CSV_COLUMNS.join(',');
    const example1 = 'RC Car,Toys,R.C Toys,2599,1999,Fast and fun RC car,,https://your-image-url.com/rc-car.jpg';
    const example2 = 'Camping Tent,Adventure Gears,Camping,8999,,Waterproof 2-person tent,,https://your-image-url.com/tent.jpg';
    const csv  = `${header}\n${example1}\n${example2}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tags-products-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SectionHeader icon={Upload} title="Import Products" desc="Bulk import via CSV — syncs to FB Shop & WhatsApp automatically" />
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0"><Upload className="w-5 h-5 text-blue-600" /></div>
        <div className="flex-1"><p className="text-sm font-black text-gray-800">Download CSV Template</p><p className="text-xs text-gray-500">Fill in this template and upload it below</p></div>
        <button onClick={downloadTemplate} className="shrink-0 bg-blue-600 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-blue-700 transition uppercase tracking-widest">Download</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">CSV Columns</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { col: 'name',           note: 'Required',                          req: true },
            { col: 'category',       note: 'Required — must match your categories', req: true },
            { col: 'subcategory',    note: 'Optional' },
            { col: 'originalPrice',  note: 'Required — numbers only',           req: true },
            { col: 'discountedPrice',note: 'Optional — sale price' },
            { col: 'description',    note: 'Optional' },
            { col: 'videoUrl',       note: 'Optional — YouTube/FB/IG/TikTok' },
            { col: 'imageUrl',       note: 'Optional — paste image URL' },
          ].map(({ col, note, req }) => (
            <div key={col} className="flex items-start gap-2 p-2 rounded-xl bg-gray-50">
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${req ? 'bg-orange-100 text-[#FA5600]' : 'bg-gray-200 text-gray-400'}`}>{req ? 'REQ' : 'OPT'}</span>
              <div><p className="text-xs font-black text-gray-800">{col}</p><p className="text-[10px] text-gray-400">{note}</p></div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-200 hover:border-[#FA5600] rounded-2xl p-10 text-center cursor-pointer transition group">
          <Upload className="w-10 h-10 text-gray-300 group-hover:text-[#FA5600] mx-auto mb-3 transition" />
          <p className="font-black text-sm text-gray-700 uppercase tracking-widest">Click to Upload CSV</p>
          <p className="text-xs text-gray-400 mt-1">Only .csv files supported</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>
        {message && <div className={`rounded-xl p-3 text-sm font-bold text-center ${status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : status === 'error' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{message}</div>}
        {status === 'loading' && (
          <div>
            <div className="flex justify-between text-xs font-black text-gray-500 mb-1"><span>Importing... {progress.current} / {progress.total}</span><span>{pct}%</span></div>
            <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-[#FA5600] h-3 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        {preview.length > 0 && status === 'idle' && (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-3 pt-2">Preview (first 5 rows)</p>
            <table className="w-full text-xs mt-1">
              <thead><tr className="bg-gray-50">{Object.keys(preview[0]).map(h => <th key={h} className="text-left px-3 py-2 font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">{preview.map((row, i) => <tr key={i} className="hover:bg-gray-50">{Object.values(row).map((val: any, j) => <td key={j} className="px-3 py-2 text-gray-600 truncate max-w-[100px]">{val}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {results.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                <span>{r.ok ? '✅' : '❌'}</span><span className="flex-1 truncate">{r.name}</span>
                {r.error && <span className="text-[10px] opacity-70">{r.error}</span>}
              </div>
            ))}
          </div>
        )}
        {preview.length > 0 && status === 'idle' && (
          <button onClick={handleImport} className="w-full py-3 bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#E04A00] transition flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" /> Import All Products
          </button>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
