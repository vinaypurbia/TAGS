import { StockVisibilityPanel } from '../components/StockVisibilityPanel';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProductManagerEmbed } from './ProductManagerEmbed';
import { ManageCategoriesEmbed } from './ManageCategoriesEmbed';
import { InventoryEmbed } from './InventoryEmbed';
import { BusinessEmbed } from './BusinessEmbed';
import {
  Lock, LogOut, Megaphone, Image, Tag, Package, FolderTree,
  Save, Check, Trash2, Eye, Upload, BarChart2,
  LayoutDashboard, ShoppingBag, Menu, X,
  TrendingUp, TrendingDown, Users, AlertTriangle, DollarSign,
  KeyRound, EyeOff, MessageSquare, Pencil, Database, Send, Radio, Copy,
} from 'lucide-react';

const VISIBILITY_KEY = 'tagsAdminVisibility';

type Section =
  | 'dashboard' | 'promo' | 'banner' | 'category-images' | 'perks'
  | 'products' | 'categories' | 'inventory' | 'business' | 'settings' | 'import' | 'reviews' | 'broadcast';

interface BannerSlide { image: string; text: string; description: string; }
interface Perk        { icon: string; text: string; }
interface PromoLine   { text: string; }

const ALL_MODULES: { id: Section; label: string; icon: any; desc: string }[] = [
  { id: 'dashboard',       label: 'Dashboard',       icon: LayoutDashboard, desc: 'Overview & quick stats' },
  { id: 'business',        label: 'Business',         icon: BarChart2,       desc: 'Sales, PO, Cash Flow, Reports' },
  { id: 'inventory',       label: 'Inventory',        icon: ShoppingBag,     desc: 'Stock management' },
  { id: 'broadcast',       label: 'Broadcast',        icon: Megaphone,       desc: 'Promote products on WhatsApp & Telegram' },
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
  // Auth comes entirely from AuthContext — no local password state
  const { user, token, isLoading: authLoading, logout, canAccessAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection]     = useState<Section>('dashboard');
  const [showInventory, setShowInventory]     = useState(true); // collapsible inventory panel
  const [showVisibility, setShowVisibility]   = useState(true); // collapsible visibility panel
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
      logout();
      setIdleWarning(false);
    }, IDLE_MS);
  }, [logout]);

  useEffect(() => {
    if (!canAccessAdmin) return;
    const events = ['mousemove','mousedown','keydown','touchstart','scroll','click'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };
  }, [canAccessAdmin, resetIdleTimer]);

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
  const [dashLoading,   setDashLoading]   = useState(false);
  const [dbStats,       setDbStats]       = useState<any>(null);
  const [dbLoading,     setDbLoading]     = useState(false);
  const [cloudStats,    setCloudStats]    = useState<any>(null);
  const [cloudLoading,  setCloudLoading]  = useState(true);
  // Storage popup state: null | 'mongo' | 'cloudinary'
  const [storagePopup,  setStoragePopup]  = useState<null | 'mongo' | 'cloudinary'>(null);
  const [shortage,      setShortage]      = useState<any[]>([]);
  const [showAllShortage, setShowAllShortage] = useState(false);
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
    if (!canAccessAdmin) return;

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

    // setDashLoading(true) removed — UI renders immediately, data fills in silently
    Promise.all([
      fetch('/api/sales?period=month').then(r => r.json()).catch(() => ({})),
      fetch('/api/business?module=cashflow&period=month').then(r => r.json()).catch(() => ({})),
      fetch('/api/business?module=reports&type=stock-shortage').then(r => r.json()).catch(() => []),
      fetch('/api/customers').then(r => r.json()).catch(() => ({})),
      fetch('/api/inventory').then(r => r.json()).catch(() => []),
      fetch('/api/sales?status=pending').then(r => r.json()).catch(() => ({})),
      fetch('/api/customers?module=orders').then(r => r.json()).catch(() => ({})),
    ]).then(([sales, cash, stockShortage, customers, inventory, pendingSales, ordersData]) => {
      const invArr = Array.isArray(inventory) ? inventory : (inventory?.inventory || inventory?.items || []);
      setDashStats({
        revenue:       sales?.summary?.totalRevenue  || 0,
        orders:        sales?.summary?.totalOrders   || 0,
        profit:        cash?.summary?.profit         || 0,
        expense:       cash?.summary?.expense        || 0,
        // customers API returns plain array (no module param)
        customers:     Array.isArray(customers) ? customers.length : (customers?.summary?.totalCustomers || customers?.length || 0),
        totalProducts: invArr.length,
        inStock:       invArr.filter((p: any) => (p.availableStock ?? p.stock?.availableStock ?? 0) > 0).length,
        outOfStock:    invArr.filter((p: any) => (p.availableStock ?? p.stock?.availableStock ?? 0) === 0).length,
      });
      setShortage(Array.isArray(stockShortage) ? stockShortage : []);
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
  }, [canAccessAdmin]);

  const toggleVisibility = (id: string) => {
    setVisibility(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const visibleModules = ALL_MODULES.filter(m => m.id === 'settings' || m.id === 'dashboard' || visibility[m.id] !== false);

  const handleLock = () => { logout(); };

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

  // Fetch MongoDB storage stats
  useEffect(() => {
    if (!canAccessAdmin) return;
    setDbLoading(true);
    fetch('/api/banner?module=dbstats')
      .then(r => r.json())
      .then(data => { if (!data.error) setDbStats(data); })
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, [canAccessAdmin]);

  // Fetch Cloudinary storage stats
  useEffect(() => {
    if (!canAccessAdmin) return;
    setCloudLoading(true);
    fetch('/api/banner?module=cloudinarystats')
      .then(r => r.json())
      .then(data => { if (!data.error) setCloudStats(data); })
      .catch(() => {})
      .finally(() => setCloudLoading(false));
  }, [canAccessAdmin]);

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

      // NOTE: cashflow delivery_collection entry is written by /api/customers?module=orders
      // when status is set to 'delivered' — no second write needed here.

      setPendingOrders(prev => prev.filter(o => o._id !== order._id));
      setPayModal(p => ({ ...p, open: false, order: null, submitting: false }));
      fetchCollectorBalances();

      // ── THANK YOU WHATSAPP MESSAGE ───────────────────────────
      if (order.customerPhone) {
        const customerName = order.customerName || 'there';
        const thankYouMsg =
          `Hi ${customerName} 👋\n\n` +
          `Thank you so much for your order with *TAGS*! 🎉\n\n` +
          `We're glad we could serve you and hope you love your purchase! 😊\n\n` +
          `Your satisfaction is our priority, and we truly look forward to serving you again soon. Your trust and support mean the world to us. 🙏\n\n` +
          `See you next time! ✨\n— Team TAGS`;
        const phone = order.customerPhone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(thankYouMsg)}`, '_blank');
      }
      // ── END THANK YOU MESSAGE ────────────────────────────────

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

  // ── OWNER DEPOSIT TO BANK ───────────────────────────────────────────────
  const handleOwnerDeposit = async (balance: number) => {
    if (!window.confirm(`Mark ₹${balance.toLocaleString('en-IN')} as deposited to bank / settled?`)) return;
    try {
      await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transfer',
          category: 'owner_deposit',
          amount: balance,
          description: 'Owner cash deposited to bank / settled',
          paymentMode: 'cash',
          collectedBy: 'owner',
          collectorName: null,
          handoverTo: 'bank',
          date: new Date().toISOString(),
        }),
      });
      fetchCollectorBalances();
    } catch {
      alert('Something went wrong. Please try again.');
    }
  };

  // ── AUTH GUARD ───────────────────────────────────────────────────────────
  // Read localStorage directly for instant check — avoids the React state
  // batching delay that causes a grey flash on fresh login before user state
  // has propagated to this component.
  const savedUser = (() => {
    try { return JSON.parse(localStorage.getItem('tags_user') || 'null'); } catch { return null; }
  })();
  const savedToken = localStorage.getItem('tags_token');
  const immediateCanAccess = savedUser?.role === 'admin' || savedUser?.role === 'manager';

  // Redirect in useEffect (never during render — that crashes React)
  useEffect(() => {
    if (!authLoading && !canAccessAdmin && !immediateCanAccess) {
      navigate('/login?redirect=/admin', { replace: true });
    }
  }, [authLoading, canAccessAdmin, immediateCanAccess, navigate]);

  // Block render only when we have absolutely no evidence of a valid session
  if (!immediateCanAccess && !canAccessAdmin) {
    // Still loading initial session from storage — show brief neutral screen
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F]">
          <div className="text-white/40 text-sm font-bold uppercase tracking-widest animate-pulse">Loading…</div>
        </div>
      );
    }
    // No valid session at all — redirect effect will fire
    return null;
  }

  // ── MAIN LAYOUT ───────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#F0F2F5] flex overflow-hidden">

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
              ? <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">Logout</span>
              : <span className="text-[8px] font-black uppercase tracking-wide mt-1">Out</span>
            }
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className={`flex-1 flex flex-col transition-all duration-300 overflow-y-auto ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-[72px]'}`}>

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
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Welcome back 👋</h2>
                  <p className="text-sm text-gray-400">Here's what's happening with TAGS this month</p>
                </div>
                {/* ── Compact storage badges top-right ── */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* MongoDB badge */}
                  <button
                    onClick={() => setStoragePopup('mongo')}
                    title="MongoDB Atlas Storage — click for details"
                    className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 hover:border-green-400 hover:bg-green-50 transition-all group shadow-sm"
                  >
                    <div className="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-green-200 transition">
                      <Database className="w-3 h-3 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none">MongoDB</p>
                      <p className="text-[10px] font-black text-gray-700 leading-tight">
                        {dbStats ? `${(dbStats.storageSizeMB || 0).toFixed(1)} MB` : '—'}
                      </p>
                    </div>
                    {dbStats && (() => {
                      const pct = Math.min(100, ((dbStats.storageSizeMB || 0) / 512) * 100);
                      return <div className={`w-1 h-4 rounded-full ml-0.5 ${pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-yellow-400' : 'bg-green-400'}`} />;
                    })()}
                  </button>
                  {/* Cloudinary badge */}
                  <button
                    onClick={() => setStoragePopup('cloudinary')}
                    title="Cloudinary Storage — click for details"
                    className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 hover:border-blue-400 hover:bg-blue-50 transition-all group shadow-sm"
                  >
                    <div className="w-5 h-5 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition">
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none">Cloudinary</p>
                      <p className="text-[10px] font-black text-gray-700 leading-tight">
                        {cloudStats ? `${(cloudStats.credits_usage_percent || 0).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    {cloudStats && (() => {
                      const pct = Math.min(100, cloudStats.credits_usage_percent || 0);
                      return <div className={`w-1 h-4 rounded-full ml-0.5 ${pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-yellow-400' : 'bg-blue-400'}`} />;
                    })()}
                  </button>
                </div>
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

              {/* Storage widgets moved to dashboard header as compact badges */}

              {/* ── Storage Detail Popup ── */}
              {storagePopup && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4" onClick={() => setStoragePopup(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

                    {/* MongoDB detail */}
                    {storagePopup === 'mongo' && (
                      <div>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                              <Database className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">MongoDB Atlas Storage</h3>
                              <p className="text-[10px] text-gray-400">Free tier · 512 MB limit</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => { setDbLoading(true); fetch('/api/banner?module=dbstats').then(r=>r.json()).then(d=>{if(!d.error)setDbStats(d)}).finally(()=>setDbLoading(false)); }}
                              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#FA5600] transition">Refresh</button>
                            <button onClick={() => setStoragePopup(null)} className="text-gray-400 hover:text-gray-600">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        {dbLoading ? (
                          <div className="p-6 space-y-3">
                            <div className="h-4 bg-gray-100 rounded-full animate-pulse" />
                            <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_,i)=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
                          </div>
                        ) : !dbStats ? (
                          <div className="p-8 text-center text-xs text-gray-400 font-bold uppercase tracking-widest">Stats unavailable</div>
                        ) : (
                          <div className="p-6 space-y-4">
                            {(() => {
                              const usedMB = dbStats.storageSizeMB || 0;
                              const limitMB = 512;
                              const pct = Math.min(100, (usedMB / limitMB) * 100);
                              const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-400' : 'bg-green-500';
                              return (
                                <div>
                                  <div className="flex justify-between text-xs font-black text-gray-700 mb-1.5">
                                    <span>{usedMB.toFixed(2)} MB used</span>
                                    <span className={pct > 80 ? 'text-red-500' : 'text-gray-400'}>{pct.toFixed(1)}% of 512 MB</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div className={`h-3 rounded-full transition-all ${color}`} style={{width: `${pct}%`}} />
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-1">{(limitMB - usedMB).toFixed(2)} MB remaining</p>
                                </div>
                              );
                            })()}
                            <div className="grid grid-cols-2 gap-3">
                              {(dbStats.collections || []).map((col: any) => (
                                <div key={col.name} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate">{col.name}</p>
                                  <p className="text-lg font-black text-gray-900 mt-1">{col.count.toLocaleString()}</p>
                                  <p className="text-[9px] text-gray-400">{col.sizeMB.toFixed(3)} MB</p>
                                </div>
                              ))}
                            </div>
                            {dbStats.storageSizeMB > 400 && (
                              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <p className="text-xs font-black text-red-600">Storage above 80% — consider cleaning old data or upgrading</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cloudinary detail */}
                    {storagePopup === 'cloudinary' && (
                      <div>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
                            </div>
                            <div>
                              <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Cloudinary Storage</h3>
                              <p className="text-[10px] text-gray-400">Free tier · 25 Credits</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => { setCloudLoading(true); fetch('/api/banner?module=cloudinarystats').then(r=>r.json()).then(d=>{if(!d.error)setCloudStats(d)}).finally(()=>setCloudLoading(false)); }}
                              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#FA5600] transition">Refresh</button>
                            <button onClick={() => setStoragePopup(null)} className="text-gray-400 hover:text-gray-600">
                              <X className="w-5 h-5" />
                          </button>
                          </div>
                        </div>
                        {cloudLoading ? (
                          <div className="p-6 space-y-3">
                            <div className="h-4 bg-gray-100 rounded-full animate-pulse" />
                            <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_,i)=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
                          </div>
                        ) : !cloudStats ? (
                          <div className="p-8 text-center text-xs text-gray-400 font-bold uppercase tracking-widest">Stats unavailable — add CLOUDINARY_URL to env vars</div>
                        ) : (
                          <div className="p-6 space-y-4">
                            {/* Credits bar */}
                            {(() => {
                              const pct = Math.min(100, cloudStats.credits_usage_percent || 0);
                              const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-400' : 'bg-blue-500';
                              return (
                                <div>
                                  <div className="flex justify-between text-xs font-black text-gray-700 mb-1.5">
                                    <span>{pct.toFixed(1)}% credits used</span>
                                    <span className={pct > 80 ? 'text-red-500' : 'text-gray-400'}>{cloudStats.credits_used?.toFixed(2) || 0} / {cloudStats.credits_limit || 25} credits</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div className={`h-3 rounded-full transition-all ${color}`} style={{width: `${pct}%`}} />
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-1">{((cloudStats.credits_limit || 25) - (cloudStats.credits_used || 0)).toFixed(2)} credits remaining</p>
                                </div>
                              );
                            })()}
                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { label: 'Storage Used',    value: `${(cloudStats.storage_used_mb || 0).toFixed(1)} MB`,    sub: `of ${cloudStats.storage_limit_mb || 0} MB` },
                                { label: 'Bandwidth Used',  value: `${(cloudStats.bandwidth_used_mb || 0).toFixed(1)} MB`,   sub: `of ${cloudStats.bandwidth_limit_mb || 0} MB` },
                                { label: 'Total Images',    value: (cloudStats.resources || 0).toLocaleString(),             sub: 'files stored' },
                                { label: 'Transformations', value: (cloudStats.transformations || 0).toLocaleString(),        sub: 'this month' },
                              ].map(s => (
                                <div key={s.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{s.label}</p>
                                  <p className="text-lg font-black text-gray-900 mt-1">{s.value}</p>
                                  <p className="text-[9px] text-gray-400">{s.sub}</p>
                                </div>
                              ))}
                            </div>
                            {(cloudStats.credits_usage_percent || 0) > 80 && (
                              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <p className="text-xs font-black text-red-600">Credits above 80% — consider upgrading your Cloudinary plan</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                          {c.collectedBy === 'owner' && c.balance > 0 && (
                            <button
                              onClick={() => handleOwnerDeposit(c.balance)}
                              className="text-[10px] bg-blue-600 text-white font-black px-2.5 py-1 rounded-full hover:bg-blue-700 transition whitespace-nowrap">
                              Deposit →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {shortage.length > 0 && (
                <div className="bg-white rounded-2xl border border-yellow-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-yellow-100">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Low Stock Alerts</h3>
                    <span className="ml-auto bg-yellow-100 text-yellow-700 text-xs font-black px-2 py-0.5 rounded-full">{shortage.length}</span>
                  </div>
                  {/* Scrollable list — fixed height so buttons always show below */}
                  <div className={`overflow-y-auto ${showAllShortage ? 'max-h-[600px]' : ''}`}>
                    <div className="space-y-2 p-5">
                      {(showAllShortage ? shortage : shortage.slice(0, 5)).map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl">
                          {item.image && <img src={item.image} alt={item.productName} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                            <p className="text-xs text-gray-400">{item.category}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-black text-sm ${item.isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`}>{item.availableStock} left</p>
                            <p className="text-[10px] text-gray-400">min {item.lowStockAlert || 5}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Always-visible footer buttons — outside the scroll area */}
                  <div className="border-t border-yellow-100 p-3 flex gap-2 bg-white">
                    {shortage.length > 5 && (
                      <button
                        onClick={() => setShowAllShortage(v => !v)}
                        className="flex-1 py-2 text-xs font-black uppercase tracking-widest text-yellow-600 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition"
                      >
                        {showAllShortage ? '▲ Show Less' : `▼ Show All ${shortage.length} Items`}
                      </button>
                    )}
                    <button
                      onClick={() => setActiveSection('inventory')}
                      className="flex-1 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border border-gray-200 rounded-xl hover:border-[#FA5600] hover:text-[#FA5600] transition"
                    >
                      → Go to Inventory
                    </button>
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
         {activeSection === 'inventory' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <SectionHeader icon={ShoppingBag} title="Inventory" desc="Track stock levels" />
              {/* ── Collapsible Inventory Panel ── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                {/* Sticky header — overflow-hidden removed so sticky works */}
                <div className="sticky top-0 z-20 bg-white flex items-center justify-between px-5 py-3 border-b border-gray-100 shadow-sm rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-gray-500" />
                    <span className="font-black text-sm uppercase tracking-widest text-gray-700">Stock Levels</span>
                    <span className="text-[10px] text-gray-400 font-bold hidden sm:block">Manage quantities, cost prices & SKUs</span>
                  </div>
                  <button onClick={() => setShowInventory(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition px-3 py-1.5 rounded-lg border ${showInventory ? 'text-gray-400 border-gray-200 hover:text-[#FA5600] hover:border-[#FA5600]' : 'text-white bg-[#FA5600] border-[#FA5600]'}`}>
                    {showInventory ? '▲ Hide' : '▼ Show'}
                  </button>
                </div>
                {showInventory && <div className="p-4"><InventoryEmbed /></div>}
              </div>
              {/* ── Collapsible Stock Visibility Panel ── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="sticky top-0 z-20 bg-white flex items-center justify-between px-5 py-3 border-b border-gray-100 shadow-sm rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-gray-500" />
                    <span className="font-black text-sm uppercase tracking-widest text-gray-700">Stock Visibility Control</span>
                    <span className="text-[10px] text-gray-400 font-bold hidden sm:block">Control what customers see for low & out-of-stock products</span>
                  </div>
                  <button onClick={() => setShowVisibility(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition px-3 py-1.5 rounded-lg border ${showVisibility ? 'text-gray-400 border-gray-200 hover:text-[#FA5600] hover:border-[#FA5600]' : 'text-white bg-[#FA5600] border-[#FA5600]'}`}>
                    {showVisibility ? '▲ Hide' : '▼ Show'}
                  </button>
                </div>
                {showVisibility && <div className="p-4"><StockVisibilityPanel /></div>}
              </div>
            </div>
          )}
          {activeSection === 'business'   && <div className="max-w-5xl mx-auto"><SectionHeader icon={BarChart2}  title="Business"   desc="Sales, PO, Cash Flow, Reports" /><BusinessEmbed /></div>}
          {activeSection === 'import'     && <div className="max-w-2xl mx-auto"><ImportProductsSection /></div>}

          {/* ── REVIEWS ── */}
          {activeSection === 'reviews' && <div className="max-w-4xl mx-auto"><ReviewsSection /></div>}

          {/* ── BROADCAST ── */}
          {activeSection === 'broadcast' && <div className="max-w-5xl mx-auto"><BroadcastSection /></div>}

          {/* ── removed: customers section now lives inside Business → Customers tab ── */}

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



// ── Broadcast Section ──────────────────────────────────────────────────────

// ── Broadcast Section ──────────────────────────────────────────────────────
function BroadcastSection() {
  const [products, setProducts]             = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priceMin, setPriceMin]             = useState('');
  const [priceMax, setPriceMax]             = useState('');
  const [stockFilter, setStockFilter]       = useState<'all'|'instock'|'outofstock'>('all');

  // Multi-select (Telegram batch)
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [sending, setSending]               = useState(false);
  const [progress, setProgress]             = useState<{current:number,total:number}|null>(null);
  const [doneCount, setDoneCount]           = useState(0);

  // Single-select (preview + WhatsApp/Copy)
  const [preview, setPreview]               = useState<any>(null);
  const [customMsg, setCustomMsg]           = useState('');
  const [copied, setCopied]                 = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [telegramSuccess, setTelegramSuccess] = useState(false);

  const categories = ['All', ...Array.from(new Set(products.map((p:any) => p.category || '').filter(Boolean))).sort()];

  useEffect(() => {
    fetch('/api/products?limit=200&adminView=true')
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const resolvePrice = (p: any) => {
    for (const v of [p.discountedPrice, p.price, p.originalPrice]) {
      if (v !== undefined && v !== null) {
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return 0;
  };

  const getStock = (p: any): number | null => {
    if (p.stock?.availableStock !== undefined) return p.stock.availableStock;
    if (p.stock?.available !== undefined) return p.stock.available;
    return null;
  };

  const getProductImages = (p: any): string[] => {
    const imgs: string[] = [];
    if (p.image) imgs.push(p.image);
    if (p.imageUrl && p.imageUrl !== p.image) imgs.push(p.imageUrl);
    if (Array.isArray(p.images)) p.images.forEach((img: string) => { if (img && !imgs.includes(img)) imgs.push(img); });
    return imgs;
  };

  const filtered = products.filter(p => {
    const price = resolvePrice(p);
    const stock = getStock(p);
    if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
    if (search.trim() && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (priceMin && price < parseFloat(priceMin)) return false;
    if (priceMax && price > parseFloat(priceMax)) return false;
    if (stockFilter === 'instock'    && stock !== null && stock <= 0) return false;
    if (stockFilter === 'outofstock' && stock !== null && stock > 0)  return false;
    return true;
  });

  const generateMessage = (p: any) => {
    const price     = resolvePrice(p);
    const origPrice = p.originalPrice ? parseFloat(String(p.originalPrice).replace(/[^0-9.]/g, '')) : 0;
    const discount  = origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0;
    const productUrl = `https://ta-gs.online/products/${p._id}`;
    let msg = '';
    msg += `🛍️ *${(p.name || '').toUpperCase()}*\n\n`;
    if (discount > 0) {
      msg += `💰 *Price: ₹${price.toFixed(0)}* ~~₹${origPrice.toFixed(0)}~~ — *Save ${discount}%!* 🔥\n\n`;
    } else {
      msg += `💰 *Price: ₹${price.toFixed(0)}*\n\n`;
    }
    if (p.description) msg += `📝 ${p.description.slice(0, 150)}${p.description.length > 150 ? '...' : ''}\n\n`;
    if (p.category) msg += `🏷️ Category: ${p.category}\n`;
    msg += `\n🔗 View Product:\n${productUrl}\n\n`;
    msg += `📞 To Order, WhatsApp us:\nwa.me/916350021226\n\n`;
    msg += `✨ *TAGS — Toys · Adventure · Gadgets · Sports*\n`;
    msg += `📍 Hathipole, Udaipur`;
    return msg;
  };

  // ── Single product actions ─────────────────────────────────────────────
  const selectPreview = (p: any) => {
    setPreview(p);
    setCustomMsg(generateMessage(p));
    setCopied(false);
    setSelectedImageIndex(0);
    setTelegramSuccess(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customMsg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleWhatsApp = () => {
    if (!preview) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(customMsg)}`, '_blank');
  };

  const handleTelegramSingle = async () => {
    if (!preview) return;
    setSending(true);
    setTelegramSuccess(false);
    const allImages = getProductImages(preview);
    const imageUrl  = allImages[selectedImageIndex] || allImages[0] || '';
    try {
      const res  = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcast: true, imageUrl, message: customMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setTelegramSuccess(true);
      setTimeout(() => setTelegramSuccess(false), 3000);
    } catch (err: any) {
      alert('❌ Telegram Error: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // ── Multi-select batch Telegram ────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filtered.map((p:any) => p._id)));
  const clearAll  = () => setSelectedIds(new Set());

  const handleTelegramBatch = async () => {
    if (selectedIds.size === 0) return;
    const toSend = products.filter(p => selectedIds.has(p._id));
    setSending(true);
    setProgress({ current: 0, total: toSend.length });
    setDoneCount(0);
    let done = 0;
    for (const p of toSend) {
      const imgs = getProductImages(p);
      try {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broadcast: true, imageUrl: imgs[0] || '', message: generateMessage(p) }),
        });
      } catch { /* continue */ }
      done++;
      setProgress({ current: done, total: toSend.length });
      if (done < toSend.length) await new Promise(r => setTimeout(r, 1500));
    }
    setDoneCount(done);
    setSending(false);
    setTimeout(() => { setProgress(null); setDoneCount(0); setSelectedIds(new Set()); }, 4000);
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-5">
      <SectionHeader icon={Megaphone} title="Product Broadcast" desc="Select products and send promotional messages via WhatsApp or Telegram" />

      {/* ── Sticky Send Bar ── */}
      <div className="sticky top-0 z-20 bg-white border border-gray-100 rounded-2xl shadow-md px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${selectedCount > 0 ? 'bg-[#FA5600] text-white' : 'bg-gray-100 text-gray-400'}`}>
            {selectedCount}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-800">
              {selectedCount === 0 ? 'Tick checkboxes to batch-send to Telegram' : `${selectedCount} product${selectedCount > 1 ? 's' : ''} selected for batch send`}
            </p>
            {progress && (
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-[#FA5600] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
                <span className="text-[10px] font-black text-gray-500">{progress.current}/{progress.total}</span>
              </div>
            )}
            {!sending && doneCount > 0 && (
              <p className="text-[10px] font-black text-green-600">✓ {doneCount} posted to Telegram channel!</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={selectAll} className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-[#FA5600] transition">
            All ({filtered.length})
          </button>
          <button onClick={clearAll} className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-500 transition">
            Clear
          </button>
          <button onClick={handleTelegramBatch} disabled={sending || selectedCount === 0}
            className={`flex items-center gap-2 font-black py-2 px-4 rounded-xl transition-all text-sm uppercase tracking-widest disabled:opacity-50 ${
              sending ? 'bg-gray-200 text-gray-400' : 'bg-[#2AABEE] hover:bg-[#229ED9] text-white shadow-md'
            }`}>
            {sending ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending {progress?.current}/{progress?.total}...</>
            ) : (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              Batch Post {selectedCount > 0 ? `(${selectedCount})` : ''} to Telegram</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT — Filters + Product List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Filters */}
          <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Filters</p>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white" />
            {/* Category */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border-2 transition-all ${
                    categoryFilter === cat ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-400 bg-white hover:border-[#FA5600]/50'
                  }`}>{cat}</button>
              ))}
            </div>
            {/* Price + Stock */}
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase shrink-0">₹</span>
                <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="Min"
                  className="w-20 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:border-[#FA5600] outline-none bg-white" />
                <span className="text-gray-300">—</span>
                <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Max"
                  className="w-20 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:border-[#FA5600] outline-none bg-white" />
                {(priceMin || priceMax) && (
                  <button onClick={() => { setPriceMin(''); setPriceMax(''); }} className="text-[10px] text-red-400 font-black hover:text-red-600">✕</button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {(['all','instock','outofstock'] as const).map(s => (
                  <button key={s} onClick={() => setStockFilter(s)}
                    className={`text-[10px] font-black uppercase px-2 py-1.5 rounded-lg border-2 transition-all ${
                      stockFilter === s
                        ? s === 'instock' ? 'bg-green-500 text-white border-green-500'
                        : s === 'outofstock' ? 'bg-red-400 text-white border-red-400'
                        : 'bg-gray-700 text-white border-gray-700'
                        : 'border-gray-200 text-gray-400 bg-white'
                    }`}>
                    {s === 'all' ? 'All Stock' : s === 'instock' ? 'In Stock' : 'Out'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-black text-gray-400 ml-auto">{filtered.length} products</span>
            </div>
          </div>

          {/* Product list */}
          <div className="overflow-y-auto max-h-[560px]">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(6)].map((_,i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                <p className="font-black text-sm uppercase tracking-widest">No products match filters</p>
              </div>
            ) : filtered.map(p => {
              const price      = resolvePrice(p);
              const stock      = getStock(p);
              const isChecked  = selectedIds.has(p._id);
              const isPreviewed = preview?._id === p._id;
              return (
                <div key={p._id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition ${isPreviewed ? 'bg-orange-50' : 'hover:bg-gray-50'} ${isChecked ? 'border-l-4 border-l-[#FA5600]' : ''}`}>
                  {/* Checkbox for batch */}
                  <button onClick={() => toggleSelect(p._id)}
                    className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${isChecked ? 'bg-[#FA5600] border-[#FA5600]' : 'border-gray-300 hover:border-[#FA5600]'}`}>
                    {isChecked && <Check className="w-3 h-3 text-white"/>}
                  </button>
                  {/* Thumbnail — click to preview */}
                  <button onClick={() => selectPreview(p)} className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200 hover:border-[#FA5600] transition">
                    {p.image || p.imageUrl ? (
                      <img src={p.image || p.imageUrl} alt={p.name} className="w-full h-full object-cover"/>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-5 h-5"/></div>
                    )}
                  </button>
                  {/* Info — click to preview */}
                  <button onClick={() => selectPreview(p)} className="flex-1 min-w-0 text-left">
                    <p className="font-black text-sm text-gray-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">{p.category}</p>
                  </button>
                  {/* Price + Stock */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="font-black text-sm text-[#FA5600]">₹{price.toFixed(0)}</p>
                    {stock !== null ? (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        stock === 0 ? 'bg-red-100 text-red-500' : stock <= 5 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                      }`}>{stock === 0 ? 'Out' : `Qty: ${stock}`}</span>
                    ) : (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">No track</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Single product preview + WhatsApp/Telegram/Copy */}
        <div className="flex flex-col gap-4">
          {!preview ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="font-black text-sm uppercase tracking-widest">Click a product to preview & send</p>
              <p className="text-[10px] mt-2 text-gray-300">Use checkboxes + batch button above to send multiple</p>
            </div>
          ) : (
            <>
              {/* Product preview card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                    {getProductImages(preview)[selectedImageIndex] && (
                      <img src={getProductImages(preview)[selectedImageIndex]} alt={preview.name} className="w-full h-full object-cover"/>
                    )}
                  </div>
                  <div>
                    <p className="font-black text-sm text-gray-900">{preview.name}</p>
                    <p className="text-[10px] text-gray-400">{preview.category}</p>
                    <p className="font-black text-[#FA5600]">₹{resolvePrice(preview).toFixed(0)}</p>
                  </div>
                </div>

                {/* Image selector */}
                {getProductImages(preview).length > 1 && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                      Select Image to Send ({selectedImageIndex + 1}/{getProductImages(preview).length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {getProductImages(preview).map((img, idx) => (
                        <button key={idx} onClick={() => setSelectedImageIndex(idx)}
                          className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImageIndex === idx ? 'border-[#FA5600] shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'
                          }`}>
                          <img src={img} alt={`img-${idx}`} className="w-full h-full object-cover"/>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Editable message */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Promotional Message</p>
                    <button onClick={handleCopy}
                      className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg transition ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {copied ? <><Check className="w-3 h-3"/> Copied!</> : <><Copy className="w-3 h-3"/> Copy</>}
                    </button>
                  </div>
                  <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={10}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:border-[#FA5600] outline-none resize-none transition" />
                  <p className="text-[9px] text-gray-400 mt-1">You can edit this message before sending</p>
                </div>
              </div>

              {/* Send buttons */}
              <div className="sticky bottom-4 z-10 bg-white/95 backdrop-blur-sm rounded-2xl p-3 shadow-xl border border-gray-100 grid grid-cols-1 gap-2">
                {/* WhatsApp */}
                <button onClick={handleWhatsApp} disabled={sending}
                  className="w-full flex items-center justify-center gap-3 bg-[#25D366] text-white font-black py-3.5 rounded-xl hover:bg-[#20bd5a] transition-all shadow-md text-sm uppercase tracking-widest disabled:opacity-60">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Send via WhatsApp
                </button>

                {/* Telegram single */}
                <button onClick={handleTelegramSingle} disabled={sending}
                  className={`w-full flex items-center justify-center gap-3 font-black py-3.5 rounded-xl transition-all shadow-md text-sm uppercase tracking-widest disabled:opacity-60 ${
                    telegramSuccess ? 'bg-green-500 text-white' : 'bg-[#2AABEE] hover:bg-[#229ED9] text-white'
                  }`}>
                  {sending ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending...</>
                  ) : telegramSuccess ? (
                    <><Check className="w-5 h-5"/> Posted to Channel!</>
                  ) : (
                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    Post to Telegram Channel</>
                  )}
                </button>

                {/* Copy */}
                <button onClick={handleCopy}
                  className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-600 font-black py-2.5 rounded-xl hover:border-[#FA5600] hover:text-[#FA5600] transition-all text-xs uppercase tracking-widest">
                  <Copy className="w-4 h-4"/>
                  {copied ? 'Copied to Clipboard!' : 'Copy Message Only'}
                </button>

                <p className="text-[9px] text-center text-gray-400 font-semibold">
                  Telegram posts image + message directly to your TAGS channel
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
