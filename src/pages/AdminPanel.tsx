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
  KeyRound, EyeOff, MessageSquare, Pencil,
} from 'lucide-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';
const SESSION_KEY    = 'adminAuth';
const VISIBILITY_KEY = 'tagsAdminVisibility';

type Section =
  | 'dashboard' | 'promo' | 'banner' | 'category-images' | 'perks'
  | 'products' | 'categories' | 'inventory' | 'business' | 'settings' | 'import' | 'reviews' | 'customers';

interface BannerSlide { image: string; text: string; description: string; }
interface Perk        { icon: string; text: string; }
interface PromoLine   { text: string; }

const ALL_MODULES: { id: Section; label: string; icon: any; desc: string }[] = [
  { id: 'dashboard',       label: 'Dashboard',       icon: LayoutDashboard, desc: 'Overview & quick stats' },
  { id: 'business',        label: 'Business',         icon: BarChart2,       desc: 'Sales, PO, Cash Flow, Reports' },
  { id: 'inventory',       label: 'Inventory',        icon: ShoppingBag,     desc: 'Stock management' },
  { id: 'customers',       label: 'Customers',        icon: Users,           desc: 'Customer list & order history' },
  { id: 'products',        label: 'Products',         icon: Package,         desc: 'Add & edit products' },
  { id: 'categories',      label: 'Categories',       icon: FolderTree,      desc: 'Manage categories' },
  { id: 'category-images', label: 'Category Images',  icon: Tag,             desc: 'Upload category covers' },
  { id: 'banner',          label: 'Hero Banners',     icon: Image,           desc: 'Homepage banners' },
  { id: 'promo',           label: 'Offer Bar',        icon: Megaphone,       desc: 'Scrolling announcements' },
  { id: 'perks',           label: 'Product Perks',    icon: Tag,             desc: 'Trust badges on product pages' },
  { id: 'import',          label: 'Import Products',  icon: Upload,          desc: 'Bulk import via CSV' },
  { id: 'reviews',         label: 'Reviews',          icon: MessageSquare,   desc: 'Manage customer reviews' },
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

  const DEFAULT_PERKS = [
    { icon: '🚚', text: 'Free Shipping' },
    { icon: '✅', text: 'Secure Payments' },
    { icon: '🔁', text: 'Easy Returns' },
  ];
  const [perks,        setPerks]        = useState<Perk[]>(DEFAULT_PERKS);
  const [perksSaved,   setPerksSaved]   = useState(false);
  const [perksLoading, setPerksLoading] = useState(false);

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

  // Collector cash balances
  const [collectorBalances, setCollectorBalances] = useState<any[]>([]);

  // Cash handover modal
  const [handoverModal, setHandoverModal] = useState<{
    open: boolean;
    collector: any | null;
    amount: string;
    submitting: boolean;
  }>({ open: false, collector: null, amount: '', submitting: false });

  // Payment collection modal
  const [payModal, setPayModal] = useState<{
    open: boolean;
    order: any | null;
    paymentMode: 'cash' | 'upi' | 'already_paid';
    amountCollected: string;
    collectedBy: 'owner' | 'delivery_boy' | 'third_party';
    collectorName: string;
    submitting: boolean;
  }>({
    open: false, order: null,
    paymentMode: 'cash', amountCollected: '',
    collectedBy: 'owner', collectorName: '',
    submitting: false,
  });

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
      if (data.perks && Array.isArray(data.perks) && data.perks.length === 3) {
        setPerks(data.perks);
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
      fetch('/api/customers?module=orders').then(r => r.json()).catch(() => ({})),
    ]).then(([sales, cash, stockShortage, customers, inventory, pendingSales, ordersData]) => {
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
      // Pending sales (not yet confirmed) + confirmed orders (confirmed but not delivered)
      const pendingSalesArr = Array.isArray(pendingSales?.sales) ? pendingSales.sales : [];
      const confirmedOrders = (ordersData?.orders || [])
        .filter((o: any) => o.status === 'confirmed')
        .map((o: any) => ({
          _id: o._id,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          orderId: o.orderId,
          totalAmount: o.totalAmount,
          date: o.createdAt,
          status: o.status,
          deliveryDate: o.deliveryDate,
          items: o.items,
          saleNumber: o.orderId,
          paymentStatus: o.paymentStatus,
        }));
      // Merge: confirmed orders first (they need delivery), then pending sales
      const pending = [...confirmedOrders, ...pendingSalesArr];
      setPendingOrders(pending.slice(0, 15));
    }).finally(() => {
      setDashLoading(false);
      fetchCollectorBalances();
    });
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

  const handleSavePerks = async () => {
    setPerksLoading(true);
    try {
      const activeLines = promoLines.filter(l => l.text.trim());
      await fetch('/api/banner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoLines, promoText: activeLines[0]?.text || '', bannerSlides, bannerImage: bannerSlides[0]?.image || '', bannerText: bannerSlides[0]?.text || '', perks }) });
      setPerksSaved(true); setTimeout(() => setPerksSaved(false), 2500);
    } catch { alert('Failed to save perks.'); } finally { setPerksLoading(false); }
  };

  const handleSavePromo = async () => {
    setPromoLoading(true);
    try {
      const activeLines = promoLines.filter(l => l.text.trim());
      await fetch('/api/banner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoLines, promoText: activeLines[0]?.text || '', bannerSlides, bannerImage: bannerSlides[0]?.image || '', bannerText: bannerSlides[0]?.text || '', perks }) });
      setPromoSaved(true); setTimeout(() => setPromoSaved(false), 2500);
    } catch { alert('Failed to save.'); } finally { setPromoLoading(false); }
  };

  const handleSaveBanners = async () => {
    setBannerLoading(true);
    try {
      const activeLines = promoLines.filter(l => l.text.trim());
      await fetch('/api/banner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoLines, promoText: activeLines[0]?.text || '', bannerSlides, bannerImage: bannerSlides[0]?.image || '', bannerText: bannerSlides[0]?.text || '', perks }) });
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

  const fetchCollectorBalances = async () => {
    try {
      const data = await fetch('/api/cashflow?collectorBalances=true').then(r => r.json());
      setCollectorBalances(Array.isArray(data) ? data : []);
    } catch {}
  };

  const openPayModal = (order: any) => {
    setPayModal({
      open: true, order,
      paymentMode: order.paymentStatus === 'paid' ? 'already_paid' : 'cash',
      amountCollected: String(order.balanceDue > 0 ? order.balanceDue : order.totalAmount || ''),
      collectedBy: 'owner', collectorName: '',
      submitting: false,
    });
  };

  const handleDelivered = async () => {
    const { order, paymentMode, amountCollected, collectedBy, collectorName } = payModal;
    if (!order) return;
    if (paymentMode !== 'already_paid' && (!amountCollected || isNaN(Number(amountCollected)) || Number(amountCollected) <= 0)) {
      alert('Please enter a valid amount collected.'); return;
    }
    if ((collectedBy === 'delivery_boy' || collectedBy === 'third_party') && !collectorName.trim()) {
      alert('Please enter the collector\'s name.'); return;
    }
    setPayModal(p => ({ ...p, submitting: true }));
    try {
      // 1. Mark order as delivered
      await fetch('/api/customers?module=orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order._id, status: 'delivered',
          paymentMode, amountCollected: Number(amountCollected) || 0,
          collectedBy, collectorName,
        }),
      });

      // 2. Post to cashflow if money was collected now
      if (paymentMode !== 'already_paid') {
        await fetch('/api/cashflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'income',
            category: 'delivery_collection',
            amount: Number(amountCollected),
            description: `COD collected – ${order.customerName} (${order.orderId || order.saleNumber})`,
            paymentMode,
            referenceId: order._id,
            referenceType: 'order',
            collectedBy,
            collectorName: collectorName || null,
            orderId: order.orderId || order.saleNumber,
            date: new Date().toISOString(),
          }),
        });
      }

      setPendingOrders(prev => prev.filter(o => o._id !== order._id));
      setPayModal(p => ({ ...p, open: false, order: null, submitting: false }));
      fetchCollectorBalances();
    } catch {
      setPayModal(p => ({ ...p, submitting: false }));
      alert('Something went wrong. Please try again.');
    }
  };

  const handleHandover = async () => {
    const { collector, amount } = handoverModal;
    if (!collector) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Please enter a valid amount.'); return;
    }
    if (Number(amount) > collector.balance) {
      alert(`Cannot hand over more than the balance of ₹${collector.balance.toLocaleString('en-IN')}.`); return;
    }
    setHandoverModal(p => ({ ...p, submitting: true }));
    try {
      await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transfer',
          category: 'cash_handover',
          amount: Number(amount),
          description: `Cash handover – ${collector.collectorName || collector.collectedBy} → Owner`,
          paymentMode: 'cash',
          collectedBy: collector.collectedBy,
          collectorName: collector.collectorName || null,
          handoverTo: 'owner',
          date: new Date().toISOString(),
        }),
      });
      setHandoverModal({ open: false, collector: null, amount: '', submitting: false });
      fetchCollectorBalances();
    } catch {
      setHandoverModal(p => ({ ...p, submitting: false }));
      alert('Something went wrong. Please try again.');
    }
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
      <aside className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-[#1A1A1A] transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-60' : 'w-0 lg:w-[72px]'} overflow-hidden`}>
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

        <nav className="flex-1 py-2 space-y-0.5 px-1.5 overflow-y-auto">
          {visibleModules.map(item => {
            const isActive       = activeSection === item.id;
            const isPendingBadge = item.id === 'business' && pendingOrders.length > 0;
            // Short 4-6 char label for collapsed mode
            const shortLabel: Record<string, string> = {
              dashboard: 'Home', business: 'Biz', inventory: 'Stock',
              products: 'Items', categories: 'Cats', 'category-images': 'Imgs',
              banner: 'Banner', promo: 'Offer', perks: 'Perks',
              import: 'Import', settings: 'Config', reviews: 'Revs',
            };
            return (
              <button key={item.id}
                onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                className={`w-full rounded-xl transition-all relative
                  ${sidebarOpen ? 'flex items-center gap-3 px-2.5 py-2.5' : 'flex flex-col items-center justify-center py-2 px-1'}
                  ${isActive ? 'bg-[#FA5600] text-white shadow-lg shadow-orange-500/20' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}>
                <div className="relative shrink-0">
                  <item.icon className={sidebarOpen ? 'w-5 h-5' : 'w-4 h-4'} />
                  {isPendingBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#1A1A1A]" />
                  )}
                </div>
                {sidebarOpen ? (
                  <>
                    <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap flex-1 text-left">{item.label}</span>
                    {isPendingBadge && (
                      <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">{pendingOrders.length}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[8px] font-black uppercase tracking-wide leading-none mt-1 whitespace-nowrap">
                    {shortLabel[item.id] || item.label.slice(0, 5)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-1.5 space-y-0.5 shrink-0">
          <a href="/" target="_blank"
            className={`w-full rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition-all
              ${sidebarOpen ? 'flex items-center gap-3 px-2.5 py-2.5' : 'flex flex-col items-center justify-center py-2 px-1'}`}>
            <Eye className={sidebarOpen ? 'w-5 h-5 shrink-0' : 'w-4 h-4'} />
            {sidebarOpen
              ? <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">View Site</span>
              : <span className="text-[8px] font-black uppercase tracking-wide mt-1">Site</span>
            }
          </a>
          <button onClick={handleLock}
            className={`w-full rounded-xl text-white/50 hover:bg-red-500/20 hover:text-red-400 transition-all
              ${sidebarOpen ? 'flex items-center gap-3 px-2.5 py-2.5' : 'flex flex-col items-center justify-center py-2 px-1'}`}>
            <LogOut className={sidebarOpen ? 'w-5 h-5 shrink-0' : 'w-4 h-4'} />
            {sidebarOpen
              ? <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">Lock</span>
              : <span className="text-[8px] font-black uppercase tracking-wide mt-1">Lock</span>
            }
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-[72px]'}`}>

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
                            {order.status === 'confirmed'
                              ? <span className="text-[9px] bg-blue-100 text-blue-700 font-black uppercase px-1.5 py-0.5 rounded-full">Confirmed</span>
                              : <span className="text-[9px] bg-yellow-100 text-yellow-700 font-black uppercase px-1.5 py-0.5 rounded-full">Pending</span>
                            }
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {order.saleNumber} · {order.customerPhone || 'No phone'} · {new Date(order.date).toLocaleDateString('en-IN')}
                          </p>
                          {order.deliveryDate && (
                            <p className="text-[10px] text-blue-500 font-bold mt-0.5">
                              Delivery: {new Date(order.deliveryDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                          )}
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
                              <a
                                href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                  `Hello ${order.customerName}! 👋\n\nYour order *${order.orderId || order.saleNumber}* is out for delivery and will reach you shortly.\n\n*Amount to collect:* ₹${Number(order.balanceDue > 0 ? order.balanceDue : order.totalAmount || 0).toLocaleString('en-IN')}\n\nPlease keep the amount ready. Thank you for shopping with TAGS! 🙏`
                                )}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-[10px] bg-[#25D366] text-white font-black px-2 py-0.5 rounded-full hover:bg-[#20bd5a] transition">WA</a>
                            )}
                            <button onClick={() => openPayModal(order)}
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

              {/* ── CASH IN HAND ── */}
              {collectorBalances.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-green-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 bg-green-50 border-b border-green-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                      <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Cash in Hand</h3>
                    </div>
                    <span className="bg-green-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                      ₹{collectorBalances.reduce((s, c) => s + c.balance, 0).toLocaleString('en-IN')} total
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {collectorBalances.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0 font-black text-green-700 text-sm">
                          {c.collectedBy === 'owner' ? '🏠' : c.collectedBy === 'delivery_boy' ? '🛵' : '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-gray-900">
                            {c.collectorName || (c.collectedBy === 'owner' ? 'Owner' : c.collectedBy === 'delivery_boy' ? 'Delivery Boy' : 'Third Party')}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                            {c.collectedBy.replace('_', ' ')} · {c.count} collection{c.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <p className="font-black text-base text-green-600">₹{Number(c.balance).toLocaleString('en-IN')}</p>
                          {c.collectedBy !== 'owner' && c.balance > 0 && (
                            <button
                              onClick={() => setHandoverModal({ open: true, collector: c, amount: String(c.balance), submitting: false })}
                              className="text-[10px] bg-[#FA5600] text-white font-black px-2.5 py-1 rounded-full hover:bg-[#E04A00] transition whitespace-nowrap">
                              Hand Over →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

          {/* ── PRODUCT PERKS ── */}
          {activeSection === 'perks' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <SectionHeader icon={Tag} title="Product Perks" desc="Edit the 3 trust badges shown on every product page" />
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
                <p className="text-xs text-gray-400 font-bold">These 3 items appear on every product detail page. Use an emoji + short label.</p>
                {perks.map((perk, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="shrink-0">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Icon</label>
                      <input type="text" value={perk.icon}
                        onChange={e => setPerks(prev => { const n = [...prev]; n[i] = { ...n[i], icon: e.target.value }; return n; })}
                        maxLength={4}
                        className="w-16 text-center border-2 border-gray-200 rounded-xl p-2.5 text-xl font-bold focus:border-[#FA5600] outline-none transition"
                        placeholder="🚚" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Label</label>
                      <input type="text" value={perk.text}
                        onChange={e => setPerks(prev => { const n = [...prev]; n[i] = { ...n[i], text: e.target.value }; return n; })}
                        placeholder={['Free Shipping', 'Secure Payments', 'Easy Returns'][i]}
                        className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                    </div>
                  </div>
                ))}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Live Preview</p>
                  <div className="border border-[#25D366]/30 rounded-xl bg-[#25D366]/5 divide-x divide-[#25D366]/20 flex overflow-hidden">
                    {perks.map((perk, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 text-center">
                        <span className="text-lg leading-none">{perk.icon || '?'}</span>
                        <span className="text-[10px] font-black text-[#1a9e4f] uppercase tracking-wide leading-tight">{perk.text || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <SaveButton onClick={handleSavePerks} loading={perksLoading} saved={perksSaved} />
              </div>
            </div>
          )}

          {activeSection === 'products'   && <div className="max-w-5xl mx-auto"><SectionHeader icon={Package}    title="Products"   desc="Browse, filter & edit all your products" /><ProductManagerEmbed /></div>}
          {activeSection === 'categories' && <div className="max-w-2xl mx-auto"><SectionHeader icon={FolderTree} title="Categories" desc="Add, edit or delete categories and subcategories" /><ManageCategoriesEmbed /></div>}
          {activeSection === 'inventory'  && <div className="max-w-5xl mx-auto"><SectionHeader icon={ShoppingBag} title="Inventory" desc="Track stock levels" /><InventoryEmbed /></div>}
          {activeSection === 'business'   && <div className="max-w-5xl mx-auto"><SectionHeader icon={BarChart2}  title="Business"   desc="Sales, PO, Cash Flow, Reports" /><BusinessEmbed /></div>}
          {activeSection === 'import'     && <div className="max-w-2xl mx-auto"><ImportProductsSection /></div>}

          {/* ── REVIEWS ── */}
          {activeSection === 'reviews' && <div className="max-w-4xl mx-auto"><ReviewsSection /></div>}

          {/* ── CUSTOMERS ── */}
          {activeSection === 'customers' && <div className="max-w-5xl mx-auto"><CustomersSection /></div>}

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

      {/* ── CASH HANDOVER MODAL ──────────────────────────────────────────────── */}
      {handoverModal.open && handoverModal.collector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-gray-900 text-base uppercase tracking-widest">Cash Handover</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {handoverModal.collector.collectorName || handoverModal.collector.collectedBy.replace('_', ' ')} → Owner
                </p>
              </div>
              <button onClick={() => setHandoverModal(p => ({ ...p, open: false }))} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Current Balance</p>
              <p className="text-2xl font-black text-green-700">₹{Number(handoverModal.collector.balance).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-green-500 mt-0.5">from {handoverModal.collector.count} collection{handoverModal.collector.count !== 1 ? 's' : ''}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Amount Being Handed Over (₹)</p>
              <input
                type="number" min="0" max={handoverModal.collector.balance}
                value={handoverModal.amount}
                onChange={e => setHandoverModal(p => ({ ...p, amount: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none"
                placeholder="Enter amount"
              />
              <p className="text-[10px] text-gray-400">This will post a cash transfer entry and reduce their balance.</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setHandoverModal(p => ({ ...p, open: false }))}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500 hover:border-gray-300 transition">
                Cancel
              </button>
              <button onClick={handleHandover} disabled={handoverModal.submitting}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-xs font-black uppercase tracking-widest hover:bg-green-600 transition disabled:opacity-60">
                {handoverModal.submitting ? 'Saving...' : '✓ Confirm Handover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT COLLECTION MODAL ─────────────────────────────────────── */}
      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-gray-900 text-base uppercase tracking-widest">Mark as Delivered</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{payModal.order.customerName} · ₹{Number(payModal.order.totalAmount || 0).toLocaleString('en-IN')}</p>
              </div>
              <button onClick={() => setPayModal(p => ({ ...p, open: false }))} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment mode */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment Mode</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'cash',         label: '💵 Cash' },
                  { value: 'upi',          label: '📱 UPI' },
                  { value: 'already_paid', label: '✅ Pre-paid' },
                ] as const).map(opt => (
                  <button key={opt.value}
                    onClick={() => setPayModal(p => ({ ...p, paymentMode: opt.value }))}
                    className={`py-2 px-3 rounded-xl text-xs font-black border-2 transition ${payModal.paymentMode === opt.value ? 'border-[#FA5600] bg-orange-50 text-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount — only if not already paid */}
            {payModal.paymentMode !== 'already_paid' && (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Amount Collected (₹)</p>
                <input
                  type="number" min="0"
                  value={payModal.amountCollected}
                  onChange={e => setPayModal(p => ({ ...p, amountCollected: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none"
                  placeholder="Enter amount"
                />
              </div>
            )}

            {/* Collected by */}
            {payModal.paymentMode !== 'already_paid' && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Collected By</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'owner',         label: '🏠 Owner' },
                    { value: 'delivery_boy',  label: '🛵 Delivery' },
                    { value: 'third_party',   label: '📦 3rd Party' },
                  ] as const).map(opt => (
                    <button key={opt.value}
                      onClick={() => setPayModal(p => ({ ...p, collectedBy: opt.value }))}
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border-2 transition ${payModal.collectedBy === opt.value ? 'border-[#FA5600] bg-orange-50 text-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Collector name — only if not owner */}
                {(payModal.collectedBy === 'delivery_boy' || payModal.collectedBy === 'third_party') && (
                  <input
                    type="text"
                    value={payModal.collectorName}
                    onChange={e => setPayModal(p => ({ ...p, collectorName: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none mt-1"
                    placeholder={payModal.collectedBy === 'delivery_boy' ? "Delivery boy's name" : "Third party name"}
                  />
                )}
              </div>
            )}

            {/* Pre-paid note */}
            {payModal.paymentMode === 'already_paid' && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs font-bold text-green-700">
                ✅ This order was already paid online. No cash collection needed — will be marked delivered directly.
              </div>
            )}

            {/* Summary line */}
            {payModal.paymentMode !== 'already_paid' && payModal.amountCollected && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 text-xs font-black text-[#FA5600]">
                ₹{Number(payModal.amountCollected).toLocaleString('en-IN')} via {payModal.paymentMode.toUpperCase()} collected by {payModal.collectedBy === 'owner' ? 'Owner' : payModal.collectorName || '—'} → will post to Cash Flow
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setPayModal(p => ({ ...p, open: false }))}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500 hover:border-gray-300 transition">
                Cancel
              </button>
              <button onClick={handleDelivered} disabled={payModal.submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#FA5600] text-white text-xs font-black uppercase tracking-widest hover:bg-[#E04A00] transition disabled:opacity-60">
                {payModal.submitting ? 'Saving...' : '✓ Confirm Delivery'}
              </button>
            </div>

          </div>
        </div>
      )}

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


// ── Reviews Section ───────────────────────────────────────────────────────────
function ReviewsSection() {
  const [reviews,       setReviews]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editName,      setEditName]      = useState('');
  const [editRating,    setEditRating]    = useState(5);
  const [editComment,   setEditComment]   = useState('');
  const [saving,        setSaving]        = useState(false);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [filterProduct, setFilterProduct] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/reviews?all=true')
      .then(r => r.json())
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (review: any) => {
    setEditingId(review._id);
    setEditName(review.name);
    setEditRating(review.rating);
    setEditComment(review.comment);
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName, rating: editRating, comment: editComment }),
      });
      if (!res.ok) { alert('Failed to save.'); return; }
      setReviews(prev => prev.map(r => r._id === id
        ? { ...r, name: editName, rating: editRating, comment: editComment }
        : r
      ));
      setEditingId(null);
    } catch { alert('Network error.'); }
    finally { setSaving(false); }
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/reviews?id=${id}`, { method: 'DELETE' });
      setReviews(prev => prev.filter(r => r._id !== id));
    } catch { alert('Failed to delete.'); }
    finally { setDeletingId(null); }
  };

  const products = Array.from(new Set(reviews.map(r => r.productName).filter(Boolean)));
  const filtered = filterProduct
    ? reviews.filter(r => r.productName === filterProduct)
    : reviews;

  const inputCls = 'w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white';

  return (
    <div className="space-y-4">
      <SectionHeader icon={MessageSquare} title="Reviews" desc="View, edit or delete customer reviews" />

      {/* Filter bar */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Filter by product:</span>
          <button onClick={() => setFilterProduct('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${!filterProduct ? 'bg-[#FA5600] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All ({reviews.length})
          </button>
          {products.map(p => (
            <button key={p} onClick={() => setFilterProduct(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition truncate max-w-[180px] ${filterProduct === p ? 'bg-[#FA5600] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p} ({reviews.filter(r => r.productName === p).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#FA5600] rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-sm shadow-sm">
          No reviews yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <div key={review._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {editingId === review._id ? (
                /* ── Edit mode ── */
                <div className="p-5 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#FA5600]">Editing Review</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Name</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Rating</label>
                      <select value={editRating} onChange={e => setEditRating(Number(e.target.value))} className={inputCls}>
                        {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Comment</label>
                    <textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={3}
                      className={`${inputCls} resize-none`} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={cancelEdit}
                      className="flex-1 border-2 border-gray-200 text-gray-500 hover:border-gray-400 font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition">
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(review._id)} disabled={saving}
                      className="flex-1 bg-[#FA5600] text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest hover:bg-[#E04A00] transition disabled:opacity-60 flex items-center justify-center gap-2">
                      {saving ? 'Saving...' : <><Check className="w-3.5 h-3.5" /> Save</>}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="p-5 flex gap-4 items-start">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 text-white text-xs font-black">
                    {review.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-sm font-black text-gray-900">{review.name}</span>
                        {review.productName && (
                          <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">
                            {review.productName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => startEdit(review)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-[#FA5600] hover:text-white text-gray-500 rounded-lg transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteReview(review._id)} disabled={deletingId === review._id}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-red-500 hover:text-white text-gray-500 rounded-lg transition disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{review.comment}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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

// ── Customers Section ──────────────────────────────────────────────────────
function CustomersSection() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [summary, setSummary]     = useState<any>({});
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [orders, setOrders]       = useState<Record<string, any[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(data => {
        setCustomers(data.customers || []);
        setSummary(data.summary || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleCustomer = async (cid: string) => {
    if (expanded === cid) { setExpanded(null); return; }
    setExpanded(cid);
    if (orders[cid]) return; // already loaded
    setLoadingOrders(cid);
    try {
      const res = await fetch(`/api/customers?module=orders&customerId=${cid}`);
      const data = await res.json();
      setOrders(prev => ({ ...prev, [cid]: data.orders || [] }));
    } catch {}
    finally { setLoadingOrders(null); }
  };

  const filtered = customers.filter(c =>
    !search.trim() ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <SectionHeader icon={Users} title="Customers" desc="All registered customers with order history" />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Customers', value: summary.totalCustomers || 0,  color: 'text-purple-600 bg-purple-50' },
          { label: 'Repeat Buyers',   value: summary.repeatCustomers || 0, color: 'text-green-600 bg-green-50' },
          { label: 'Total Revenue',   value: `₹${Number(summary.totalRevenue || 0).toLocaleString('en-IN')}`, color: 'text-orange-600 bg-orange-50' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{c.value}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone or email..."
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#FA5600] outline-none transition"
        />
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-black text-sm uppercase tracking-widest">No customers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => {
            const isExpanded = expanded === c._id;
            const isRepeat   = c.totalOrders > 1;
            return (
              <div key={c._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Customer row */}
                <button
                  onClick={() => toggleCustomer(c._id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-orange-50/40 transition text-left"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 font-black text-[#FA5600] text-lg">
                    {(c.name || 'C')[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm text-gray-900">{c.name}</p>
                      {isRepeat && (
                        <span className="text-[9px] bg-green-100 text-green-700 font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                          ⭐ Repeat Buyer
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      📞 {c.phone}
                      {c.email && <span className="ml-2">✉️ {c.email}</span>}
                    </p>
                    {c.address && <p className="text-[10px] text-gray-400 truncate mt-0.5">📍 {c.address}</p>}
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="font-black text-sm text-[#FA5600]">₹{Number(c.totalSpend || 0).toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-gray-400">{c.totalOrders} order{c.totalOrders !== 1 ? 's' : ''}</p>
                    {c.lastOrderDate && (
                      <p className="text-[9px] text-gray-300">Last: {new Date(c.lastOrderDate).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>

                  {/* Expand arrow */}
                  <div className={`ml-2 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
                </button>

                {/* Order history (expanded) */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Order History</p>
                    {loadingOrders === c._id ? (
                      <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded-xl animate-pulse" />)}</div>
                    ) : (orders[c._id] || []).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No orders recorded yet</p>
                    ) : (
                      <div className="space-y-2">
                        {(orders[c._id] || []).map((order: any) => (
                          <div key={order._id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-gray-500 uppercase">{order.orderId}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                                  order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                  order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{order.status || 'pending'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-[#FA5600]">₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}</span>
                                <span className="text-[9px] text-gray-300">{new Date(order.createdAt).toLocaleDateString('en-IN')}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(order.items || []).slice(0, 4).map((item: any, i: number) => (
                                <span key={i} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                  {item.productName} ×{item.quantity}
                                </span>
                              ))}
                              {order.items?.length > 4 && (
                                <span className="text-[9px] text-gray-400">+{order.items.length - 4} more</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* WhatsApp quick link */}
                    {c.phone && (
                      <a
                        href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[#25D366] hover:underline"
                      >
                        💬 Message on WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
