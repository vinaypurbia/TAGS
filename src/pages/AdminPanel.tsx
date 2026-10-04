import { StockVisibilityPanel } from '../components/StockVisibilityPanel';
import AdminPushSetup from '../components/AdminPushSetup';
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProductManagerEmbed } from './ProductManagerEmbed';
import { ManageCategoriesEmbed } from './ManageCategoriesEmbed';
import { InventoryEmbed } from './InventoryEmbed';
import { BusinessEmbed } from './BusinessEmbed';
import { MarginWidget } from './MarginWidget';
import {
  Lock, LogOut, Megaphone, Image, Tag, Package, FolderTree,
  Save, Check, Trash2, Eye, Upload, BarChart2,
  LayoutDashboard, ShoppingBag, Menu, X,
  TrendingUp, TrendingDown, Users, AlertTriangle, DollarSign, IndianRupee,
  KeyRound, EyeOff, MessageSquare, Pencil, Database, Send, Radio, Copy, Download,
  CheckCircle, RefreshCw, FileText, Sparkles, Wand2,
  Video, ZoomIn,
} from 'lucide-react';

const VISIBILITY_KEY = 'tagsAdminVisibility';

type Section =
  | 'dashboard' | 'promo' | 'banner' | 'category-images' | 'perks'
  | 'products' | 'categories' | 'inventory' | 'business' | 'settings' | 'import' | 'reviews' | 'broadcast' | 'backup' | 'cleanup' | 'video' | 'imageQuality';

interface BannerSlide { image: string; text: string; description: string; }
interface Perk        { icon: string; text: string; }
interface PromoLine   { text: string; }

const ALL_MODULES: { id: Section; label: string; icon: any; desc: string }[] = [
  { id: 'dashboard',       label: 'Dashboard',       icon: LayoutDashboard, desc: 'Overview & quick stats' },
  { id: 'business',        label: 'Business',         icon: BarChart2,       desc: 'Sales, PO, Cash Flow, Reports' },
  { id: 'inventory',       label: 'Inventory',        icon: ShoppingBag,     desc: 'Stock management' },
  { id: 'broadcast',       label: 'Broadcast',        icon: Megaphone,       desc: 'Promote products on WhatsApp, Telegram & Stories' },
  { id: 'products',        label: 'Products',         icon: Package,         desc: 'Add & edit products' },
  { id: 'categories',      label: 'Categories',       icon: FolderTree,      desc: 'Manage categories' },
  { id: 'category-images', label: 'Category Images',  icon: Tag,             desc: 'Upload category covers' },
  { id: 'banner',          label: 'Hero Banners',     icon: Image,           desc: 'Homepage banners' },
  { id: 'promo',           label: 'Offer Bar',        icon: Megaphone,       desc: 'Scrolling announcements' },
  { id: 'perks',           label: 'Product Perks',    icon: Tag,             desc: 'Trust badges on product pages' },
  { id: 'import',          label: 'Import Products',  icon: Upload,          desc: 'Bulk import via CSV' },
  { id: 'reviews',         label: 'Reviews',          icon: MessageSquare,   desc: 'Manage customer reviews' },
  { id: 'settings',        label: 'Settings',         icon: SettingsIcon,    desc: 'Module visibility' },
  { id: 'backup',          label: 'Backup',           icon: Database,        desc: 'Download a full database backup' },
  { id: 'cleanup',         label: 'Cleanup',          icon: Trash2,          desc: 'Find and remove junk/orphaned data' },
  { id: 'video',           label: 'Video',            icon: Video,           desc: 'Free animated videos for product cards' },
  { id: 'imageQuality',    label: 'Image Quality',    icon: ZoomIn,          desc: 'Find low-resolution product photos' },
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
  const [dashPeriod, setDashPeriod] = useState<'today'|'week'|'month'|'year'>('month');
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

  // Settle modal (replaces handover + deposit — unified for all collectors)
  const [settleModal, setSettleModal] = useState<{
    open: boolean;
    collector: any | null;
    amount: string;
    paymentMode: 'cash' | 'bank';
    submitting: boolean;
  }>({ open: false, collector: null, amount: '', paymentMode: 'cash', submitting: false });

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
      fetch(`/api/sales?period=${dashPeriod}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/business?module=cashflow&period=${dashPeriod}`).then(r => r.json()).catch(() => ({})),
      fetch('/api/business?module=reports&type=stock-shortage').then(r => r.json()).catch(() => []),
      fetch('/api/customers').then(r => r.json()).catch(() => ({})),
      fetch('/api/inventory').then(r => r.json()).catch(() => []),
      fetch('/api/sales?status=pending').then(r => r.json()).catch(() => ({})),
      fetch('/api/customers?module=orders').then(r => r.json()).catch(() => ({})),
    ]).then(([sales, cash, stockShortage, customers, inventory, pendingSales, ordersData]) => {
      const invArr = Array.isArray(inventory) ? inventory : (inventory?.inventory || inventory?.items || []);
      setDashStats({
        revenue:       cash?.summary?.revenue       || 0,
        orders:        sales?.summary?.totalOrders   || 0,
        profit:        cash?.summary?.profit         || 0,
        expense:       cash?.summary?.expense        || 0,
        // customers API returns plain array (no module param)
        customers:     Array.isArray(customers) ? customers.length : (customers?.summary?.totalCustomers || customers?.length || 0),
        totalProducts: invArr.length,
        inStock:       invArr.filter((p: any) => (p.availableStock ?? p.stock?.availableStock ?? 0) > 0).length,
        outOfStock:    invArr.filter((p: any) => (p.availableStock ?? p.stock?.availableStock ?? 0) <= 0).length,
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
  }, [canAccessAdmin, dashPeriod]);

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

  // ── SETTLE: admin confirms cash/bank received from any collector ────────────
  // This is the ONLY place a delivery_collection cashFlow income entry is written.
  // Called when admin physically receives cash or sees bank deposit receipt.
  const handleSettle = async () => {
    const { collector, amount, paymentMode: settleMode } = settleModal;
    if (!collector) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Please enter a valid amount.'); return;
    }
    if (Number(amount) > collector.balance) {
      alert(`Cannot settle more than the balance of ₹${collector.balance.toLocaleString('en-IN')}.`); return;
    }
    setSettleModal(p => ({ ...p, submitting: true }));
    try {
      // Write the actual cashFlow income entry now — money is in admin's hands
      await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transfer',
          category: 'cash_settled',
          amount: Number(amount),
          description: `Settled – ${collector.collectorName || collector.collectedBy} handed over to admin`,
          paymentMode: settleMode,
          collectedBy: collector.collectedBy,
          collectorName: collector.collectorName || null,
          settledAt: new Date().toISOString(),
          date: new Date().toISOString(),
        }),
      });
      setSettleModal({ open: false, collector: null, amount: '', paymentMode: 'cash', submitting: false });
      fetchCollectorBalances();
    } catch {
      setSettleModal(p => ({ ...p, submitting: false }));
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
    <div className="h-dvh bg-[#F0F2F5] flex overflow-hidden">

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

        <div className="sticky top-0 z-30 bg-white shadow-sm">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
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

        {/* Mobile tab strip: every menu visible and swipeable on small screens */}
        <nav className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar px-3 py-2 border-b border-gray-100 bg-white">
          {visibleModules.map(item => {
            const isActive = activeSection === item.id;
            const badge = item.id === 'business' && pendingOrders.length > 0;
            return (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide whitespace-nowrap transition
                  ${isActive ? 'bg-[#FA5600] text-white shadow' : 'bg-gray-100 text-gray-600 active:bg-orange-50'}`}>
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
                {badge && <span className="bg-red-500 text-white text-[9px] font-black px-1.5 rounded-full">{pendingOrders.length}</span>}
              </button>
            );
          })}
        </nav>
        </div>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">

          {/* ── DASHBOARD ── */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Welcome back 👋</h2>
                    <p className="text-sm text-gray-400">
                      TAGS ·{' '}
                      <span className="font-bold text-[#FA5600]">
                        {dashPeriod === 'today' ? 'Today' : dashPeriod === 'week' ? 'This Week' : dashPeriod === 'month' ? 'This Month' : 'This Year'}
                      </span>
                    </p>
                  </div>
                  <select
                    value={dashPeriod}
                    onChange={e => setDashPeriod(e.target.value as any)}
                    className="text-sm font-black border-2 border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:border-[#FA5600] focus:outline-none cursor-pointer">
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
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
                    { label: 'Net Profit', value: `₹${Number(dashStats?.profit   || 0).toLocaleString('en-IN')}`, icon: IndianRupee,   color: 'bg-orange-50 text-[#FA5600]',  border: 'border-orange-100' },
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

              <MarginWidget />

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
                          {c.balance > 0 && (
                            <button
                              onClick={() => setSettleModal({ open: true, collector: c, amount: String(c.balance), paymentMode: 'cash', submitting: false })}
                              className="text-[10px] bg-[#FA5600] text-white font-black px-2.5 py-1 rounded-full hover:bg-[#E04A00] transition whitespace-nowrap">
                              Settle ✓
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
          {activeSection === 'backup'     && <div className="max-w-2xl mx-auto"><BackupSection /></div>}
          {activeSection === 'cleanup'    && <div className="max-w-2xl mx-auto"><CleanupSection /></div>}
          {activeSection === 'video'      && <div className="max-w-2xl mx-auto"><ProductVideoSection /></div>}
          {activeSection === 'imageQuality' && <div className="max-w-2xl mx-auto"><ImageQualitySection /></div>}

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

              {/* ── Delivery Notifications ── */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 pb-3 border-b border-gray-100">Delivery Notifications</p>
                <AdminPushSetup />
              </div>

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

      {/* ── SETTLE MODAL ─────────────────────────────────────────────────────── */}
      {/* Admin confirms cash/bank receipt from collector — writes cashFlow entry */}
      {settleModal.open && settleModal.collector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-gray-900 text-base uppercase tracking-widest">Settle Collection</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Confirm you have received cash/bank from{' '}
                  {settleModal.collector.collectorName || settleModal.collector.collectedBy.replace('_', ' ')}
                </p>
              </div>
              <button onClick={() => setSettleModal(p => ({ ...p, open: false }))} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Pending Balance</p>
              <p className="text-2xl font-black text-green-700">₹{Number(settleModal.collector.balance).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-green-500 mt-0.5">from {settleModal.collector.count} collection{settleModal.collector.count !== 1 ? 's' : ''}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Amount Received (₹)</p>
              <input
                type="number" min="0" max={settleModal.collector.balance}
                value={settleModal.amount}
                onChange={e => setSettleModal(p => ({ ...p, amount: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none"
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Received Via</p>
              <div className="flex gap-2">
                {(['cash', 'bank'] as const).map(mode => (
                  <button key={mode}
                    onClick={() => setSettleModal(p => ({ ...p, paymentMode: mode }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition ${settleModal.paymentMode === mode ? 'border-[#FA5600] bg-orange-50 text-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {mode === 'cash' ? '💵 Cash' : '🏦 Bank'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">This posts a Cash Flow income entry. Only click when money is in your hands.</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setSettleModal(p => ({ ...p, open: false }))}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500 hover:border-gray-300 transition">
                Cancel
              </button>
              <button onClick={handleSettle} disabled={settleModal.submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#FA5600] text-white text-xs font-black uppercase tracking-widest hover:bg-[#E04A00] transition disabled:opacity-60">
                {settleModal.submitting ? 'Saving...' : '✓ Settle'}
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

// ── Product Video (free, no AI generation) ─────────────────────────────────
// Turns a product's existing photo into a real 10-second MP4 using canvas animation +
// MediaRecorder — zero AI calls, zero cost. Three motion styles to pick from.
type VideoStyle = 'zoom' | 'tilt' | 'shine' | 'pop';
const VIDEO_STYLES: { id: VideoStyle; label: string; blurb: string }[] = [
  { id: 'zoom',  label: 'Slow Zoom',    blurb: 'Smooth zoom-in with the name & price overlaid' },
  { id: 'tilt',  label: 'Gentle Rock',  blurb: 'A subtle rocking tilt, like a slow turntable' },
  { id: 'shine', label: 'Shine Sweep',  blurb: 'Zoom plus a light sweep across the product' },
  { id: 'pop',   label: 'Zoom Appear',  blurb: 'Product pops into the center, with a sound effect' },
];
type MusicTrack = { id: string; name: string; url: string };
const PRODUCT_VIDEO_DURATION_S = 10;
const PRODUCT_VIDEO_SIZE = 1000; // square, matches your Cloudinary product image crop

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
// A little overshoot-then-settle spring, used for the "Zoom Appear" pop-in.
function easeOutBack(t: number) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

// ── Glitter overlay: falling, twinkling particles — pure canvas, no assets needed ──
function drawGlitter(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, seedBase = 1) {
  const rnd = (i: number) => { const x = Math.sin(i * 999.123 + seedBase * 7.77) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 34; i++) {
    const colX = rnd(i) * W;
    const speed = 0.4 + rnd(i + 50) * 0.5;      // laps per clip
    const fall = ((t * speed + rnd(i + 100)) % 1);
    const y = fall * H * 1.15 - H * 0.075;
    const x = colX + Math.sin((t * 3 + i) * Math.PI) * 10;
    if (y < 0 || y > H) continue;
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin((t * 6 + i) * Math.PI));
    const r = 2 + rnd(i + 150) * 3.5;
    ctx.save();
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = i % 3 === 0 ? '#FFD447' : i % 3 === 1 ? '#FFFFFF' : '#FFB3D9';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.3, y + r * 0.3); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y + r * 0.3);
    ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.3, y - r * 0.3); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Soft, slow-drifting snowflakes — straight fall with a gentle sway, no twinkle.
function drawSnow(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, seedBase = 2) {
  const rnd = (i: number) => { const x = Math.sin(i * 713.91 + seedBase * 11.3) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 28; i++) {
    const colX = rnd(i) * W;
    const speed = 0.25 + rnd(i + 50) * 0.3; // slower than glitter — snow drifts, it doesn't sparkle-fall
    const fall = ((t * speed + rnd(i + 100)) % 1);
    const y = fall * H * 1.2 - H * 0.1;
    const x = colX + Math.sin((t * 1.5 + i * 0.7) * Math.PI) * 18;
    if (y < 0 || y > H) continue;
    const r = 2.5 + rnd(i + 150) * 4;
    ctx.save();
    ctx.globalAlpha = 0.55 + rnd(i + 200) * 0.35;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// Small autumn leaves tumbling down with horizontal drift and rotation.
function drawLeaves(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, seedBase = 3) {
  const rnd = (i: number) => { const x = Math.sin(i * 451.77 + seedBase * 13.9) * 43758.5453; return x - Math.floor(x); };
  const colors = ['#D2691E', '#E25822', '#F4A460', '#C1440E', '#DAA520'];
  for (let i = 0; i < 20; i++) {
    const colX = rnd(i) * W;
    const speed = 0.3 + rnd(i + 50) * 0.35;
    const fall = ((t * speed + rnd(i + 100)) % 1);
    const y = fall * H * 1.2 - H * 0.1;
    const drift = Math.sin((t * 2.2 + i) * Math.PI) * 50 + (t - 0.5) * 60 * (rnd(i + 300) - 0.5);
    const x = colX + drift;
    if (y < 0 || y > H) continue;
    const size = 9 + rnd(i + 150) * 7;
    const rot = (t * (1 + rnd(i + 250)) * 4 + i) * Math.PI;
    ctx.save();
    ctx.globalAlpha = 0.75 + rnd(i + 200) * 0.2;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = colors[i % colors.length];
    // Simple leaf silhouette: two curved lobes meeting at a point, plus a short stem.
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.8, -size * 0.2, 0, size);
    ctx.quadraticCurveTo(-size * 0.8, -size * 0.2, 0, -size);
    ctx.fill();
    ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(0, size + 4); ctx.stroke();
    ctx.restore();
  }
}

// Glowing embers rising from the bottom edge, flickering as they fade near the top.
function drawFireEmbers(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, seedBase = 4) {
  const rnd = (i: number) => { const x = Math.sin(i * 283.54 + seedBase * 9.1) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 24; i++) {
    const colX = rnd(i) * W;
    const speed = 0.35 + rnd(i + 50) * 0.4;
    const rise = ((t * speed + rnd(i + 100)) % 1); // 0 at bottom, 1 at top
    const y = H - rise * H * 1.1;
    const x = colX + Math.sin((t * 5 + i * 1.3) * Math.PI) * 14;
    if (y < 0 || y > H) continue;
    const fadeNearTop = 1 - Math.max(0, (H * 0.15 - y) / (H * 0.15)); // fades out in the top 15%
    const flicker = 0.5 + 0.5 * Math.abs(Math.sin((t * 10 + i) * Math.PI));
    const r = (1.5 + rnd(i + 150) * 3) * (1 - rise * 0.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, flicker * fadeNearTop * 0.9);
    ctx.fillStyle = i % 2 === 0 ? '#FF7A00' : '#FFD447';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// Draws one frame (t = 0..1 progress through the clip) for the given style.
type VideoTextStyle = { textColor: string; bgColor: string; fontFamily: string };
const DEFAULT_TEXT_STYLE: VideoTextStyle = { textColor: '#1a1a1a', bgColor: '#ffffff', fontFamily: 'system-ui, sans-serif' };

type ParticleEffect = 'none' | 'glitter' | 'snow' | 'leaves' | 'fire';

function drawProductVideoFrame(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, style: VideoStyle, t: number,
  W: number, H: number, name: string, description: string,
  particleEffect: ParticleEffect, textStyle: VideoTextStyle = DEFAULT_TEXT_STYLE,
) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high'; // browsers default to low-quality resampling otherwise

  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const coverScale = Math.max(W / iw, H / ih);
  // Fill the frame normally (as before) for any photo of reasonable resolution — this was over-capped
  // previously, which left normal product photos looking small with excess blurred padding around them.
  // The cap now only kicks in for genuinely tiny source photos (under ~400px), where filling the frame
  // outright really would look blocky even with smoothing — those get a blurred full-bleed backdrop
  // behind a less-stretched foreground instead, the same trick Instagram Stories uses for small photos.
  const CAP = 2.5;
  const baseScale = Math.min(coverScale, CAP);
  if (coverScale > CAP) {
    ctx.save();
    ctx.filter = 'blur(28px) brightness(0.9)';
    ctx.translate(W / 2, H / 2);
    ctx.scale(coverScale * 1.08, coverScale * 1.08); // slightly over-cover so the blur softens right to the edges
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }
  const e = easeInOut(t);

  // The image always appears first, with a quick spring pop-in — the POP_AT instant is also where
  // recordProductVideo fires the synthesized sound effect. "Zoom Appear" makes this the whole show
  // (appear, then hold); the other styles layer their own continuous motion on top after it settles.
  const POP_AT = 0.08;
  const APPEAR_END = 0.28;
  let popScale = 1, popAlpha = 1;
  if (t < POP_AT) { popScale = 0; popAlpha = 0; }
  else if (t < APPEAR_END) { const pt = (t - POP_AT) / (APPEAR_END - POP_AT); popScale = Math.max(0, easeOutBack(pt)); popAlpha = Math.min(1, pt * 2.2); }

  // Continuous motion only kicks in once the appear-in has settled, using "since" (0..1 over the
  // remaining clip) so zoom/rock/sweep don't jump the instant the pop-in finishes.
  const since = Math.max(0, (t - APPEAR_END) / (1 - APPEAR_END));

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.globalAlpha = popAlpha;

  if (style === 'zoom') {
    const s = baseScale * popScale * (1 + 0.14 * easeInOut(since));
    ctx.scale(s, s);
  } else if (style === 'tilt') {
    const s = baseScale * popScale * (1 + 0.05 * easeInOut(since));
    const angle = 0.05 * Math.sin(since * Math.PI * 2);
    ctx.rotate(angle);
    ctx.scale(s * (1 - 0.02 * Math.abs(Math.sin(since * Math.PI * 2))), s);
  } else if (style === 'pop') {
    ctx.scale(baseScale * popScale, baseScale * popScale); // appear, then hold — no extra motion
  } else {
    const s = baseScale * popScale * (1 + 0.10 * easeInOut(since));
    ctx.scale(s, s);
  }

  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();

  if (style === 'shine' && t >= APPEAR_END) {
    const sweepX = -W * 0.3 + (W * 1.6) * since; // one pass, left to right, over the remaining clip
    const grad = ctx.createLinearGradient(sweepX - 120, 0, sweepX + 120, H);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  if (particleEffect === 'glitter') drawGlitter(ctx, W, H, t);
  else if (particleEffect === 'snow') drawSnow(ctx, W, H, t);
  else if (particleEffect === 'leaves') drawLeaves(ctx, W, H, t);
  else if (particleEffect === 'fire') drawFireEmbers(ctx, W, H, t);

  // Name + description reveal AFTER the product has appeared — sliding up and fading in so it
  // reads as "product arrives, then its name introduces it," rather than a bar that's just always
  // there. Price is deliberately not drawn here at all — see the note in recordProductVideo/
  // ProductVideoSection on why price lives outside the video instead.
  const NAME_START = 0.38, NAME_END = 0.58;
  const DESC_START = 0.5, DESC_END = 0.66;
  if (name && t >= NAME_START) {
    const np = Math.min(1, (t - NAME_START) / (NAME_END - NAME_START));
    const nEase = easeOutBack(np);
    const slide = (1 - Math.min(1, np * 1.4)) * 40; // slides up into place, slightly overshooting
    const alpha = Math.min(1, np * 2.2);

    const label = name.length > 30 ? name.slice(0, 30) + '…' : name;
    ctx.font = `800 ${Math.round(W * 0.062)}px ${textStyle.fontFamily}`;
    const textW = ctx.measureText(label).width;
    const padX = W * 0.045, padY = H * 0.022;
    const pillW = textW + padX * 2, pillH = H * 0.09;
    const pillX = (W - pillW) / 2, pillY = H * 0.74 + slide;

    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = textStyle.bgColor;
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    const r = pillH / 2;
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
    ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
    ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
    ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = textStyle.textColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, pillY + pillH / 2 + padY * 0.1);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  if (description && t >= DESC_START) {
    const dp = Math.min(1, (t - DESC_START) / (DESC_END - DESC_START));
    const alpha = Math.min(1, dp * 2.2);
    const slide = (1 - Math.min(1, dp * 1.4)) * 20;
    const label = description.length > 54 ? description.slice(0, 54) + '…' : description;

    ctx.font = `600 ${Math.round(W * 0.028)}px ${textStyle.fontFamily}`;
    const textW = ctx.measureText(label).width;
    const padX = W * 0.03, padY = H * 0.014;
    const pillW = textW + padX * 2, pillH = H * 0.05;
    const pillX = (W - pillW) / 2, pillY = H * 0.86 + slide;

    // Solid backdrop behind the description, same treatment as the name pill, so it's always
    // legible regardless of how busy the photo underneath it is.
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = textStyle.textColor;
    const r = pillH / 2;
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
    ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
    ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
    ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = textStyle.bgColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, pillY + pillH / 2 + padY * 0.1);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

// A short synthesized "pop" sound — an oscillator pitch-sweep plus a quick noise burst.
// Nothing sampled or downloaded, so there's no licensing question at all.
function scheduleSynthPop(ctx: AudioContext, destination: AudioNode, atTime: number) {
  const osc = ctx.createOscillator(); const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, atTime);
  osc.frequency.exponentialRampToValueAtTime(880, atTime + 0.09);
  oscGain.gain.setValueAtTime(0.0001, atTime);
  oscGain.gain.exponentialRampToValueAtTime(0.5, atTime + 0.02);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.22);
  osc.connect(oscGain).connect(destination);
  osc.start(atTime); osc.stop(atTime + 0.25);

  const bufferSize = ctx.sampleRate * 0.08;
  const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(0.25, atTime);
  noise.connect(noiseGain).connect(destination);
  noise.start(atTime);
}

// Decodes an admin-supplied music track and loops/trims it to exactly the clip length,
// mixed quietly under everything else so it doesn't drown out a pop sound effect.
async function buildMusicSource(ctx: AudioContext, destination: AudioNode, url: string, durationS: number) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('Could not load the selected music track');
  const arrayBuf = await res.arrayBuffer();
  const audioBuf = await ctx.decodeAudioData(arrayBuf);
  const src = ctx.createBufferSource();
  src.buffer = audioBuf; src.loop = audioBuf.duration < durationS;
  const gain = ctx.createGain(); gain.gain.value = 0.35;
  src.connect(gain).connect(destination);
  return src;
}

// Records a real-time animation of the canvas for PRODUCT_VIDEO_DURATION_S seconds, optionally
// mixing in a music track and/or the synthesized pop sound effect (for the "Zoom Appear" style).
function recordProductVideo(
  img: HTMLImageElement, style: VideoStyle, name: string, description: string,
  particleEffect: ParticleEffect, musicUrl: string | null, textStyle: VideoTextStyle = DEFAULT_TEXT_STYLE,
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = PRODUCT_VIDEO_SIZE; canvas.height = PRODUCT_VIDEO_SIZE;
    const ctx = canvas.getContext('2d');
    const videoStream = (canvas as any).captureStream?.(30);
    if (!ctx || !videoStream || typeof MediaRecorder === 'undefined') {
      reject(new Error('This browser cannot record video — use Chrome or Edge.')); return;
    }

    // Build the audio mix (music and/or the pop sound effect) and combine it with the video track
    // into one MediaStream. If audio setup fails for any reason, we fall back to a silent video
    // rather than losing the whole generation over a music glitch.
    let audioCtx: AudioContext | null = null;
    let combinedStream: MediaStream = videoStream;
    try {
      const AudioCtxCls = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxCls && (musicUrl || style === 'pop')) {
        audioCtx = new AudioCtxCls();
        const dest = audioCtx.createMediaStreamDestination();
        if (musicUrl) {
          try { const src = await buildMusicSource(audioCtx, dest, musicUrl, PRODUCT_VIDEO_DURATION_S); src.start(); }
          catch { /* bad/blocked track URL — continue without music rather than failing the whole video */ }
        }
        if (style === 'pop') scheduleSynthPop(audioCtx, dest, audioCtx.currentTime + 0.08); // matches POP_AT in drawProductVideoFrame
        combinedStream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      }
    } catch { combinedStream = videoStream; }

    const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(combinedStream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 6_000_000 });
    const parts: Blob[] = [];
    rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
    rec.onerror = () => reject(new Error('Recording failed'));
    rec.onstop = () => { audioCtx?.close().catch(() => {}); resolve(new Blob(parts, { type: rec.mimeType || mime || 'video/webm' })); };

    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / (PRODUCT_VIDEO_DURATION_S * 1000));
      drawProductVideoFrame(ctx, img, style, t, PRODUCT_VIDEO_SIZE, PRODUCT_VIDEO_SIZE, name, description, particleEffect, textStyle);
      if (t < 1) raf = requestAnimationFrame(frame);
      else rec.stop();
    };
    rec.start(250);
    raf = requestAnimationFrame(frame);
    setTimeout(() => { if (rec.state !== 'inactive') { cancelAnimationFrame(raf); rec.stop(); } }, PRODUCT_VIDEO_DURATION_S * 1000 + 1500);
  });
}

// Uploads straight from the browser to Cloudinary (same signed-upload pattern used elsewhere),
// then asks Cloudinary to deliver it back as a plain H.264 MP4 regardless of what was recorded.
async function uploadProductVideo(blob: Blob, baseName: string): Promise<string> {
  const sig = await (await fetch('/api/products?cloudinarySign=true&resourceType=video')).json();
  if (!sig.signature) throw new Error('Could not get an upload permission from the server.');
  const form = new FormData();
  form.append('file', blob, `${baseName}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`, { method: 'POST', body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.secure_url) throw new Error(d.error?.message || 'Video upload failed.');
  const mp4Url = d.secure_url
    .replace('/video/upload/', '/video/upload/f_mp4,vc_h264,ac_aac,fps_30,c_limit,w_1000,h_1000,q_auto:best/')
    .replace(/\.[a-z0-9]+$/i, '.mp4');
  await fetch(mp4Url, { cache: 'reload' }).catch(() => {}); // warm it so it's ready the moment the admin opens it
  return mp4Url;
}

// The customer-facing catalog treats imageUrls[0] as a product's main picture. These admin tools used to
// read `image` first, which still holds the OLD photo after a picture is changed — so they kept using it.
// Same order as the catalog: imageUrls → imageUrl → image → images.
const productImageList = (p: any): string[] => {
  const out: string[] = [];
  const add = (u: any) => { const v = typeof u === 'string' ? u.trim() : ''; if (v && !out.includes(v)) out.push(v); };
  if (Array.isArray(p?.imageUrls)) p.imageUrls.forEach(add);
  add(p?.imageUrl);
  add(p?.image);
  if (Array.isArray(p?.images)) p.images.forEach(add);
  return out;
};

type VideoProduct = { _id: string; name: string; image: string; description?: string; category?: string; videoUrl?: string; discountedPrice?: number; originalPrice?: number };

const FONT_OPTIONS = [
  { label: 'Default (Clean)',  value: 'system-ui, sans-serif' },
  { label: 'Bold Poster',      value: 'Impact, sans-serif' },
  { label: 'Playful',          value: '"Comic Sans MS", cursive, sans-serif' },
  { label: 'Classic Serif',    value: 'Georgia, serif' },
  { label: 'Friendly Rounded', value: '"Trebuchet MS", sans-serif' },
];

function ProductVideoSection() {
  const [mode, setMode] = useState<'individual' | 'batch'>('individual');
  const [products, setProducts] = useState<VideoProduct[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [showMusicManager, setShowMusicManager] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackFile, setNewTrackFile] = useState<File | null>(null);
  const [trackUploading, setTrackUploading] = useState(false);
  const [trackError, setTrackError] = useState('');
  const trackFileRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState('');
  const [style, setStyle] = useState<VideoStyle>('zoom');
  const [particleEffect, setParticleEffect] = useState<ParticleEffect>('none');
  const [nameOverride, setNameOverride] = useState('');
  const [captionOverride, setCaptionOverride] = useState('');
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_STYLE.textColor);
  const [bgColor, setBgColor] = useState(DEFAULT_TEXT_STYLE.bgColor);
  const [fontFamily, setFontFamily] = useState(DEFAULT_TEXT_STYLE.fontFamily);
  const [musicChoice, setMusicChoice] = useState<string>('none'); // 'none' | 'random' | track.id
  const [working, setWorking] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');

  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchStyle, setBatchStyle] = useState<VideoStyle>('zoom');
  const [batchParticleEffect, setBatchParticleEffect] = useState<ParticleEffect>('none');
  const [batchCaptionOverride, setBatchCaptionOverride] = useState(''); // blank = use each product's own description
  const [batchTextColor, setBatchTextColor] = useState(DEFAULT_TEXT_STYLE.textColor);
  const [batchBgColor, setBatchBgColor] = useState(DEFAULT_TEXT_STYLE.bgColor);
  const [batchFontFamily, setBatchFontFamily] = useState(DEFAULT_TEXT_STYLE.fontFamily);
  const [batchMusicChoice, setBatchMusicChoice] = useState<string>('none'); // 'none' | 'random' | track.id
  const [batchWorking, setBatchWorking] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);

  useEffect(() => {
    // The API returns at most 100 products per request, so page through all of them
    // (a single limit=1000 call silently dropped everything past the first 100).
    (async () => {
      try {
        let all: any[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 60) {
          const r = await fetch(`/api/products?page=${page}&limit=100&adminView=true`, { cache: 'no-store' });
          const d = await r.json();
          all = all.concat(d.products || []);
          hasMore = !!d.hasMore;
          page++;
        }
        setProducts(all.map((p: any) => ({
          _id: p._id, name: p.name || '(no name)', image: productImageList(p)[0] || '',
          description: p.description || '', category: p.category || '', videoUrl: p.videoUrl || '',
          discountedPrice: p.discountedPrice, originalPrice: p.originalPrice,
        })));
      } catch { setError('Could not load your product list.'); }
      finally { setLoadingList(false); }
    })();

    fetch('/api/products?musicLibrary=true').then(r => r.json())
      .then(data => setTracks(data.tracks || []))
      .catch(() => {})
      .finally(() => setLoadingTracks(false));
  }, []);

  const saveTracks = async (next: MusicTrack[]) => {
    setTracks(next);
    try {
      await fetch('/api/products?musicLibrary=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tracks: next }),
      });
    } catch { /* kept in local state even if the save call fails; next load will just miss it */ }
  };

  const handleAddTrack = async () => {
    if (!newTrackFile || !newTrackName.trim()) { setTrackError('Pick a file and give it a name first.'); return; }
    setTrackUploading(true); setTrackError('');
    try {
      const sig = await (await fetch('/api/products?cloudinarySign=true&resourceType=video')).json();
      if (!sig.signature) throw new Error('Could not get an upload permission from the server.');
      const form = new FormData();
      form.append('file', newTrackFile);
      form.append('api_key', sig.apiKey);
      form.append('timestamp', String(sig.timestamp));
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`, { method: 'POST', body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.secure_url) throw new Error(d.error?.message || 'Upload failed');
      const track: MusicTrack = { id: `${Date.now()}`, name: newTrackName.trim(), url: d.secure_url };
      await saveTracks([...tracks, track]);
      setNewTrackName(''); setNewTrackFile(null);
      if (trackFileRef.current) trackFileRef.current.value = '';
    } catch (e: any) {
      setTrackError(e.message || 'Could not add this track');
    } finally { setTrackUploading(false); }
  };

  const removeTrack = (id: string) => saveTracks(tracks.filter(t => t.id !== id));

  const pickMusicUrl = (choice: string): string | null => {
    if (choice === 'none' || tracks.length === 0) return null;
    if (choice === 'random') return tracks[Math.floor(Math.random() * tracks.length)].url;
    return tracks.find(t => t.id === choice)?.url || null;
  };

  const priceValueOf = (p: VideoProduct) => Number(p.discountedPrice || p.originalPrice || 0);
  const priceOf = (p: VideoProduct) => { const v = priceValueOf(p); return v > 0 ? `₹${v}` : ''; };
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const minVal = priceMin.trim() === '' ? null : Number(priceMin);
  const maxVal = priceMax.trim() === '' ? null : Number(priceMax);
  const filtered = products.filter(p => {
    if (!p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    const price = priceValueOf(p);
    if (minVal !== null && price < minVal) return false;
    if (maxVal !== null && price > maxVal) return false;
    return true;
  });

  // Whatever transformation happens to be baked into the stored image URL (e.g. a small thumbnail
  // crop) is stripped, then a large, best-quality version is requested fresh from Cloudinary's
  // original master file — so it can't matter which size/quality variant was actually stored.
  const highQualityImageUrl = (url: string): string => {
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    const stripped = url
      .replace(/\/upload\/(?:[^/]+\/)*?(v\d+\/)/, '/upload/$1')
      .replace(/\/upload\/[^/]+\/(?!v\d)/, '/upload/');
    return stripped.replace('/upload/', '/upload/q_auto:best,f_auto,w_1400,c_limit/');
  };

  const generateOne = async (
    p: VideoProduct, useStyle: VideoStyle, useParticles: ParticleEffect, musicUrl: string | null,
    videoName: string, videoCaption: string, style_: VideoTextStyle,
  ) => {
    if (!p.image) throw new Error('No image on this product');
    const { im, release } = await loadImageElement(highQualityImageUrl(p.image));
    try {
      const blob = await recordProductVideo(im, useStyle, videoName, videoCaption, useParticles, musicUrl, style_);
      const safeName = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'product';
      const url = await uploadProductVideo(blob, `pv-${safeName}`);
      const putRes = await fetch('/api/products', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p._id, videoUrl: url }),
      });
      if (!putRes.ok) { const err = await putRes.json().catch(() => ({})); throw new Error(err.error || 'Could not save the video to this product'); }
      return url;
    } finally { release(); }
  };

  const handleGenerateIndividual = async () => {
    const p = products.find(x => x._id === selectedId);
    if (!p) return;
    setWorking(true); setError(''); setResultUrl('');
    try {
      const url = await generateOne(p, style, particleEffect, pickMusicUrl(musicChoice), nameOverride.trim() || p.name, captionOverride, { textColor, bgColor, fontFamily });
      setResultUrl(url);
      setProducts(ps => ps.map(x => x._id === p._id ? { ...x, videoUrl: url } : x));
    } catch (e: any) {
      setError(e.message || 'Video generation failed');
    } finally { setWorking(false); }
  };

  const toggleBatch = (id: string) => setBatchSelected(sel => {
    const next = new Set(sel); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const selectAllFiltered = (checked: boolean) => setBatchSelected(checked ? new Set(filtered.map(p => p._id)) : new Set());

  const handleGenerateBatch = async () => {
    const list = products.filter(p => batchSelected.has(p._id));
    if (list.length === 0) return;
    setBatchWorking(true); setBatchResults([]); setBatchProgress({ current: 0, total: list.length });
    const results: { name: string; ok: boolean; error?: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        await generateOne(
          list[i], batchStyle, batchParticleEffect, pickMusicUrl(batchMusicChoice),
          list[i].name, batchCaptionOverride.trim() || (list[i].description || ''),
          { textColor: batchTextColor, bgColor: batchBgColor, fontFamily: batchFontFamily },
        );
        results.push({ name: list[i].name, ok: true });
      }
      catch (e: any) { results.push({ name: list[i].name, ok: false, error: e.message }); }
      setBatchProgress({ current: i + 1, total: list.length });
      setBatchResults([...results]);
    }
    setBatchWorking(false);
  };

  const StylePicker = ({ value, onChange, disabled }: { value: VideoStyle; onChange: (s: VideoStyle) => void; disabled?: boolean }) => (
    <div className="grid grid-cols-2 gap-2">
      {VIDEO_STYLES.map(s => (
        <button key={s.id} type="button" disabled={disabled} onClick={() => onChange(s.id)}
          className={`text-left p-3 rounded-xl border-2 transition ${value === s.id ? 'border-[#FA5600] bg-orange-50' : 'border-gray-200 hover:border-gray-300'} disabled:opacity-50`}>
          <p className="text-xs font-black text-gray-800">{s.label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{s.blurb}</p>
        </button>
      ))}
    </div>
  );

  const ParticlePicker = ({ value, onChange, disabled }: { value: ParticleEffect; onChange: (v: ParticleEffect) => void; disabled?: boolean }) => (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Particle Effect</label>
      <select value={value} onChange={e => onChange(e.target.value as ParticleEffect)} disabled={disabled}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50">
        <option value="none">None</option>
        <option value="glitter">✨ Glitter</option>
        <option value="snow">❄️ Snowflakes</option>
        <option value="leaves">🍁 Maple Leaves</option>
        <option value="fire">🔥 Fire Embers</option>
      </select>
    </div>
  );

  const MusicPicker = ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Music</span>
        <button type="button" onClick={() => setShowMusicManager(v => !v)} className="text-[10px] font-black uppercase tracking-widest text-[#FA5600] hover:underline">
          {showMusicManager ? 'Hide library' : 'Manage library'}
        </button>
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50">
        <option value="none">No music</option>
        {tracks.length > 0 && <option value="random">🎲 Random from library</option>}
        {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {tracks.length === 0 && !loadingTracks && <p className="text-[10px] text-gray-400 mt-1">No tracks yet — add some in "Manage library" below.</p>}
    </div>
  );

  const StyleCustomizer = ({ tColor, setTColor, bColor, setBColor, font, setFont, disabled }: {
    tColor: string; setTColor: (v: string) => void; bColor: string; setBColor: (v: string) => void;
    font: string; setFont: (v: string) => void; disabled?: boolean;
  }) => (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Text Color</label>
        <input type="color" value={tColor} onChange={e => setTColor(e.target.value)} disabled={disabled}
          className="w-full h-9 rounded-lg border border-gray-200 cursor-pointer disabled:opacity-50" />
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Pill Color</label>
        <input type="color" value={bColor} onChange={e => setBColor(e.target.value)} disabled={disabled}
          className="w-full h-9 rounded-lg border border-gray-200 cursor-pointer disabled:opacity-50" />
      </div>
      <div className="col-span-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Font</label>
        <select value={font} onChange={e => setFont(e.target.value)} disabled={disabled}
          className="w-full h-9 border border-gray-200 rounded-lg px-1.5 text-xs disabled:opacity-50">
          {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionHeader icon={Video} title="Product Video" desc="Free animated videos made from your existing product photos" />

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0"><Video className="w-5 h-5 text-blue-600" /></div>
        <div className="flex-1">
          <p className="text-sm font-black text-gray-800">Product appears first, then its name & description — price stays out of the video</p>
          <p className="text-xs text-gray-500 mt-0.5">Each clip reveals the photo first (zoom, rock, shine or pop-in), then the name slides in over it with a short description line beneath. Price is deliberately NOT baked into the video — a video file can never update itself when you change a price later, so show price as a live element over the video in your product card instead (ask if you want help wiring that into your storefront). Music is your own upload below — we can't legally pick tracks on your behalf, but YouTube Audio Library, Pixabay Music, and Incompetech are all genuinely free (check each track's own attribution terms).</p>
        </div>
      </div>

      {showMusicManager && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-gray-700">Music Library</p>
          {loadingTracks ? (
            <p className="text-xs text-gray-400">Loading...</p>
          ) : tracks.length === 0 ? (
            <p className="text-xs text-gray-400">No tracks added yet.</p>
          ) : (
            <div className="space-y-1.5">
              {tracks.map(t => (
                <div key={t.id} className="flex items-center gap-2 border border-gray-100 rounded-xl px-3 py-2">
                  <span className="flex-1 text-xs font-bold text-gray-700 truncate">{t.name}</span>
                  <audio src={t.url} controls className="h-7" style={{ maxWidth: 160 }} />
                  <button onClick={() => removeTrack(t.id)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Add a track (MP3, your own free-license file)</p>
            <input value={newTrackName} onChange={e => setNewTrackName(e.target.value)} placeholder="Track name (e.g. Upbeat Corporate)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" disabled={trackUploading} />
            <input ref={trackFileRef} type="file" accept="audio/*" onChange={e => setNewTrackFile(e.target.files?.[0] || null)} disabled={trackUploading}
              className="w-full text-xs" />
            <button onClick={handleAddTrack} disabled={trackUploading || !newTrackFile || !newTrackName.trim()}
              className="w-full py-2.5 bg-gray-800 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-gray-900 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {trackUploading ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading...</>) : 'Add to Library'}
            </button>
            {trackError && <p className="text-[11px] text-red-500 font-bold">{trackError}</p>}
          </div>
        </div>
      )}

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setMode('individual')} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest py-2.5 rounded-lg transition ${mode === 'individual' ? 'bg-white text-[#FA5600] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <Video className="w-3.5 h-3.5" /> One Product
        </button>
        <button onClick={() => setMode('batch')} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest py-2.5 rounded-lg transition ${mode === 'batch' ? 'bg-white text-[#FA5600] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <Upload className="w-3.5 h-3.5" /> Batch (Same Style)
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />

      <div className="grid grid-cols-3 gap-2">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-2 py-2.5 text-xs">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={priceMin} onChange={e => setPriceMin(e.target.value)} type="number" placeholder="Min ₹"
          className="border border-gray-200 rounded-xl px-2 py-2.5 text-xs" />
        <input value={priceMax} onChange={e => setPriceMax(e.target.value)} type="number" placeholder="Max ₹"
          className="border border-gray-200 rounded-xl px-2 py-2.5 text-xs" />
      </div>
      {(categoryFilter !== 'all' || priceMin || priceMax) && (
        <p className="text-[11px] text-gray-400 -mt-2">Showing {filtered.length} of {products.length} products{categoryFilter !== 'all' ? ` in "${categoryFilter}"` : ''}{(priceMin || priceMax) ? ` priced ${priceMin || '0'}–${priceMax || '∞'}` : ''}.</p>
      )}

      {loadingList && <div className="text-center text-xs text-gray-400 font-bold py-6">Loading products...</div>}

      {mode === 'individual' && !loadingList && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {filtered.slice(0, 200).map(p => (
              <label key={p._id} className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-700 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="pv-pick" checked={selectedId === p._id} onChange={() => { setSelectedId(p._id); setResultUrl(''); setError(''); setNameOverride(p.name); setCaptionOverride(p.description || ''); }} className="w-4 h-4 accent-[#FA5600]" />
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                  {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-300" />}
                </div>
                <span className="flex-1 truncate">{p.name}</span>
                {p.videoUrl && <span className="text-[9px] font-black uppercase text-green-600">Has video</span>}
              </label>
            ))}
          </div>

          {selectedId && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Name shown in video</label>
                <input value={nameOverride} onChange={e => setNameOverride(e.target.value)} disabled={working}
                  placeholder="Product name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Caption (optional)</label>
                <input value={captionOverride} onChange={e => setCaptionOverride(e.target.value)} disabled={working}
                  placeholder="A short line under the name — leave blank for none" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50" />
              </div>
              <StylePicker value={style} onChange={setStyle} disabled={working} />
              <ParticlePicker value={particleEffect} onChange={setParticleEffect} disabled={working} />
              <StyleCustomizer tColor={textColor} setTColor={setTextColor} bColor={bgColor} setBColor={setBgColor} font={fontFamily} setFont={setFontFamily} disabled={working} />
              <MusicPicker value={musicChoice} onChange={setMusicChoice} disabled={working} />
              <button onClick={handleGenerateIndividual} disabled={working}
                className="w-full py-3 bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#E04A00] transition flex items-center justify-center gap-2 disabled:opacity-50">
                {working ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Recording 10s video...</>) : (<><Video className="w-4 h-4" /> Generate & Save Video</>)}
              </button>
              {error && <div className="rounded-xl p-3 text-sm font-bold text-center bg-red-50 text-red-600 border border-red-200">{error}</div>}
              {resultUrl && (
                <div className="space-y-2">
                  <div className="rounded-xl p-3 text-sm font-bold text-center bg-green-50 text-green-700 border border-green-200">✅ Video saved to this product.</div>
                  <video src={resultUrl} controls loop className="w-full rounded-xl border border-gray-200" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'batch' && !loadingList && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">{batchSelected.size} selected</p>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 cursor-pointer">
              <input type="checkbox" checked={filtered.length > 0 && filtered.every(p => batchSelected.has(p._id))} onChange={e => selectAllFiltered(e.target.checked)} className="w-3.5 h-3.5 accent-[#FA5600]" disabled={batchWorking} />
              Select All ({filtered.length})
            </label>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {filtered.slice(0, 200).map(p => (
              <label key={p._id} className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-700 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={batchSelected.has(p._id)} onChange={() => toggleBatch(p._id)} disabled={batchWorking} className="w-4 h-4 accent-[#FA5600]" />
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                  {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-300" />}
                </div>
                <span className="flex-1 truncate">{p.name}</span>
                {p.videoUrl && <span className="text-[9px] font-black uppercase text-green-600">Has video</span>}
              </label>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Caption for all videos (optional)</label>
            <input value={batchCaptionOverride} onChange={e => setBatchCaptionOverride(e.target.value)} disabled={batchWorking}
              placeholder="e.g. New Arrival! — leave blank to use each product's own description" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50" />
            <p className="text-[10px] text-gray-400 mt-1">Each video still shows its own product name — only the caption line can be shared across the batch.</p>
          </div>
          <StylePicker value={batchStyle} onChange={setBatchStyle} disabled={batchWorking} />
          <StyleCustomizer tColor={batchTextColor} setTColor={setBatchTextColor} bColor={batchBgColor} setBColor={setBatchBgColor} font={batchFontFamily} setFont={setBatchFontFamily} disabled={batchWorking} />
          <ParticlePicker value={batchParticleEffect} onChange={setBatchParticleEffect} disabled={batchWorking} />
          <MusicPicker value={batchMusicChoice} onChange={setBatchMusicChoice} disabled={batchWorking} />
          {batchMusicChoice === 'random' && <p className="text-[10px] text-gray-400 -mt-2">A different random track from your library is picked for each video.</p>}

          <button onClick={handleGenerateBatch} disabled={batchWorking || batchSelected.size === 0}
            className="w-full py-3 bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#E04A00] transition flex items-center justify-center gap-2 disabled:opacity-50">
            {batchWorking ? (<><RefreshCw className="w-4 h-4 animate-spin" /> {batchProgress.current}/{batchProgress.total} videos...</>) : (<><Video className="w-4 h-4" /> Generate {batchSelected.size} Video{batchSelected.size === 1 ? '' : 's'}</>)}
          </button>
          <p className="text-[11px] text-gray-400 text-center -mt-2">Each video takes about 10 seconds to record — keep this tab open while it runs. {batchSelected.size > 0 && `Roughly ${Math.ceil(batchSelected.size * 10 / 60)} min total.`}</p>

          {batchWorking && (
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="bg-[#FA5600] h-3 rounded-full transition-all" style={{ width: `${batchProgress.total ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }} />
            </div>
          )}

          {batchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {batchResults.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>{r.ok ? '✅' : '❌'}</span><span className="flex-1 truncate">{r.name}</span>
                  {r.error && <span className="text-[10px] opacity-70">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Backup Section ──────────────────────────────────────────────────────
// ── Image Quality Section ──────────────────────────────────────────────────
// "Low" = too small to fix — sharpening can't invent detail that isn't there, so we're honest about
// that and point toward re-uploading instead. "Borderline" = sharpening/compression cleanup can
// genuinely help. Dimensions come straight from Cloudinary's stored metadata, not a re-download.
type QualityEntry = { _id: string; name: string; category: string; image: string; width: number; height: number };

function ImageQualitySection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [data, setData] = useState<{ low: QualityEntry[]; borderline: QualityEntry[]; unknownCount: number; noImageCount: number; totalScanned: number } | null>(null);
  const [enhancing, setEnhancing] = useState<Set<string>>(new Set());
  const [enhanced, setEnhanced] = useState<Record<string, string>>({}); // id -> new image url
  const [enhanceErrors, setEnhanceErrors] = useState<Record<string, string>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState('');

  const runScan = async () => {
    setStatus('loading'); setError('');
    try {
      const res = await fetch('/api/products?imageQuality=true');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Scan failed (${res.status})`);
      setData(json);
      setEnhanced({}); setEnhanceErrors({});
      setStatus('ready');
    } catch (e: any) {
      setError(e.message || 'Scan failed'); setStatus('error');
    }
  };

  const enhanceOne = async (id: string) => {
    setEnhancing(s => new Set(s).add(id));
    setEnhanceErrors(e => { const n = { ...e }; delete n[id]; return n; });
    try {
      const res = await fetch('/api/products?enhanceImage=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Enhance failed (${res.status})`);
      setEnhanced(e => ({ ...e, [id]: json.imageUrl }));
    } catch (e: any) {
      setEnhanceErrors(err => ({ ...err, [id]: e.message || 'Enhance failed' }));
    } finally {
      setEnhancing(s => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const enhanceAllBorderline = async () => {
    const list = (data?.borderline || []).filter(it => !enhanced[it._id]);
    if (list.length === 0) return;
    setBulkRunning(true); setBulkProgress({ current: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      await enhanceOne(list[i]._id);
      setBulkProgress({ current: i + 1, total: list.length });
    }
    setBulkRunning(false);
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !replacingId) return;
    try {
      const up = await fetch('/api/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
      const upData = await up.json();
      if (!up.ok || !upData.url) throw new Error(upData.error || 'Upload failed');
      const putRes = await fetch('/api/products', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replacingId, image: upData.url }),
      });
      if (!putRes.ok) throw new Error('Could not save the new photo to this product');
      setEnhanced(en => ({ ...en, [replacingId]: upData.url }));
      setData(d => d ? { ...d, low: d.low.filter(it => it._id !== replacingId) } : d);
    } catch (e: any) {
      setEnhanceErrors(err => ({ ...err, [replacingId]: e.message || 'Upload failed' }));
    } finally {
      setReplacingId('');
      if (replaceFileRef.current) replaceFileRef.current.value = '';
    }
  };

  const Row = ({ item, children }: { item: QualityEntry; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
      <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
        {(enhanced[item._id] || item.image) ? <img src={enhanced[item._id] || item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-300" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-700 truncate">{item.name}</p>
        <p className="text-[10px] text-gray-400">{item.category || 'no category'} · {item.width}×{item.height}px</p>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionHeader icon={ZoomIn} title="Image Quality" desc="Find product photos that are low-resolution, and either sharpen them or know when to just re-shoot" />

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0"><ZoomIn className="w-5 h-5 text-blue-600" /></div>
        <div className="flex-1">
          <p className="text-sm font-black text-gray-800">Honest about what sharpening can and can't fix</p>
          <p className="text-xs text-gray-500 mt-0.5">This checks each photo's real stored resolution. Photos that are only a little soft get a free one-click sharpen. Photos that are genuinely too small are flagged separately with that said plainly — no fake "AI enhance" that can't actually invent missing detail. For those, just upload a better photo right here.</p>
        </div>
      </div>

      <button onClick={runScan} disabled={status === 'loading'}
        className="w-full py-3 bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#E04A00] transition flex items-center justify-center gap-2 disabled:opacity-50">
        {status === 'loading' ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</>) : (<><ZoomIn className="w-4 h-4" /> {data ? 'Re-scan' : 'Scan Product Photos'}</>)}
      </button>

      {error && <div className="rounded-xl p-3 text-sm font-bold text-center bg-red-50 text-red-600 border border-red-200">{error}</div>}

      {data && (
        <>
          <p className="text-[11px] text-gray-400 text-center">
            Scanned {data.totalScanned} products.
            {data.unknownCount > 0 && ` ${data.unknownCount} have a photo not hosted on Cloudinary (skipped — can't check those here).`}
            {data.noImageCount > 0 && ` ${data.noImageCount} have no photo at all.`}
          </p>

          {data.low.length === 0 && data.borderline.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400 font-bold">Every photo checked is a good resolution.</div>
          )}

          {data.borderline.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-700">Could Be Sharper <span className="text-gray-400">({data.borderline.length})</span></p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Resolution is on the low side but usable — sharpening can genuinely help here.</p>
                </div>
                <button onClick={enhanceAllBorderline} disabled={bulkRunning}
                  className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-900 transition disabled:opacity-50">
                  {bulkRunning ? `${bulkProgress.current}/${bulkProgress.total}...` : 'Enhance All'}
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {data.borderline.map(item => (
                  <Row key={item._id} item={item}>
                    {enhanced[item._id] ? (
                      <span className="text-[10px] font-black uppercase text-green-600 shrink-0">✅ Enhanced</span>
                    ) : (
                      <button onClick={() => enhanceOne(item._id)} disabled={enhancing.has(item._id)}
                        className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-orange-50 text-[#FA5600] px-3 py-1.5 rounded-lg hover:bg-orange-100 transition disabled:opacity-50">
                        {enhancing.has(item._id) ? '...' : 'Enhance'}
                      </button>
                    )}
                    {enhanceErrors[item._id] && <span className="text-[9px] text-red-500 ml-2">{enhanceErrors[item._id]}</span>}
                  </Row>
                ))}
              </div>
            </div>
          )}

          {data.low.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-black uppercase tracking-widest text-gray-700">Too Small to Fix <span className="text-gray-400">({data.low.length})</span></p>
                <p className="text-[11px] text-gray-400 mt-0.5">Sharpening won't meaningfully help at this resolution — upload a better photo instead.</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {data.low.map(item => (
                  <Row key={item._id} item={item}>
                    {enhanced[item._id] ? (
                      <span className="text-[10px] font-black uppercase text-green-600 shrink-0">✅ Replaced</span>
                    ) : (
                      <button onClick={() => { setReplacingId(item._id); replaceFileRef.current?.click(); }}
                        className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 transition flex items-center gap-1">
                        <Upload className="w-3 h-3" /> Replace
                      </button>
                    )}
                    {enhanceErrors[item._id] && <span className="text-[9px] text-red-500 ml-2">{enhanceErrors[item._id]}</span>}
                  </Row>
                ))}
              </div>
            </div>
          )}
          <input ref={replaceFileRef} type="file" accept="image/*" onChange={handleReplace} className="hidden" />
        </>
      )}
    </div>
  );
}

function BackupSection() {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const [restoreFile, setRestoreFile] = useState<any>(null);      // parsed backup JSON
  const [restoreFileName, setRestoreFileName] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmText, setConfirmText] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoreResults, setRestoreResults] = useState<Record<string, { ok: boolean; restored?: number; error?: string }> | null>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setStatus('working'); setMessage('');
    try {
      const res = await fetch('/api/products?backup=true', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Backup failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `tags-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setStatus('done'); setMessage(`✅ Backup downloaded as "${filename}". Keep it somewhere safe.`);
    } catch (e: any) {
      setStatus('error'); setMessage(e.message || 'Backup failed');
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setRestoreResults(null); setRestoreStatus('idle'); setRestoreMessage(''); setConfirmText('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const collections = Object.keys(data).filter(k => k !== '_backupMeta' && Array.isArray(data[k]));
      if (collections.length === 0) throw new Error('This file has no recognizable collections — is it a Backup export from this panel?');
      setRestoreFile(data);
      setRestoreFileName(file.name);
      setSelected(Object.fromEntries(collections.map(c => [c, true])));
    } catch (err: any) {
      setRestoreFile(null); setRestoreFileName('');
      setRestoreStatus('error'); setRestoreMessage(err.message || 'Could not read this file — is it a valid backup JSON?');
    } finally {
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  };

  const collectionsIn = (data: any) => Object.keys(data || {}).filter(k => k !== '_backupMeta' && Array.isArray(data[k]));
  const selectedCollections = collectionsIn(restoreFile).filter(c => selected[c]);

  const handleRestore = async () => {
    if (!restoreFile || selectedCollections.length === 0 || confirmText !== 'RESTORE') return;
    setRestoreStatus('working'); setRestoreMessage(''); setRestoreResults(null);
    try {
      const res = await fetch('/api/products?restore=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: restoreFile, collections: selectedCollections, confirm: 'RESTORE' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Restore failed (${res.status})`);
      setRestoreResults(data.results || {});
      const failed = Object.values(data.results || {}).filter((r: any) => !r.ok).length;
      setRestoreStatus(failed === 0 ? 'done' : 'error');
      setRestoreMessage(failed === 0 ? '✅ Restore complete.' : `⚠️ Some collections failed to restore — see details below.`);
    } catch (e: any) {
      setRestoreStatus('error'); setRestoreMessage(e.message || 'Restore failed');
    }
  };

  const resetRestore = () => {
    setRestoreFile(null); setRestoreFileName(''); setSelected({}); setConfirmText('');
    setRestoreStatus('idle'); setRestoreMessage(''); setRestoreResults(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SectionHeader icon={Database} title="Backup" desc="Download or restore your database" />

      {/* ── Backup ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0"><Database className="w-5 h-5 text-amber-600" /></div>
        <div className="flex-1">
          <p className="text-sm font-black text-gray-800">Take a backup before doing anything risky</p>
          <p className="text-xs text-gray-500 mt-0.5">This downloads a single JSON file with every product, order, customer and other record currently in the database — nothing is changed on the server. Do this before a bulk import, a bulk price change, or any other change you might need to undo.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <button onClick={handleBackup} disabled={status === 'working'}
          className="w-full py-3 bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#E04A00] transition flex items-center justify-center gap-2 disabled:opacity-50">
          {status === 'working' ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Preparing backup...</>) : (<><Download className="w-4 h-4" /> Download Full Backup</>)}
        </button>

        {message && <div className={`rounded-xl p-3 text-sm font-bold text-center ${status === 'done' ? 'bg-green-50 text-green-700 border border-green-200' : status === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{message}</div>}
      </div>

      {/* ── Restore ── */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0"><RefreshCw className="w-5 h-5 text-red-600" /></div>
        <div className="flex-1">
          <p className="text-sm font-black text-gray-800">Restore — replaces live data</p>
          <p className="text-xs text-gray-500 mt-0.5">Restoring a collection deletes what's currently in it and replaces it with the backup's copy. This cannot be undone unless you take a fresh backup first. Only choose the collections you actually need to roll back.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        {!restoreFile ? (
          <div onClick={() => restoreFileRef.current?.click()} className="border-2 border-dashed border-gray-200 hover:border-red-400 rounded-2xl p-8 text-center cursor-pointer transition group">
            <Upload className="w-8 h-8 text-gray-300 group-hover:text-red-400 mx-auto mb-2 transition" />
            <p className="font-black text-sm text-gray-700 uppercase tracking-widest">Click to Choose a Backup File</p>
            <p className="text-xs text-gray-400 mt-1">A .json file downloaded from this Backup tab</p>
            <input ref={restoreFileRef} type="file" accept=".json,application/json" onChange={handleRestoreFile} className="hidden" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-gray-700 truncate">{restoreFileName}</p>
              <button onClick={resetRestore} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 shrink-0 ml-2">Choose a different file</button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto border border-gray-100 rounded-xl p-3">
              {collectionsIn(restoreFile).map(c => (
                <label key={c} className="flex items-center gap-2 text-xs font-bold text-gray-700">
                  <input type="checkbox" checked={!!selected[c]} onChange={e => setSelected(sel => ({ ...sel, [c]: e.target.checked }))}
                    className="w-4 h-4 accent-red-500" disabled={restoreStatus === 'working'} />
                  {c} <span className="text-gray-400 font-normal">({restoreFile[c].length} docs)</span>
                </label>
              ))}
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500">Type RESTORE to confirm</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} disabled={restoreStatus === 'working'}
                placeholder="RESTORE" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <button onClick={handleRestore} disabled={restoreStatus === 'working' || selectedCollections.length === 0 || confirmText !== 'RESTORE'}
              className="w-full py-3 bg-red-600 text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {restoreStatus === 'working' ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Restoring...</>) : (<><RefreshCw className="w-4 h-4" /> Restore {selectedCollections.length} Collection{selectedCollections.length === 1 ? '' : 's'}</>)}
            </button>
          </>
        )}

        {restoreMessage && <div className={`rounded-xl p-3 text-sm font-bold text-center ${restoreStatus === 'done' ? 'bg-green-50 text-green-700 border border-green-200' : restoreStatus === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{restoreMessage}</div>}

        {restoreResults && (
          <div className="space-y-1">
            {Object.entries(restoreResults).map(([name, r]) => (
              <div key={name} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                <span>{r.ok ? '✅' : '❌'}</span><span className="flex-1 truncate">{name}</span>
                <span className="text-[10px] opacity-70">{r.ok ? `${r.restored} docs restored` : r.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cleanup Section ──────────────────────────────────────────────────────
type AuditGroup = 'orphanInventory' | 'noActivityProducts' | 'badPriceProducts';

// Defined OUTSIDE CleanupSection on purpose: a component declared inside another component's body
// gets recreated on every render, which makes React unmount + remount this whole list on every
// click (losing scroll position in the process). Declaring it here once avoids that entirely.
function CleanupGroup({ group, title, desc, items, selected, toggle, selectAll, render }: {
  group: AuditGroup; title: string; desc: string; items: any[];
  selected: Record<AuditGroup, Set<string>>;
  toggle: (group: AuditGroup, id: string) => void;
  selectAll: (group: AuditGroup, ids: string[], checked: boolean) => void;
  render: (item: any) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  const ids = items.map((it: any) => it._id);
  const allSelected = ids.length > 0 && ids.every((id: string) => selected[group].has(id));
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-700">{title} <span className="text-gray-400">({items.length})</span></p>
          <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 cursor-pointer shrink-0">
          <input type="checkbox" checked={allSelected} onChange={e => selectAll(group, ids, e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
          Select All
        </label>
      </div>
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {items.map((item: any) => (
          <label key={item._id} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-gray-700 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={selected[group].has(item._id)} onChange={() => toggle(group, item._id)} className="w-4 h-4 accent-red-500 shrink-0" />
            <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
              {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-300" />}
            </div>
            {render(item)}
          </label>
        ))}
      </div>
    </div>
  );
}

function CleanupSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [backupNote, setBackupNote] = useState('');
  const [data, setData] = useState<{ orphanInventory: any[]; noActivityProducts: any[]; badPriceProducts: any[] } | null>(null);
  const [selected, setSelected] = useState<Record<AuditGroup, Set<string>>>({ orphanInventory: new Set(), noActivityProducts: new Set(), badPriceProducts: new Set() });
  const [confirmText, setConfirmText] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [deleteMessage, setDeleteMessage] = useState('');

  // A fresh full backup is taken and downloaded automatically before every scan, so there's
  // always a safety copy on hand before anything from Cleanup could get deleted. If the backup
  // itself fails, the scan is cancelled rather than proceeding without one.
  const runAudit = async () => {
    setStatus('loading'); setError(''); setBackupNote(''); setDeleteMessage(''); setDeleteStatus('idle');
    try {
      setProgressLabel('Taking a safety backup...');
      const bkRes = await fetch('/api/products?backup=true', { method: 'POST' });
      if (!bkRes.ok) {
        const err = await bkRes.json().catch(() => ({}));
        throw new Error(err.error || `Safety backup failed (${bkRes.status}) — scan cancelled so nothing gets deleted without one.`);
      }
      const blob = await bkRes.blob();
      const disposition = bkRes.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `tags-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setBackupNote(`✅ Safety backup "${filename}" downloaded.`);

      setProgressLabel('Scanning for junk data...');
      const res = await fetch('/api/products?audit=true');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Scan failed (${res.status})`);
      setData(json);
      setSelected({ orphanInventory: new Set(), noActivityProducts: new Set(), badPriceProducts: new Set() });
      setConfirmText('');
      setStatus('ready');
    } catch (e: any) {
      setError(e.message || 'Scan failed'); setStatus('error');
    } finally {
      setProgressLabel('');
    }
  };

  const toggle = (group: AuditGroup, id: string) => setSelected(sel => {
    const next = new Set(sel[group]);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...sel, [group]: next };
  });

  const totalSelected = selected.orphanInventory.size + selected.noActivityProducts.size + selected.badPriceProducts.size;

  const handleDelete = async () => {
    if (totalSelected === 0 || confirmText !== 'DELETE') return;
    setDeleteStatus('working'); setDeleteMessage('');
    try {
      const inventoryIds = Array.from(selected.orphanInventory);
      const productIds = [...selected.noActivityProducts, ...selected.badPriceProducts].filter((v, i, a) => a.indexOf(v) === i);
      const res = await fetch('/api/products?auditDelete=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryIds, productIds, confirm: 'DELETE' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Delete failed (${res.status})`);
      setDeleteStatus('done');
      setDeleteMessage(`✅ Deleted ${json.results.inventoryDeleted} inventory record(s) and ${json.results.productsDeleted} product(s).${json.results.errors?.length ? ' Some items had errors — check console.' : ''}`);
      runAudit(); // refresh the lists so deleted items disappear
    } catch (e: any) {
      setDeleteStatus('error'); setDeleteMessage(e.message || 'Delete failed');
    }
  };

  const selectAll = (group: AuditGroup, ids: string[], checked: boolean) =>
    setSelected(sel => ({ ...sel, [group]: checked ? new Set(ids) : new Set() }));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SectionHeader icon={Trash2} title="Cleanup" desc="Find and remove junk or orphaned data — nothing deletes until you say so" />

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-blue-600" /></div>
        <div className="flex-1">
          <p className="text-sm font-black text-gray-800">Take a backup first</p>
          <p className="text-xs text-gray-500 mt-0.5">This scan is read-only — it only lists candidates. But once you delete, it's permanent. Use the Backup tab first if you're not fully sure.</p>
        </div>
      </div>

      <button onClick={runAudit} disabled={status === 'loading'}
        className="w-full py-3 bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#E04A00] transition flex items-center justify-center gap-2 disabled:opacity-50">
        {status === 'loading' ? (<><RefreshCw className="w-4 h-4 animate-spin" /> {progressLabel || 'Working...'}</>) : (<><RefreshCw className="w-4 h-4" /> {data ? 'Re-scan (takes a fresh backup too)' : 'Scan for Junk Data'}</>)}
      </button>
      <p className="text-[11px] text-gray-400 text-center -mt-2">Every scan automatically downloads a full backup first, before showing any results.</p>

      {backupNote && <div className="rounded-xl p-3 text-sm font-bold text-center bg-green-50 text-green-700 border border-green-200">{backupNote}</div>}
      {error && <div className="rounded-xl p-3 text-sm font-bold text-center bg-red-50 text-red-600 border border-red-200">{error}</div>}

      {data && (
        <>
          <CleanupGroup group="orphanInventory" title="Orphaned Inventory Records" items={data.orphanInventory} selected={selected} toggle={toggle} selectAll={selectAll}
            desc={`Stock entries pointing at a product that no longer exists — these are what show up as "Unknown / ₹0" in Stock Visibility.`}
            render={(item) => <span>Inventory record <span className="text-gray-400 font-normal">· productId {item.productId} · stock {item.stock}</span></span>} />

          <CleanupGroup group="noActivityProducts" title="Products With No Activity" items={data.noActivityProducts} selected={selected} toggle={toggle} selectAll={selectAll}
            desc="Never sold, never shared, never on a purchase order. Not proof no one added it on purpose — review each before deleting."
            render={(item) => <span>{item.name} <span className="text-gray-400 font-normal">· {item.category || 'no category'} · ₹{item.price}</span></span>} />

          <CleanupGroup group="badPriceProducts" title="Products With Missing/Zero Price" items={data.badPriceProducts} selected={selected} toggle={toggle} selectAll={selectAll}
            desc="Price resolves to 0 or isn't a real number — this is also why a product can silently disappear from a low→high price sort."
            render={(item) => <span>{item.name} <span className="text-gray-400 font-normal">· original {item.originalPrice ?? '—'} · discounted {item.discountedPrice ?? '—'}</span></span>} />

          {data.orphanInventory.length === 0 && data.noActivityProducts.length === 0 && data.badPriceProducts.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400 font-bold">Nothing found — your data looks clean.</div>
          )}

          {totalSelected > 0 && (
            <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm space-y-3">
              <p className="text-xs font-black text-gray-700">{totalSelected} item(s) selected for permanent deletion.</p>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} disabled={deleteStatus === 'working'}
                placeholder="Type DELETE to confirm" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              <button onClick={handleDelete} disabled={deleteStatus === 'working' || confirmText !== 'DELETE'}
                className="w-full py-3 bg-red-600 text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                {deleteStatus === 'working' ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Deleting...</>) : (<><Trash2 className="w-4 h-4" /> Delete {totalSelected} Selected Item(s)</>)}
              </button>
              {deleteMessage && <div className={`rounded-xl p-3 text-sm font-bold text-center ${deleteStatus === 'done' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>{deleteMessage}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ImportProductsSection() {
  const [mode, setMode] = useState<'csv' | 'invoice'>('invoice');
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
      <SectionHeader icon={Upload} title="Import Products" desc="Bulk import via CSV, or auto-fill from a supplier invoice" />

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setMode('invoice')} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest py-2.5 rounded-lg transition ${mode === 'invoice' ? 'bg-white text-[#FA5600] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <Sparkles className="w-3.5 h-3.5" /> Invoice (AI)
        </button>
        <button onClick={() => setMode('csv')} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest py-2.5 rounded-lg transition ${mode === 'csv' ? 'bg-white text-[#FA5600] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <Upload className="w-3.5 h-3.5" /> CSV File
        </button>
      </div>

      {mode === 'invoice' && <InvoiceImportSection />}

      {mode === 'csv' && <>
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
      </>}
    </div>
  );
}

// ── Invoice Import (AI) ──────────────────────────────────────────────────
// Upload a supplier invoice (PDF or photo). Gemini reads the line items and crops each item's
// own real photo straight out of the invoice page — no AI-generated pictures. If an item has no
// photo on the invoice (and no match on the optional supplier site), it's left for you to add
// a picture yourself from the viewer (paste a link from the supplier, or any photo URL).
// Everything lands in an editable table for review before the actual import.
type InvoiceRow = {
  id: string;
  name: string; description: string; quantity: number | null; unitCost: number | null;
  category: string; subcategory: string; originalPrice: string; discountedPrice: string;
  imagePrompt: string;
  matchedTitle: string; descStatus: 'idle' | 'loading' | 'done' | 'error'; descError: string;
  imageUrl: string; imageSource: 'invoice' | 'supplier' | 'link' | 'ai' | ''; imageStatus: 'pending' | 'loading' | 'done' | 'error';
  include: boolean;
};

// Selling prices are derived from the invoice unit cost: cost + 60% (original) and cost + 35% (discounted)
const INVOICE_ORIGINAL_MARKUP = 0.60;
const INVOICE_DISCOUNTED_MARKUP = 0.35;

function InvoiceImportSection() {
  const [stage, setStage] = useState<'idle' | 'reading' | 'review' | 'importing' | 'done'>('idle');
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState('');
  const [allCats, setAllCats] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  // Supplier website for this import (optional). Recent ones are remembered so they're one click next time.
  const [supplierSite, setSupplierSite] = useState('');
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([]);
  useEffect(() => {
    try { setRecentSuppliers(JSON.parse(localStorage.getItem('tags_invoice_suppliers') || '[]')); } catch {}
  }, []);
  const normalizeSite = (v: string) => { const s = v.trim(); return !s ? '' : /^https?:\/\//i.test(s) ? s : `https://${s}`; };
  const rememberSupplier = (site: string) => {
    try {
      const next = [site, ...recentSuppliers.filter(x => x !== site)].slice(0, 8);
      setRecentSuppliers(next); localStorage.setItem('tags_invoice_suppliers', JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(data => {
      setAllCats(Array.isArray(data) ? data : (data.categories || []));
    }).catch(() => {});
  }, []);

  // Main categories have no parentId; subcategories point at their parent's _id
  const mainCats = allCats.filter((c: any) => !c.parentId);
  const subsFor = (categoryName: string): string[] => {
    const parent = mainCats.find((c: any) => (c.name || '').toLowerCase() === categoryName.trim().toLowerCase());
    if (!parent) return [];
    return allCats.filter((c: any) => c.parentId && String(c.parentId) === String(parent._id)).map((c: any) => c.name).filter(Boolean);
  };

  // Writes a shop-ready description from the item's name + its final picture (editable afterwards)
  const fetchDescriptionFor = async (row: InvoiceRow) => {
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, descStatus: 'loading' } : r));
    try {
      const res = await fetch('/api/products?invoiceDescription=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: row.name, hint: row.description, imageUrl: row.imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.description) throw new Error(data.error || `Server error (${res.status})`);
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, description: data.description, descStatus: 'done', descError: '' } : r));
    } catch (e: any) {
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, descStatus: 'error', descError: e?.message || 'failed' } : r)); // keeps whatever description it had
    }
  };

  // Writes all descriptions in ONE request per 8 items, once every picture has finished (saves free-tier quota)
  const descBatchRunning = useRef(false);
  useEffect(() => {
    if (stage !== 'review' || descBatchRunning.current) return;
    if (rows.length === 0 || !rows.every(r => r.imageStatus === 'done' || r.imageStatus === 'error')) return;
    const todo = rows.filter(r => r.descStatus === 'idle' && r.name.trim());
    if (todo.length === 0) return;
    descBatchRunning.current = true;
    const ids = new Set(todo.map(r => r.id));
    setRows(rs => rs.map(r => ids.has(r.id) ? { ...r, descStatus: 'loading' } : r));
    (async () => {
      for (let i = 0; i < todo.length; i += 8) {
        const chunk = todo.slice(i, i + 8);
        try {
          const res = await fetch('/api/products?invoiceDescriptions=true', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: chunk.map(r => ({ id: r.id, name: r.name, hint: r.description, imageUrl: r.imageUrl })) }),
          });
          const data = await res.json().catch(() => ({}));
          const map: Record<string, string> = res.ok ? (data.descriptions || {}) : {};
          const why = res.ok ? 'The AI did not return a description for this item' : (data.error || `Server error (${res.status})`);
          setRows(rs => rs.map(r => chunk.some(c => c.id === r.id)
            ? (map[r.id] ? { ...r, description: map[r.id], descStatus: 'done', descError: '' } : { ...r, descStatus: 'error', descError: why })
            : r));
        } catch (e: any) {
          setRows(rs => rs.map(r => chunk.some(c => c.id === r.id) ? { ...r, descStatus: 'error', descError: e?.message || 'Network error' } : r));
        }
      }
      descBatchRunning.current = false;
    })();
  }, [rows, stage]);

  // ── Picture viewer: see the picture large, or replace it with a link to a better one ──
  const [viewId, setViewId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [cleanText, setCleanText] = useState(true);
  const [applying, setApplying] = useState(false);
  const [viewMsg, setViewMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [viewSize, setViewSize] = useState('');
  const viewRow = rows.find(r => r.id === viewId) || null;
  const openViewer = (id: string) => { setViewId(id); setLinkInput(''); setViewMsg(null); setViewSize(''); };

  // link = a new link to use; omit it to only clean the picture that is already there
  const applyPicture = async (row: InvoiceRow, link: string) => {
    if (!link.trim()) return;
    setApplying(true); setViewMsg(null);
    try {
      const res = await fetch('/api/products?imageFromLink=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.trim(), name: row.name, clean: cleanText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.imageUrl) throw new Error(data.error || 'Could not use that picture');
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, imageUrl: data.imageUrl, imageSource: 'link', imageStatus: 'done' } : r));
      setViewMsg({ ok: true, text: data.cleaned ? 'Picture replaced and cleaned of text.' : (data.note || 'Picture replaced.') });
      setLinkInput('');
      setViewSize('');
    } catch (e: any) {
      setViewMsg({ ok: false, text: e.message || 'Something went wrong' });
    } finally {
      setApplying(false);
    }
  };

  // Looks each item up on the supplier's website. Found → that photo replaces the invoice crop.
  // Not found → keep the invoice crop if there is one, otherwise it's left for you to add manually.
  const fetchSupplierImages = async (list: InvoiceRow[], site: string) => {
    const queue = [...list];
    const worker = async () => {
      let item;
      while ((item = queue.shift())) {
        const it = item;
        setRows(rs => rs.map(r => r.id === it.id ? { ...r, imageStatus: 'loading' } : r));
        try {
          const r = await fetch('/api/products?supplierImage=true', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: it.name, siteUrl: site }),
          });
          const data = await r.json().catch(() => ({}));
          if (data.found && data.imageUrl) {
            setRows(rs => rs.map(row => row.id === it.id ? { ...row, imageUrl: data.imageUrl, imageSource: 'supplier', matchedTitle: data.matchedTitle || '', imageStatus: 'done' } : row));
            continue;
          }
        } catch {}
        setRows(rs => rs.map(row => row.id === it.id ? { ...row, imageStatus: row.imageUrl ? 'done' : 'error' } : row));
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setError(''); setRows([]); setImportResults([]); setStage('reading');
    try {
      const buf = await file.arrayBuffer();
      // window.btoa can't handle large binary strings in one go — build the base64 in chunks
      const bytes = new Uint8Array(buf);
      let binary = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      const fileBase64 = btoa(binary);
      const res = await fetch('/api/products?invoiceExtract=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, mimeType: file.type || 'application/pdf' }),
      });
      // The server can return a plain-text page (e.g. a Vercel timeout), so don't assume JSON
      const raw = await res.text();
      let data: any = {};
      try { data = JSON.parse(raw); } catch { throw new Error(res.status === 504 || /TIMEOUT/i.test(raw) ? 'The server timed out while reading the invoice. Please try again.' : `Server error (${res.status}). Please try again.`); }
      if (!res.ok) throw new Error(data.error || 'Could not read this invoice');
      const newRows: InvoiceRow[] = (data.items || []).map((it: any, i: number) => ({
        id: `${Date.now()}-${i}`,
        name: it.name || '', description: it.description || '',
        quantity: it.quantity, unitCost: it.unitCost,
        imagePrompt: it.imagePrompt || it.name || '',
        category: '', subcategory: '',
        originalPrice: it.unitCost ? String(Math.round(it.unitCost * (1 + INVOICE_ORIGINAL_MARKUP))) : '',
        discountedPrice: it.unitCost ? String(Math.round(it.unitCost * (1 + INVOICE_DISCOUNTED_MARKUP))) : '',
        matchedTitle: '', descStatus: 'idle', descError: '',
        imageUrl: it.imageUrl || '', imageSource: it.imageSource || '',
        imageStatus: it.imageUrl ? 'done' : 'pending', include: true,
      }));
      setRows(newRows);
      setStage('review');
      const site = normalizeSite(supplierSite);
      if (site) {
        rememberSupplier(site);
        fetchSupplierImages(newRows, site); // supplier photo first, keep the invoice crop otherwise
      } else {
        // No supplier site given — items with no real invoice photo are left for you to add one manually
        setRows(rs => rs.map(r => r.imageUrl ? r : { ...r, imageStatus: 'error' }));
      }
    } catch (e: any) {
      setError(e.message || 'Could not read this invoice'); setStage('idle');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateRow = (id: string, patch: Partial<InvoiceRow>) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeRow = (id: string) => setRows(rs => rs.filter(r => r.id !== id));

  const saveRow = async (row: InvoiceRow) => {
    const payload = {
      name: row.name, category: row.category, subcategory: row.subcategory,
      originalPrice: row.originalPrice, discountedPrice: row.discountedPrice,
      description: row.description, videoUrl: '',
      imageUrl: row.imageUrl, image: row.imageUrl, imageUrls: row.imageUrl ? [row.imageUrl] : [],
    };
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  };

  const handleImportAll = async () => {
    const wanted = rows.filter(r => r.include);
    const missingCategory = wanted.find(r => !r.category.trim());
    if (missingCategory) { setError(`"${missingCategory.name}" needs a category before importing.`); return; }
    setError(''); setStage('importing'); setImportProgress({ current: 0, total: wanted.length });
    const results: { name: string; ok: boolean; error?: string }[] = [];
    for (let i = 0; i < wanted.length; i++) {
      try { await saveRow(wanted[i]); results.push({ name: wanted[i].name, ok: true }); }
      catch (e: any) { results.push({ name: wanted[i].name, ok: false, error: e.message }); }
      setImportProgress({ current: i + 1, total: wanted.length });
      setImportResults([...results]);
    }
    setStage('done');
  };

  const reset = () => { setRows([]); setStage('idle'); setError(''); setImportResults([]); };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0"><Wand2 className="w-5 h-5 text-purple-600" /></div>
        <div className="flex-1">
          <p className="text-sm font-black text-gray-800">Import from a Supplier Invoice</p>
          <p className="text-xs text-gray-500 mt-0.5">Upload the invoice (PDF or photo). Add the supplier's website to pull each item's high-quality photo from it. Otherwise we crop the invoice photo, or generate a free AI image if the invoice has none. You verify everything below before importing.</p>
        </div>
      </div>

      {stage === 'idle' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <label className="block mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Supplier website (optional)</span>
            <input value={supplierSite} onChange={e => setSupplierSite(e.target.value)} list="invoice-suppliers" placeholder="e.g. suppliername.com"
              className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FA5600]" />
            <span className="block text-[11px] text-gray-400 mt-1">If this supplier has a website, each item is searched there and its high-quality product photo is used. Leave empty to use the invoice photos.</span>
            <datalist id="invoice-suppliers">{recentSuppliers.map(s => <option key={s} value={s} />)}</datalist>
          </label>
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-200 hover:border-[#FA5600] rounded-2xl p-10 text-center cursor-pointer transition group">
            <FileText className="w-10 h-10 text-gray-300 group-hover:text-[#FA5600] mx-auto mb-3 transition" />
            <p className="font-black text-sm text-gray-700 uppercase tracking-widest">Click to Upload Invoice</p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPEG or PNG</p>
            <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleFile} className="hidden" />
          </div>
          {error && <div className="mt-3 rounded-xl p-3 text-sm font-bold text-center bg-red-50 text-red-600 border border-red-200">{error}</div>}
        </div>
      )}

      {stage === 'reading' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 shadow-sm text-center">
          <RefreshCw className="w-8 h-8 text-[#FA5600] mx-auto mb-3 animate-spin" />
          <p className="font-black text-sm text-gray-700">Reading the invoice…</p>
          <p className="text-xs text-gray-400 mt-1">This can take up to a minute for a long invoice.</p>
        </div>
      )}

      {(stage === 'review' || stage === 'importing' || stage === 'done') && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-gray-500">{rows.length} item{rows.length === 1 ? '' : 's'} found — verify before importing</p>
            {stage === 'review' && <button onClick={reset} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#FA5600]">Start over</button>}
          </div>

          <div className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
            {rows.map(row => (
              <div key={row.id} className="p-4 flex gap-3">
                <input type="checkbox" checked={row.include} onChange={e => updateRow(row.id, { include: e.target.checked })} className="mt-1.5 w-4 h-4 accent-[#FA5600] shrink-0" disabled={stage !== 'review'} />

                <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 shrink-0 relative overflow-hidden cursor-pointer"
                  onClick={() => openViewer(row.id)} title={row.imageUrl ? 'Click to view large / replace' : 'Click to add a picture'}>
                  {row.imageStatus === 'loading' && <div className="w-full h-full flex items-center justify-center"><RefreshCw className="w-4 h-4 text-gray-300 animate-spin" /></div>}
                  {row.imageStatus === 'error' && !row.imageUrl && <div className="w-full h-full flex items-center justify-center text-red-400 text-[9px] font-bold text-center px-1">No photo<br/>— add one</div>}
                  {row.imageUrl && <img src={row.imageUrl} alt={row.name} className="w-full h-full object-cover" />}
                  {row.imageSource && (
                    <span className={`absolute bottom-0 left-0 right-0 text-[7px] font-black uppercase tracking-wider text-center py-0.5 ${row.imageSource === 'supplier' || row.imageSource === 'link' ? 'bg-blue-600/90 text-white' : row.imageSource === 'invoice' ? 'bg-green-600/90 text-white' : 'bg-purple-500/90 text-white'}`}>
                      {row.imageSource === 'supplier' ? 'From supplier' : row.imageSource === 'link' ? 'From link' : row.imageSource === 'invoice' ? 'From invoice' : 'AI approx.'}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                  <input value={row.name} onChange={e => updateRow(row.id, { name: e.target.value })} disabled={stage !== 'review'}
                    placeholder="Product name" className="col-span-2 text-xs font-black text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 disabled:bg-gray-50" />
                  <input value={row.category} onChange={e => updateRow(row.id, { category: e.target.value, subcategory: '' })} disabled={stage !== 'review'} list="invoice-cats"
                    placeholder="Category *" className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 disabled:bg-gray-50" />
                  <input value={row.subcategory} onChange={e => updateRow(row.id, { subcategory: e.target.value })} disabled={stage !== 'review'} list={`invoice-subs-${row.id}`}
                    placeholder="Subcategory" className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 disabled:bg-gray-50" />
                  <input value={row.originalPrice} onChange={e => updateRow(row.id, { originalPrice: e.target.value })} disabled={stage !== 'review'}
                    placeholder="Selling price *" className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 disabled:bg-gray-50" />
                  <input value={row.discountedPrice} onChange={e => updateRow(row.id, { discountedPrice: e.target.value })} disabled={stage !== 'review'}
                    placeholder="Discounted price" className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 disabled:bg-gray-50" />
                  <p className="col-span-2 text-[10px] text-gray-400">
                    {row.quantity != null && <>Qty {row.quantity} · </>}
                    {row.unitCost != null && <>Cost ₹{row.unitCost} · </>}
                    Prices are cost + 60% (original) and cost + 35% (discounted) — edit as needed.
                  </p>
                  {row.matchedTitle && <p className="col-span-2 text-[10px] text-blue-600">Supplier match: {row.matchedTitle}</p>}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Description{row.descStatus === 'loading' ? ' — writing…' : row.descStatus === 'error' ? ' — could not write, edit manually' : ''}
                      </span>
                      {stage === 'review' && (
                        <button type="button" disabled={row.descStatus === 'loading'} onClick={() => fetchDescriptionFor(row)}
                          className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#FA5600] disabled:opacity-50">Rewrite</button>
                      )}
                    </div>
                    {row.descStatus === 'error' && row.descError && <p className="text-[10px] text-red-500 mb-1 normal-case">Reason: {row.descError.slice(0, 220)}</p>}
                    <textarea value={row.description} onChange={e => updateRow(row.id, { description: e.target.value })} disabled={stage !== 'review'} rows={3}
                      placeholder="Product description" className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 disabled:bg-gray-50 resize-y" />
                  </div>
                </div>

                {stage === 'review' && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => removeRow(row.id)} title="Remove this item" className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-red-500 hover:text-white text-gray-500 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <datalist id="invoice-cats">{mainCats.map((c: any) => <option key={c._id || c.name} value={c.name} />)}</datalist>
          {rows.map(row => (
            <datalist key={row.id} id={`invoice-subs-${row.id}`}>{subsFor(row.category).map(s => <option key={s} value={s} />)}</datalist>
          ))}

          <div className="p-4 border-t border-gray-100 space-y-3">
            {error && <div className="rounded-xl p-3 text-sm font-bold text-center bg-red-50 text-red-600 border border-red-200">{error}</div>}

            {stage === 'importing' && (
              <div>
                <div className="flex justify-between text-xs font-black text-gray-500 mb-1"><span>Importing... {importProgress.current} / {importProgress.total}</span></div>
                <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-[#FA5600] h-3 rounded-full transition-all" style={{ width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%` }} /></div>
              </div>
            )}

            {importResults.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {importResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    <span>{r.ok ? '✅' : '❌'}</span><span className="flex-1 truncate">{r.name}</span>
                    {r.error && <span className="text-[10px] opacity-70">{r.error}</span>}
                  </div>
                ))}
              </div>
            )}

            {stage === 'review' && (
              <button onClick={handleImportAll} disabled={rows.filter(r => r.include).length === 0}
                className="w-full py-3 bg-[#FA5600] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#E04A00] transition flex items-center justify-center gap-2 disabled:opacity-50">
                <Upload className="w-4 h-4" /> Import {rows.filter(r => r.include).length} Product{rows.filter(r => r.include).length === 1 ? '' : 's'}
              </button>
            )}
            {stage === 'done' && (
              <button onClick={reset} className="w-full py-3 border-2 border-gray-200 text-gray-600 font-black uppercase tracking-widest text-sm rounded-xl hover:border-[#FA5600] hover:text-[#FA5600] transition">
                Import Another Invoice
              </button>
            )}
          </div>
        </div>
      )}

      {viewRow && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => !applying && setViewId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-gray-700 truncate">{viewRow.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {viewRow.imageSource === 'invoice' ? 'Cropped from the invoice' : viewRow.imageSource === 'link' ? 'From a link you pasted' : viewRow.imageSource === 'supplier' ? 'From the supplier website' : viewRow.imageSource === 'ai' ? 'AI-generated (older import)' : 'No picture yet — paste a link below'}
                  {viewSize && <> · {viewSize}</>}
                </p>
              </div>
              <button onClick={() => setViewId(null)} disabled={applying} className="text-gray-400 hover:text-gray-700 text-lg leading-none disabled:opacity-40">✕</button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden" style={{ minHeight: 200 }}>
                {viewRow.imageUrl
                  ? <img src={viewRow.imageUrl} alt={viewRow.name} className="max-h-[50vh] w-auto max-w-full object-contain"
                      onLoad={e => { const im = e.currentTarget; setViewSize(`${im.naturalWidth} × ${im.naturalHeight} px`); }} />
                  : <p className="text-xs text-gray-400 py-16">No picture yet</p>}
              </div>
              <p className="text-[11px] text-gray-400 -mt-2">If it looks blurry or small (low pixel size), replace it with a better picture from the supplier below.</p>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Better picture link</span>
                <input value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="Paste the image link (or product page link) from the supplier's site"
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FA5600]" disabled={applying} />
                <p className="text-[10px] text-gray-400">Tip: on the supplier's site, right-click the photo and choose "Copy image address".</p>
                <label className="flex items-start gap-2 text-[11px] text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={cleanText} onChange={e => setCleanText(e.target.checked)} className="mt-0.5 accent-[#FA5600]" disabled={applying} />
                  <span>Remove the wholesaler's text, captions and logos with AI <span className="text-gray-400">(needs Google's image model — may not work on the free plan; the picture is then used as it is)</span></span>
                </label>
                <button onClick={() => applyPicture(viewRow, linkInput)} disabled={applying || !linkInput.trim()}
                  className="w-full py-2.5 bg-[#FA5600] text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#E04A00] transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {applying ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Working…</> : 'Use this picture'}
                </button>
                {viewRow.imageUrl && (
                  <button onClick={() => applyPicture(viewRow, viewRow.imageUrl)} disabled={applying}
                    className="w-full py-2 border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:border-[#FA5600] hover:text-[#FA5600] transition disabled:opacity-50">
                    Only remove text from the current picture
                  </button>
                )}
                {viewMsg && <p className={`text-[11px] font-bold ${viewMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{viewMsg.text}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
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



// ── Share history (what was already broadcast, and when) ───────────────────
type ShareInfo = { lastAt: string; channel: string; count: number };
type ShareGuard = (ids: string[], action: () => void, opts?: { onlyNew?: (newIds: string[]) => void }) => void;
type OnShared = (ids: string[], channel: string) => void;

// A shared product lives in the "Shared" tab for 15 days after its LAST share,
// then it automatically goes back to "To Share".
const RECENT_SHARE_DAYS = 15;
const SHARE_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', 'whatsapp-status': 'WhatsApp Status', telegram: 'Telegram', instagram: 'Instagram story', facebook: 'Facebook story',
  'whatsapp-video': 'WhatsApp video', 'telegram-video': 'Telegram video', 'instagram-reel': 'Instagram Reel', 'facebook-reel': 'Facebook Reel',
  'instagram-video-story': 'Instagram video story', 'facebook-video-story': 'Facebook video story',
};

// calendar-day difference (0 = today), in the viewer's local time
const shareDaysAgo = (iso: string) => {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(iso); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};
const isRecentShare = (info?: ShareInfo) => !!info && shareDaysAgo(info.lastAt) < RECENT_SHARE_DAYS;
const shareLocalDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shareBackInLabel = (iso: string) => {
  const left = RECENT_SHARE_DAYS - shareDaysAgo(iso);
  return left <= 1 ? 'back in To Share tomorrow' : `back in To Share in ${left} days`;
};
const shareDateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const shareAgoLabel = (iso: string) => {
  const d = shareDaysAgo(iso);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

function ShareBadge({ info }: { info?: ShareInfo }) {
  if (!info) return null;
  const d = shareDaysAgo(info.lastAt);
  const tone = d <= 0 ? 'bg-green-100 text-green-700' : isRecentShare(info) ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400';
  return (
    <span title={`Last shared on ${SHARE_CHANNEL_LABELS[info.channel] || info.channel} · ${info.count}× in the last 90 days`}
      className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${tone}`}>
      <Check className="w-2.5 h-2.5" />{d <= 0 ? 'Shared today' : `Shared ${shareDateLabel(info.lastAt)}`}
    </span>
  );
}

// Asks for confirmation when a product was already shared within the last month.
// "Share anyway" runs the action from this button's own click, so phone share sheets still work.
function ShareGuardModal({ hits, onConfirm, onOnlyNew, onCancel }: {
  hits: { id: string; name: string; info: ShareInfo }[];
  onConfirm: () => void; onOnlyNew?: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 bg-orange-50 border-b border-orange-100">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-[#FA5600]" /></div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Already shared recently</h3>
            <p className="text-[11px] text-gray-500 font-bold">
              {hits.length === 1 ? 'This product was' : `${hits.length} of these products were`} shared within the last {RECENT_SHARE_DAYS} days.
            </p>
          </div>
        </div>
        <ul className="max-h-56 overflow-y-auto divide-y divide-gray-50">
          {hits.map(h => (
            <li key={h.id} className="px-4 py-2.5">
              <p className="font-black text-xs text-gray-900 truncate">{h.name}</p>
              <p className="text-[10px] text-gray-500 font-bold">
                {SHARE_CHANNEL_LABELS[h.info.channel] || h.info.channel} · {shareDateLabel(h.info.lastAt)} ({shareAgoLabel(h.info.lastAt)})
                {h.info.count > 1 ? ` · ${h.info.count}× in 90 days` : ''}
              </p>
            </li>
          ))}
        </ul>
        <div className="p-3 border-t border-gray-100 flex flex-col gap-2">
          <button onClick={onConfirm}
            className="w-full bg-[#FA5600] text-white font-black py-2.5 rounded-xl hover:bg-[#e04d00] transition text-xs uppercase tracking-widest">Share anyway</button>
          {onOnlyNew && (
            <button onClick={onOnlyNew}
              className="w-full bg-gray-800 text-white font-black py-2.5 rounded-xl hover:bg-gray-900 transition text-xs uppercase tracking-widest">Only the ones not shared recently</button>
          )}
          <button onClick={onCancel}
            className="w-full border-2 border-gray-200 text-gray-600 font-black py-2 rounded-xl hover:bg-gray-50 transition text-xs uppercase tracking-widest">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Story Composer (Instagram / Facebook / WhatsApp Status) ────────────────
// Renders a 1080×1920 (9:16) story image on a canvas, then either:
//   • posts it to Instagram + Facebook Page stories via /api/products (Meta Graph API), or
//   • hands it to the phone's share sheet so it can go to WhatsApp Status (no official API exists).
type StoryTheme = 'brand' | 'dark' | 'light';

const STORY_W = 1080;
const STORY_H = 1920;

const STORY_THEMES: Record<StoryTheme, {
  label: string; bg: [string, string]; text: string; sub: string; accent: string; ctaBg: string; ctaText: string;
}> = {
  brand: { label: 'Orange', bg: ['#FA5600', '#FF9A3D'], text: '#FFFFFF', sub: 'rgba(255,255,255,0.75)', accent: '#FFFFFF', ctaBg: '#FFFFFF', ctaText: '#FA5600' },
  dark:  { label: 'Dark',   bg: ['#0B0B0C', '#1E1E22'], text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)', accent: '#FA5600', ctaBg: '#FA5600', ctaText: '#FFFFFF' },
  light: { label: 'Light',  bg: ['#FFF7F0', '#FFE3CF'], text: '#1A1A1A', sub: 'rgba(0,0,0,0.45)',       accent: '#FA5600', ctaBg: '#1A1A1A', ctaText: '#FFFFFF' },
};

function storyRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function storyWrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = last + '…';
  return kept;
}

// Tiny deterministic PRNG (not Math.random) so the sparkle/confetti layout stays put while the
// person is still typing the tag or CTA text — a fresh random layout on every keystroke would look broken.
function seededRandom(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawSparkleStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx + r * 0.18, cy - r * 0.18, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.18, cy + r * 0.18, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.18, cy + r * 0.18, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.18, cy - r * 0.18, cx, cy - r);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Sparkle stars placed in the empty side margins beside the photo card and along the top/bottom
// strips, so they read clearly without landing on the product photo or the text.
function drawSparkleEffect(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const rnd = seededRandom(7);
  for (let i = 0; i < 30; i++) {
    const zone = rnd();
    let x: number, y: number;
    if (zone < 0.55) {            // side margins, full height of the content area
      x = rnd() < 0.5 ? 18 + rnd() * 84 : W - 102 + rnd() * 84;
      y = 300 + rnd() * (H - 620);
    } else if (zone < 0.8) {      // top strip
      x = rnd() * W; y = 20 + rnd() * 220;
    } else {                      // bottom strip
      x = rnd() * W; y = H - 240 + rnd() * 220;
    }
    const r = 11 + rnd() * 24;
    drawSparkleStar(ctx, x, y, r, rnd() < 0.55 ? '#FFFFFF' : '#FFD447', 0.6 + rnd() * 0.4);
  }
}

function drawFireEffect(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const grad = ctx.createLinearGradient(0, -70, 0, 20);
  grad.addColorStop(0, '#FFD447'); grad.addColorStop(0.55, '#FF7A00'); grad.addColorStop(1, '#E11D48');
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.bezierCurveTo(-32, -2, -22, -42, 0, -68);
  ctx.bezierCurveTo(12, -38, 27, -26, 16, -6);
  ctx.bezierCurveTo(27, -10, 21, 12, 0, 20);
  ctx.closePath();
  ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();   // sticker outline
  ctx.fillStyle = grad; ctx.fill();
  ctx.restore();
}

// Confetti pieces "falling" from the top of the frame, in brand + festive colours. Pieces that would
// land on the top label pill or the discount badge/flame are skipped, so that text always stays clean.
function drawConfettiEffect(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const colors = ['#FA5600', '#FFD447', '#25D366', '#2AABEE', '#E11D48', '#FFFFFF'];
  const rnd = seededRandom(31);
  for (let i = 0; i < 52; i++) {
    const x = rnd() * W;
    const y = rnd() * H * 0.42;
    const size = 13 + rnd() * 15;
    const rot = rnd() * Math.PI * 2;
    const color = colors[Math.floor(rnd() * colors.length)];
    const isBar = rnd() > 0.5;
    const blocked =
      (x > 300 && x < 780 && y > 235 && y < 335) ||   // top label pill
      Math.hypot(x - 920, y - 390) < 120 ||            // discount badge
      Math.hypot(x - 780, y - 410) < 95;               // flame beside the badge
    if (blocked) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    if (isBar) ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    else { ctx.beginPath(); ctx.arc(0, 0, size / 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

// A bold hand-drawn style arrow: starts at (fromX, fromY), swoops through the control point and
// ends with an arrowhead at (toX, toY). Yellow with a dark outline so it reads on every theme.
function drawArrowEffect(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, ctrlX: number, ctrlY: number, toX: number, toY: number) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const angle = Math.atan2(toY - ctrlY, toX - ctrlX);
  const headLen = 44;
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
  };
  // outline pass, then colour pass
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 20;
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.quadraticCurveTo(ctrlX, ctrlY, toX, toY); ctx.stroke();
  head(); ctx.stroke();
  ctx.strokeStyle = '#FFD447'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.quadraticCurveTo(ctrlX, ctrlY, toX, toY); ctx.stroke();
  ctx.fillStyle = '#FFD447'; head(); ctx.fill();
  ctx.restore();
}

function drawStory(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement | null,
  o: { theme: StoryTheme; name: string; description: string; price: number; origPrice: number; tag: string; cta: string; showPrice: boolean; showDiscount: boolean;
       effects?: { sparkle: boolean; fire: boolean; confetti: boolean; arrow: boolean } },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const t = STORY_THEMES[o.theme];
  const font = (weight: number, size: number) => `${weight} ${size}px Inter, "Segoe UI", Arial, sans-serif`;
  const discount = o.origPrice > o.price && o.price > 0 ? Math.round(((o.origPrice - o.price) / o.origPrice) * 100) : 0;
  const fx = o.effects || { sparkle: false, fire: false, confetti: false, arrow: false };

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, t.bg[0]);
  bg.addColorStop(1, t.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.arc(980, 200, 320, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(60, 1700, 260, 0, Math.PI * 2); ctx.fill();

  // Instagram/Facebook overlay their UI on roughly the top & bottom 250px,
  // so all key content stays between y≈250 and y≈1670.

  // Tag pill
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (o.tag.trim()) {
    ctx.font = font(900, 34);
    const label = o.tag.trim().toUpperCase();
    const w = ctx.measureText(label).width + 80;
    storyRoundRect(ctx, (STORY_W - w) / 2, 250, w, 66, 33);
    ctx.fillStyle = t.ctaBg; ctx.fill();
    ctx.fillStyle = t.ctaText;
    ctx.fillText(label, STORY_W / 2, 250 + 34);
  }

  // Image card (white, product shown "contain" so nothing is cropped)
  const cx = 120, cy = 350, cs = 840;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  storyRoundRect(ctx, cx, cy, cs, cs, 56);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.restore();
  if (img) {
    const pad = 30;
    const scale = Math.min((cs - pad * 2) / img.width, (cs - pad * 2) / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.save();
    storyRoundRect(ctx, cx, cy, cs, cs, 56);
    ctx.clip();
    ctx.drawImage(img, cx + (cs - w) / 2, cy + (cs - h) / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = '#9CA3AF'; ctx.font = font(700, 40);
    ctx.fillText('Loading image…', STORY_W / 2, cy + cs / 2);
  }

  // Discount badge
  if (o.showDiscount && discount > 0) {
    const bx = cx + cs - 40, by = cy + 40;
    ctx.fillStyle = '#E11D48';
    ctx.beginPath(); ctx.arc(bx, by, 100, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(900, 62); ctx.fillText(`${discount}%`, bx, by - 14);
    ctx.font = font(900, 34); ctx.fillText('OFF', bx, by + 40);
    if (fx.fire) drawFireEffect(ctx, bx - 140, by + 38, 1.9);
  } else if (fx.fire) {
    drawFireEffect(ctx, cx + cs - 90, cy + 130, 1.9);
  }

  // Product name (max 2 lines)
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = t.text;
  ctx.font = font(900, 62);
  const nameLines = storyWrap(ctx, (o.name || '').toUpperCase(), 880, 2);
  const nameY = 1270;
  nameLines.forEach((ln, i) => ctx.fillText(ln, STORY_W / 2, nameY + i * 68));
  let cursorY = nameY + (nameLines.length - 1) * 68 + 16; // bottom edge of the name block

  // Short description (optional — only drawn if the product has one)
  const descText = (o.description || '').trim();
  if (descText) {
    ctx.font = font(600, 30);
    ctx.fillStyle = t.sub;
    const descLines = storyWrap(ctx, descText, 820, 2);
    const descY = cursorY + 26;
    descLines.forEach((ln, i) => ctx.fillText(ln, STORY_W / 2, descY + i * 38));
    cursorY = descY + (descLines.length - 1) * 38 + 10;
  }

  // Price (+ struck-through original price)
  if (o.showPrice && o.price > 0) {
    const priceTxt = `₹${o.price.toFixed(0)}`;
    const origTxt = o.origPrice > o.price ? `₹${o.origPrice.toFixed(0)}` : '';
    ctx.font = font(900, 116);
    const pw = ctx.measureText(priceTxt).width;
    ctx.font = font(700, 50);
    const ow = origTxt ? ctx.measureText(origTxt).width : 0;
    const gap = origTxt ? 28 : 0;
    const x0 = (STORY_W - (pw + gap + ow)) / 2;
    const baseY = cursorY + 80;
    ctx.textAlign = 'left';
    ctx.font = font(900, 116); ctx.fillStyle = t.accent; ctx.fillText(priceTxt, x0, baseY);
    if (origTxt) {
      ctx.font = font(700, 50); ctx.fillStyle = t.sub;
      ctx.fillText(origTxt, x0 + pw + gap, baseY);
      ctx.fillRect(x0 + pw + gap, baseY - 18, ow, 4);
    }
    ctx.textAlign = 'center';
    cursorY = baseY;
    if (fx.arrow) {
      const rowEnd = x0 + pw + gap + ow;
      if (x0 >= 190) {                       // room on the left → arrow swoops down and points right at the price
        drawArrowEffect(ctx, 70, baseY - 190, 70, baseY - 48, x0 - 26, baseY - 48);
      } else if (STORY_W - rowEnd >= 190) {  // otherwise the right margin → points left at the price
        drawArrowEffect(ctx, STORY_W - 70, baseY - 190, STORY_W - 70, baseY - 48, rowEnd + 26, baseY - 48);
      }                                      // (no room either side → skip rather than cross the text)
    }
  }

  // Call-to-action pill (optional short marketing line, e.g. "Limited Stock!")
  if (o.cta.trim()) {
    ctx.font = font(900, 38);
    const w = Math.min(900, ctx.measureText(o.cta.trim()).width + 100);
    const ctaTop = cursorY + 48;
    storyRoundRect(ctx, (STORY_W - w) / 2, ctaTop, w, 92, 46);
    ctx.fillStyle = t.ctaBg; ctx.fill();
    ctx.fillStyle = t.ctaText; ctx.textBaseline = 'middle';
    ctx.fillText(o.cta.trim(), STORY_W / 2, ctaTop + 48);
    ctx.textBaseline = 'alphabetic';
    cursorY = ctaTop + 92;
  }

  // Contact bar — website + phone, always shown regardless of the CTA text above,
  // so every exported image reliably carries both, clearly readable.
  const contactTop = cursorY + 34;
  const contactH = 68;
  ctx.font = font(800, 32);
  const site = 'www.ta-gs.online';
  const phone = '📞 6350021226';
  const sw = ctx.measureText(site).width;
  const dotGap = 28;
  ctx.font = font(800, 32);
  const pw2 = ctx.measureText(phone).width;
  const barW = sw + dotGap + 10 + pw2 + 64;
  storyRoundRect(ctx, (STORY_W - barW) / 2, contactTop, barW, contactH, contactH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.strokeStyle = t.text; ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = t.text;
  ctx.font = font(800, 32);
  const midY = contactTop + contactH / 2;
  const startX = (STORY_W - barW) / 2 + 32;
  ctx.textAlign = 'left';
  ctx.fillText(site, startX, midY);
  ctx.fillStyle = t.sub;
  ctx.fillText('•', startX + sw + dotGap / 2 - 4, midY);
  ctx.fillStyle = t.text;
  ctx.fillText(phone, startX + sw + dotGap + 10, midY);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Brand line
  ctx.font = font(800, 26); ctx.fillStyle = t.sub;
  ctx.fillText('TAGS  ·  TOYS · ADVENTURE · GADGETS · SPORTS', STORY_W / 2, Math.min(contactTop + contactH + 46, STORY_H - 30));

  // Decorative overlay — drawn last so it sits on top, kept subtle enough not to hide the product or text
  if (fx.confetti) drawConfettiEffect(ctx, STORY_W, STORY_H);
  if (fx.sparkle) drawSparkleEffect(ctx, STORY_W, STORY_H);
}

type StoryResult = { ok: boolean; error?: string };

// Shows which Facebook Page and Instagram account Story posting is actually
// connected to, by calling the existing read-only diagnostic endpoint
// (GET /api/products?storyCheck=true). No secrets are fetched or shown.
function ConnectedAccountsStatus() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const check = () => {
    setLoading(true); setError('');
    fetch('/api/products?storyCheck=true')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Could not reach the server to check.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { check(); }, []);

  return (
    <div className={`rounded-xl border-2 px-3 py-2.5 text-[11px] font-bold flex items-start gap-2.5 ${
      loading ? 'border-gray-100 bg-gray-50 text-gray-400'
      : error || !data?.ready ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-green-200 bg-green-50 text-green-700'
    }`}>
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />
      ) : error || !data?.ready ? (
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      ) : (
        <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        {loading && <span>Checking connected Facebook Page &amp; Instagram account…</span>}

        {!loading && error && <span>{error}</span>}

        {!loading && !error && data?.ready && (
          <span>
            Posting to <span className="font-black">{data.page?.name || 'this Page'}</span> (Facebook)
            {data.instagram?.username && <> &middot; <span className="font-black">@{data.instagram.username}</span> (Instagram)</>}
          </span>
        )}

        {!loading && !error && !data?.ready && (
          <div className="space-y-1">
            <p>Not fully connected yet — missing: {(data?.missing || []).join(', ') || 'unknown'}.</p>
            {Array.isArray(data?.availablePages) && data.availablePages.length > 0 && (
              <p className="font-normal text-amber-600">
                Set FB_PAGE_ID to one of: {data.availablePages.map((p: any) => `${p.name} (${p.id})`).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
      <button onClick={check} disabled={loading} className="shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-40">
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function StoryComposer({ product, imageUrl, price, origPrice, caption, description, guard, onShared }: {
  product: any; imageUrl: string; price: number; origPrice: number; caption: string; description: string;
  guard: ShareGuard; onShared: OnShared;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg]                   = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError]         = useState('');
  const [theme, setTheme]               = useState<StoryTheme>('brand');
  const [tag, setTag]                   = useState('New Arrival');
  const [cta, setCta]                   = useState('Limited Stock — Order Now!');
  const [showPrice, setShowPrice]       = useState(true);
  const [showDiscount, setShowDiscount] = useState(true);
  const [effects, setEffects]           = useState({ sparkle: false, fire: false, confetti: false, arrow: false });
  const [platforms, setPlatforms]       = useState({ instagram: true, facebook: true });
  const [posting, setPosting]           = useState(false);
  const [results, setResults]           = useState<Record<string, StoryResult> | null>(null);
  const [notice, setNotice]             = useState('');

  // Load the product image. Fetched as a blob so the canvas is never "tainted"
  // (a tainted canvas can't be exported). Needs CORS on the image host — Cloudinary allows it.
  useEffect(() => {
    let cancelled = false;
    let objUrl = '';
    setImg(null); setImgError('');
    if (!imageUrl) { setImgError('This product has no image.'); return; }
    (async () => {
      try {
        const res = await fetch(imageUrl, { mode: 'cors', cache: 'reload' });
        if (!res.ok) throw new Error('bad status');
        objUrl = URL.createObjectURL(await res.blob());
        const im = new window.Image();   // NOTE: `Image` alone is the lucide icon in this file
        await new Promise<void>((ok, bad) => { im.onload = () => ok(); im.onerror = () => bad(new Error('decode')); im.src = objUrl; });
        if (!cancelled) setImg(im);
      } catch {
        if (!cancelled) setImgError("Couldn't load this image for the story (the image host may block cross-origin access).");
      }
    })();
    return () => { cancelled = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [imageUrl]);

  // Redraw whenever anything changes
  useEffect(() => {
    if (canvasRef.current) {
      drawStory(canvasRef.current, img, { theme, name: product?.name || '', description: description || '', price, origPrice, tag, cta, showPrice, showDiscount, effects });
    }
  }, [img, theme, tag, cta, showPrice, showDiscount, effects, product?.name, description, price, origPrice]);

  const fileName = `story-${String(product?.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.jpg`;

  // Instagram only accepts JPEG for stories, so always export JPEG.
  const getBlob = (): Promise<Blob> => new Promise((resolve, reject) => {
    try {
      canvasRef.current!.toBlob(b => b ? resolve(b) : reject(new Error('Could not export the story image.')), 'image/jpeg', 0.92);
    } catch {
      reject(new Error('Could not export the story image (image host blocks cross-origin access).'));
    }
  });

  const downloadBlob = (blob: Blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  const handleDownload = async () => {
    setNotice('');
    try { downloadBlob(await getBlob()); }
    catch (e: any) { setNotice('❌ ' + e.message); }
  };

  // Phones/tablets can share straight into WhatsApp's "My status"; desktop can't (see below)
  const isMobile = typeof navigator !== 'undefined' && (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );

  // WhatsApp has no public API for Status, and WhatsApp Desktop's share dialog only offers chats
  // (no Status option). So:
  //   • phone/tablet → native share sheet → choose WhatsApp → "My status"
  //   • desktop      → download the image + copy the caption, then add it from the Status tab
  const doWhatsAppStatus = async () => {
    setNotice('');
    try {
      const blob = await getBlob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
        onShared([String(product._id)], 'whatsapp-status');
        return;
      }
      downloadBlob(blob);
      onShared([String(product._id)], 'whatsapp-status');
      let captionCopied = false;
      try { await navigator.clipboard.writeText(caption); captionCopied = true; } catch { /* clipboard blocked */ }
      setNotice(
        `✓ Image saved${captionCopied ? ' and caption copied' : ''}. In WhatsApp Desktop: Status tab → “+” → Photos → pick "${fileName}"${captionCopied ? ' → paste the caption (Ctrl+V)' : ''} → Send.`
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') setNotice('❌ ' + (e.message || 'Share failed'));
    }
  };

  const handleWhatsAppStatus = () => guard([String(product._id)], () => { doWhatsAppStatus(); });

  const doPostStories = async () => {
    const selected = (Object.keys(platforms) as Array<'instagram' | 'facebook'>).filter(k => platforms[k]);
    if (selected.length === 0) { setNotice('Select Instagram and/or Facebook first.'); return; }
    setPosting(true); setResults(null); setNotice('');
    try {
      // 1) Meta needs a public URL, so host the rendered JPEG on Cloudinary via the existing upload endpoint
      const blob = await getBlob();
      const up = await fetch('/api/upload?mode=story', { method: 'POST', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      const upData = await up.json();
      if (!upData.url) throw new Error('Image upload failed');
      // 2) Ask the server to publish it as a story
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyBroadcast: true, imageUrl: upData.url, platforms: selected }),
      });
      const data = await res.json();
      if (!res.ok && !data.results) throw new Error(data.error || 'Failed to post story');
      setResults(data.results || {});
      Object.entries(data.results || {}).forEach(([k, r]: [string, any]) => { if (r?.ok) onShared([String(product._id)], k); });
    } catch (e: any) {
      setNotice('❌ ' + e.message);
    } finally {
      setPosting(false);
    }
  };

  const handlePostStories = () => guard([String(product._id)], () => { doPostStories(); });

  const pill = (active: boolean) =>
    `text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-2 transition-all ${
      active ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-400 bg-white hover:border-[#FA5600]/50'}`;
  const inputCls = 'w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-[#FA5600] outline-none transition bg-white';

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Live 9:16 preview */}
        <div className="shrink-0 mx-auto sm:mx-0">
          <canvas ref={canvasRef} className="w-[190px] rounded-xl shadow-lg border border-gray-200 bg-gray-100" style={{ aspectRatio: '9 / 16' }} />
          <p className="text-[9px] text-gray-400 text-center mt-1">1080 × 1920 · 9:16</p>
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Theme</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STORY_THEMES) as StoryTheme[]).map(k => (
                <button key={k} onClick={() => setTheme(k)} className={pill(theme === k)}>{STORY_THEMES[k].label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Top Label</p>
            <input value={tag} onChange={e => setTag(e.target.value)} maxLength={24} placeholder="New Arrival / Low Stock / Festive Offer" className={inputCls} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Marketing Line (optional)</p>
            <input value={cta} onChange={e => setCta(e.target.value)} maxLength={34} placeholder="Limited Stock — Order Now!" className={inputCls} />
            <p className="text-[9px] text-gray-400 mt-1">Your website and phone number are always shown below this, automatically.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowPrice(v => !v)} className={pill(showPrice)}>Price {showPrice ? 'On' : 'Off'}</button>
            <button onClick={() => setShowDiscount(v => !v)} className={pill(showDiscount)}>Discount Badge {showDiscount ? 'On' : 'Off'}</button>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Effects</p>
            <div className="flex gap-2 flex-wrap">
              {([['sparkle', '✨ Sparkle'], ['fire', '🔥 Fire'], ['confetti', '🎉 Confetti'], ['arrow', '➜ Arrow']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setEffects(e => ({ ...e, [k]: !e[k] }))} className={pill(effects[k])}>{label}</button>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 mt-1">Decorations are drawn into the image itself. Instagram and Facebook stories/posts are still pictures, so these don't move.</p>
          </div>
        </div>
      </div>

      {imgError && <p className="text-[11px] font-bold text-red-500 bg-red-50 rounded-xl px-3 py-2">{imgError}</p>}

      {/* Publish actions */}
      <div className="border-t border-gray-100 pt-4 space-y-2.5">
        <ConnectedAccountsStatus />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Post to</span>
          {([['instagram', 'Instagram'], ['facebook', 'Facebook']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setPlatforms(p => ({ ...p, [k]: !p[k] }))} className={pill(platforms[k])}>
              {platforms[k] ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>

        <button onClick={handlePostStories} disabled={posting || !img}
          className="w-full flex items-center justify-center gap-2 text-white font-black py-3.5 rounded-xl shadow-md text-sm uppercase tracking-widest transition-all disabled:opacity-50 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90">
          {posting ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Posting stories...</>
          ) : (
            <><Send className="w-4 h-4" /> Post Story to Instagram / Facebook</>
          )}
        </button>

        <button onClick={handleWhatsAppStatus} disabled={!img}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-black py-3.5 rounded-xl hover:bg-[#20bd5a] transition-all shadow-md text-sm uppercase tracking-widest disabled:opacity-50">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          {isMobile ? 'Share to WhatsApp Status' : 'Save for WhatsApp Status'}
        </button>

        <button onClick={handleDownload} disabled={!img}
          className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-600 font-black py-2.5 rounded-xl hover:border-[#FA5600] hover:text-[#FA5600] transition-all text-xs uppercase tracking-widest disabled:opacity-50">
          <Download className="w-4 h-4" /> Download Story Image
        </button>

        {results && (
          <div className="bg-gray-50 rounded-xl px-3 py-2 space-y-1">
            {Object.entries(results).map(([k, r]) => (
              <p key={k} className={`text-[11px] font-bold ${r.ok ? 'text-green-600' : 'text-red-500'}`}>
                {r.ok ? '✓' : '✗'} {k === 'instagram' ? 'Instagram' : 'Facebook'}: {r.ok ? 'Story posted' : r.error}
              </p>
            ))}
          </div>
        )}
        {notice && <p className="text-[11px] font-bold text-gray-600 bg-gray-50 rounded-xl px-3 py-2">{notice}</p>}
        <p className="text-[9px] text-center text-gray-400 font-semibold">
          Instagram &amp; Facebook post automatically · WhatsApp has no posting API: on a phone pick “My status” in the share list; on desktop add the saved image from the Status tab
        </p>
      </div>
    </div>
  );
}

// ── Bulk WhatsApp (many products → pictures with their own text) ──────────
const isMobileDevice = () => typeof navigator !== 'undefined' && (
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
);

// WhatsApp Desktop garbles emoji that arrive through a wa.me link (shown as "�"), so drop them
// from link text on desktop. Phones handle them fine. "Copy" and picture-sharing keep the emoji.
const waLinkText = (t: string) =>
  isMobileDevice() ? t : t.replace(/[\u{10000}-\u{10FFFF}\u2728]\uFE0F?[ \t]?/gu, '').trim();

// The broadcast message uses WhatsApp/Telegram-style markdown (*bold*, ~~strike~~), which
// Instagram captions don't render — so strip those markers, keeping the emoji, line breaks and text.
const igCaptionText = (t: string) => t.replace(/\*/g, '').replace(/~~/g, '');

type BulkItem = { id: string; name: string; description: string; price: number; origPrice: number; image: string };
type BulkFiles = { photo: File; card: File; cardUrl: string; status: File; statusUrl: string };

// Loads a product photo through fetch→blob so the canvas is never tainted (needs CORS on the image host)
async function loadImageElement(url: string): Promise<{ im: HTMLImageElement; release: () => void }> {
  const res = await fetch(url, { mode: 'cors', cache: 'reload' });
  if (!res.ok) throw new Error('fetch failed');
  const objUrl = URL.createObjectURL(await res.blob());
  const im = new window.Image();   // NOTE: `Image` alone is the lucide icon in this file
  try {
    await new Promise<void>((ok, bad) => { im.onload = () => ok(); im.onerror = () => bad(new Error('decode')); im.src = objUrl; });
  } catch (e) { URL.revokeObjectURL(objUrl); throw e; }
  return { im, release: () => URL.revokeObjectURL(objUrl) };
}

const canvasToJpegFile = (c: HTMLCanvasElement, name: string) =>
  new Promise<File>((ok, bad) => c.toBlob(b => b ? ok(new File([b], name, { type: 'image/jpeg' })) : bad(new Error('export')), 'image/jpeg', 0.9));

// Plain product photo as JPEG (WhatsApp may treat .webp shares as stickers, so always convert)
function renderPhoto(im: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, 1200 / Math.max(im.width, im.height));
  const c = document.createElement('canvas');
  c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(im, 0, 0, c.width, c.height);
  return c;
}

// Picture card: product photo on top, name / short description / price / discount / contact printed underneath (1080×1350)
function renderProductCard(im: HTMLImageElement, it: BulkItem): HTMLCanvasElement {
  const W = 1080, H = 1350, photoH = 860;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const font = (w: number, s: number) => `${w} ${s}px Inter, "Segoe UI", Arial, sans-serif`;

  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, photoH);
  const pad = 50;
  const scale = Math.min((W - pad * 2) / im.width, (photoH - pad * 2) / im.height);
  const w = im.width * scale, h = im.height * scale;
  ctx.drawImage(im, (W - w) / 2, (photoH - h) / 2, w, h);

  const g = ctx.createLinearGradient(0, photoH, 0, H);
  g.addColorStop(0, '#FA5600'); g.addColorStop(1, '#FF8A3D');
  ctx.fillStyle = g; ctx.fillRect(0, photoH, W, H - photoH);

  const disc = it.origPrice > it.price && it.price > 0 ? Math.round(((it.origPrice - it.price) / it.origPrice) * 100) : 0;
  if (disc > 0) {
    ctx.fillStyle = '#E11D48';
    ctx.beginPath(); ctx.arc(W - 130, 130, 95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = font(900, 58); ctx.fillText(`${disc}%`, W - 130, 116);
    ctx.font = font(900, 30); ctx.fillText('OFF', W - 130, 166);
  }

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#FFFFFF';
  ctx.font = font(900, 46);
  const lines = storyWrap(ctx, (it.name || '').toUpperCase(), 960, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, 60, 940 + i * 56));
  let cursorY = 940 + (lines.length - 1) * 56 + 8;

  // Short description (optional)
  const descText = (it.description || '').trim();
  if (descText) {
    ctx.font = font(500, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const descLines = storyWrap(ctx, descText, 960, 2);
    descLines.forEach((ln, i) => ctx.fillText(ln, 60, cursorY + 38 + i * 34));
    cursorY = cursorY + 38 + (descLines.length - 1) * 34 + 6;
    ctx.fillStyle = '#FFFFFF';
  }

  if (it.price > 0) {
    const baseY = cursorY + 96;
    const priceTxt = `₹${it.price.toFixed(0)}`;
    ctx.font = font(900, 88); ctx.fillText(priceTxt, 60, baseY);
    if (it.origPrice > it.price) {
      const pw = ctx.measureText(priceTxt).width;
      const origTxt = `₹${it.origPrice.toFixed(0)}`;
      ctx.font = font(700, 42); ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(origTxt, 60 + pw + 28, baseY);
      ctx.fillRect(60 + pw + 28, baseY - 15, ctx.measureText(origTxt).width, 4);
      ctx.fillStyle = '#FFFFFF';
    }
    cursorY = baseY;
  }

  // Contact bar — website + phone, clearly separated from the price with a divider
  const barY = Math.min(cursorY + 70, H - 65);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(60, barY - 45, W - 120, 3);
  ctx.font = font(800, 34);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('www.ta-gs.online', 60, barY);
  ctx.font = font(600, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const siteW = ctx.measureText('www.ta-gs.online').width;
  ctx.font = font(800, 34);
  ctx.fillText('•  📞 6350021226', 60 + ctx.measureText('www.ta-gs.online').width + 22, barY);
  return c;
}

// Attractive 9:16 WhatsApp-Status-format image, reusing the same design as the
// single-product Story composer (photo, name, description, price, contact bar).
function renderStatusCard(im: HTMLImageElement, it: BulkItem): HTMLCanvasElement {
  const c = document.createElement('canvas');
  drawStory(c, im, {
    theme: 'brand',
    name: it.name || '',
    description: it.description || '',
    price: it.price,
    origPrice: it.origPrice,
    tag: '',
    cta: '',
    showPrice: true,
    showDiscount: true,
  });
  return c;
}

function BulkWhatsAppModal({ items, onClose, guard, onShared }: { items: BulkItem[]; onClose: () => void; guard: ShareGuard; onShared: OnShared }) {
  const [mode, setMode]           = useState<'cards' | 'status' | 'captions'>('cards');
  const [perPart, setPerPart]     = useState(5);
  const [intro, setIntro]         = useState('🔥 *New at TAGS!*');
  const [sent, setSent]           = useState<Set<string>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [files, setFiles]         = useState<Record<string, BulkFiles | null>>({});
  const [prepared, setPrepared]   = useState(0);
  const [notice, setNotice]       = useState('');

  useEffect(() => { setSent(new Set()); setNotice(''); }, [mode, perPart, intro, items.length]);

  // Pre-build every product's photo + picture card so sharing can start instantly on click
  const idKey = items.map(i => i.id).join(',');
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setFiles({}); setPrepared(0);
    items.forEach(async it => {
      let f: BulkFiles | null = null;
      try {
        if (it.image) {
          const { im, release } = await loadImageElement(it.image);
          try {
            const base = `${(it.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${it.id.slice(-4)}`;
            const photo = await canvasToJpegFile(renderPhoto(im), `${base}.jpg`);
            const card  = await canvasToJpegFile(renderProductCard(im, it), `${base}-card.jpg`);
            const cardUrl = URL.createObjectURL(card);
            const status  = await canvasToJpegFile(renderStatusCard(im, it), `${base}-status.jpg`);
            const statusUrl = URL.createObjectURL(status);
            urls.push(cardUrl, statusUrl);
            f = { photo, card, cardUrl, status, statusUrl };
          } finally { release(); }
        }
      } catch { f = null; }
      if (cancelled) { if (f) { URL.revokeObjectURL(f.cardUrl); URL.revokeObjectURL(f.statusUrl); } return; }
      setFiles(prev => ({ ...prev, [it.id]: f }));
      setPrepared(n => n + 1);
    });
    return () => { cancelled = true; urls.forEach(u => URL.revokeObjectURL(u)); };
  }, [idKey]);
  const ready = prepared >= items.length;
  const loadedCount = Object.values(files).filter(Boolean).length;

  // ── Text versions ──
  const productLine = (it: BulkItem, num: number) => {
    const name = it.name.length > 60 ? it.name.slice(0, 57) + '...' : it.name;
    let l = num ? `${num}. *${name}*` : `*${name}*`;
    if (it.price > 0) {
      const disc = it.origPrice > it.price ? Math.round(((it.origPrice - it.price) / it.origPrice) * 100) : 0;
      l += `\n   💰 ₹${it.price.toFixed(0)}` + (disc > 0 ? ` ~₹${it.origPrice.toFixed(0)}~ (${disc}% OFF)` : '');
    }
    l += `\n   🔗 https://ta-gs.online/products/${it.id}`;
    return l;
  };
  const captionFor = (it: BulkItem) => {
    const disc = it.origPrice > it.price && it.price > 0 ? Math.round(((it.origPrice - it.price) / it.origPrice) * 100) : 0;
    let t = `*${it.name}*\n`;
    if (it.price > 0) t += `💰 ₹${it.price.toFixed(0)}` + (disc > 0 ? ` ~₹${it.origPrice.toFixed(0)}~ (${disc}% OFF)` : '') + '\n';
    t += `🔗 https://ta-gs.online/products/${it.id}\n\n📞 To order: wa.me/916350021226\n📍 TAGS, Hathipole, Udaipur`;
    return t;
  };

  const chunks: BulkItem[][] = [];
  for (let i = 0; i < items.length; i += perPart) chunks.push(items.slice(i, i + perPart));
  const parts = chunks.map(chunk => {
    let msg = intro.trim() ? intro.trim() + '\n\n' : '';
    // numbering restarts in every message, and is skipped when a message holds a single product
    msg += chunk.map((it, j) => productLine(it, chunk.length > 1 ? j + 1 : 0)).join('\n\n');
    msg += `\n\n📞 To order, WhatsApp us:\nwa.me/916350021226\n\n✨ *TAGS — Toys · Adventure · Gadgets · Sports*\n📍 Hathipole, Udaipur`;
    return msg;
  });

  const markSent = (key: string) => setSent(prev => new Set(prev).add(key));
  const copyPart = (i: number) => {
    navigator.clipboard.writeText(parts[i]).then(() => { setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); });
  };
  const openTextOnly = (i: number) => {
    const ids = chunks[i].map(it => it.id);
    guard(ids, () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(waLinkText(parts[i]))}`, '_blank');
      markSent(`p${i}`);
      onShared(ids, 'whatsapp');
    });
  };

  const downloadFiles = (fs: File[]) => fs.forEach((f, k) => setTimeout(() => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, k * 300));

  const shareOrSave = (fs: File[], text: string, key: string, ids: string[], shareMsg: string, saveMsg: string) => {
    if (navigator.canShare && navigator.canShare({ files: fs })) {
      setNotice(shareMsg);
      navigator.share(text ? { files: fs, text } : { files: fs })
        .then(() => { markSent(key); onShared(ids, 'whatsapp'); })
        .catch((e: any) => { if (e?.name === 'AbortError') setNotice(''); else setNotice('❌ ' + (e?.message || 'Share failed')); });
    } else {
      downloadFiles(fs); markSent(key); onShared(ids, 'whatsapp'); setNotice(saveMsg);
    }
  };

  // Mode 1 — picture cards: every picture already has its own text underneath, one share for all
  const doSendCards = (i: number) => {
    const fs = chunks[i].map(it => files[it.id]?.card).filter((f): f is File => !!f);
    const missing = chunks[i].length - fs.length;
    if (fs.length === 0) { setNotice('❌ None of these products has a picture that could be loaded. Use "Text only" instead.'); return; }
    const tail = missing > 0 ? ` (${missing} without a loadable picture skipped.)` : '';
    shareOrSave(fs, '', `p${i}`, chunks[i].filter(it => files[it.id]?.card).map(it => it.id),
      `✓ Pick the chat(s) in WhatsApp and send — each picture already has its name, price and contact underneath.${tail}`,
      `✓ Pictures saved. Attach them to a chat in WhatsApp — each one has its text underneath.${tail}`);
  };

  const sendCards = (i: number) => guard(chunks[i].map(it => it.id), () => doSendCards(i));

  // Mode "status" — attractive full-screen (9:16) images, sized for WhatsApp Status.
  // Nothing here posts automatically: this either opens the native share sheet
  // (where you pick "My Status" yourself) or downloads the files for manual posting.
  const doSendStatus = (i: number) => {
    const fs = chunks[i].map(it => files[it.id]?.status).filter((f): f is File => !!f);
    const missing = chunks[i].length - fs.length;
    if (fs.length === 0) { setNotice('❌ None of these products has a picture that could be loaded.'); return; }
    const tail = missing > 0 ? ` (${missing} without a loadable picture skipped.)` : '';
    shareOrSave(fs, '', `s${i}`, chunks[i].filter(it => files[it.id]?.status).map(it => it.id),
      `✓ Pick "My Status" (or a community) in the share window and post — you're always the one who taps post.${tail}`,
      `✓ Status images saved. Open WhatsApp, go to Status, and add them from your gallery.${tail}`);
  };

  const sendStatus = (i: number) => guard(chunks[i].map(it => it.id), () => doSendStatus(i));

  const doDownloadAllStatus = () => {
    const fs = items.map(it => files[it.id]?.status).filter((f): f is File => !!f);
    if (fs.length === 0) { setNotice('❌ No Status images are ready yet.'); return; }
    downloadFiles(fs);
    onShared(items.filter(it => files[it.id]?.status).map(it => it.id), 'whatsapp-status');
    setNotice(`✓ Downloading ${fs.length} Status image${fs.length > 1 ? 's' : ''} — post them from your gallery whenever you like.`);
  };
  const downloadAllStatus = () => guard(items.map(it => it.id), doDownloadAllStatus);

  // Mode 2 — real WhatsApp caption: one product at a time; caption is copied, paste it in the message box
  const doSendWithCaption = (it: BulkItem) => {
    const f = files[it.id]?.photo;
    if (!f) { setNotice('❌ This product has no picture that could be loaded.'); return; }
    const cap = captionFor(it);
    navigator.clipboard.writeText(cap).catch(() => {});
    shareOrSave([f], cap, `c${it.id}`, [it.id],
      '✓ Caption copied. In WhatsApp pick the chat(s), click the message box, paste (Ctrl+V) and send. Then come back for the next product.',
      '✓ Picture saved and caption copied. Attach the picture in WhatsApp and paste the caption.');
  };

  const sendWithCaption = (it: BulkItem) => guard([it.id], () => doSendWithCaption(it));

  const tabCls = (on: boolean) =>
    `flex-1 text-[10px] font-black uppercase tracking-widest py-2 px-2 rounded-xl border-2 transition-all ${on ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-400 bg-white hover:border-[#FA5600]/50'}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Bulk WhatsApp</h3>
            <p className="text-[10px] text-gray-400 font-bold">
              {items.length} product{items.length > 1 ? 's' : ''} · {ready ? `pictures ready (${loadedCount}/${items.length})` : `preparing pictures ${prepared}/${items.length}…`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="flex gap-2">
              <button onClick={() => setMode('cards')} className={tabCls(mode === 'cards')}>Text on picture · all at once</button>
              <button onClick={() => setMode('status')} className={tabCls(mode === 'status')}>WhatsApp Status images</button>
              <button onClick={() => setMode('captions')} className={tabCls(mode === 'captions')}>WhatsApp caption · one by one</button>
            </div>
            <p className="text-[9px] text-gray-400 font-semibold mt-1.5">
              {mode === 'cards'
                ? 'Each picture is rebuilt with its name, price, discount and contact printed underneath, so all pictures go in one share.'
                : mode === 'status'
                ? 'Attractive full-screen (9:16) images with photo, description, price and contact — download them, or pick "My Status" in the share window.'
                : 'Real WhatsApp captions with clickable links. WhatsApp allows one caption box per share, so you send each product separately.'}
            </p>
          </div>

          {notice && <p className="text-[11px] font-bold text-gray-700 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">{notice}</p>}

          {mode === 'cards' && (
            <>
              <div className="flex gap-3 flex-wrap items-end">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Opening line (text version)</p>
                  <input value={intro} onChange={e => setIntro(e.target.value)} maxLength={80}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-[#FA5600] outline-none bg-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Pictures per share</p>
                  <div className="flex gap-1.5">
                    {[1, 3, 5, 8].map(n => (
                      <button key={n} onClick={() => setPerPart(n)}
                        className={`text-[10px] font-black w-9 py-1.5 rounded-lg border-2 transition-all ${perPart === n ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-400 bg-white hover:border-[#FA5600]/50'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              {chunks.map((chunk, i) => (
                <div key={i} className={`rounded-xl border-2 p-3 space-y-2 ${sent.has(`p${i}`) ? 'border-green-200 bg-green-50/50' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Share {i + 1} of {chunks.length} · {chunk.length} picture{chunk.length > 1 ? 's' : ''} {sent.has(`p${i}`) && <span className="text-green-600 normal-case">· done ✓</span>}
                    </p>
                    <button onClick={() => copyPart(i)}
                      className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg transition ${copiedIdx === i ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {copiedIdx === i ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy text + links</>}
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {chunk.map(it => (
                      <div key={it.id} className="shrink-0 w-24 rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ aspectRatio: '4 / 5' }}>
                        {files[it.id]?.cardUrl
                          ? <img src={files[it.id]!.cardUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-gray-300 text-center px-1">{files[it.id] === null ? 'No picture' : '…'}</div>}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => sendCards(i)} disabled={!ready}
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-black py-2.5 rounded-xl hover:bg-[#20bd5a] transition-all text-xs uppercase tracking-widest disabled:opacity-50">
                    {ready ? `Send ${chunk.length} picture${chunk.length > 1 ? 's' : ''} to WhatsApp` : 'Preparing pictures…'}
                  </button>
                  <button onClick={() => openTextOnly(i)}
                    className="w-full border-2 border-gray-200 text-gray-600 font-black py-2 rounded-xl hover:border-[#25D366] hover:text-[#25D366] transition-all text-[10px] uppercase tracking-widest">
                    Text only (WhatsApp link)
                  </button>
                </div>
              ))}
            </>
          )}

          {mode === 'status' && (
            <>
              <button onClick={downloadAllStatus} disabled={!ready}
                className="w-full flex items-center justify-center gap-2 border-2 border-[#FA5600] text-[#FA5600] font-black py-2.5 rounded-xl hover:bg-[#FA5600] hover:text-white transition-all text-xs uppercase tracking-widest disabled:opacity-50">
                {ready ? `⬇ Download All ${items.length} Status Images` : 'Preparing images…'}
              </button>

              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Images per share</p>
                  <div className="flex gap-1.5">
                    {[1, 3, 5, 8].map(n => (
                      <button key={n} onClick={() => setPerPart(n)}
                        className={`text-[10px] font-black w-9 py-1.5 rounded-lg border-2 transition-all ${perPart === n ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-400 bg-white hover:border-[#FA5600]/50'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              {chunks.map((chunk, i) => (
                <div key={i} className={`rounded-xl border-2 p-3 space-y-2 ${sent.has(`s${i}`) ? 'border-green-200 bg-green-50/50' : 'border-gray-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Group {i + 1} of {chunks.length} · {chunk.length} image{chunk.length > 1 ? 's' : ''} {sent.has(`s${i}`) && <span className="text-green-600 normal-case">· done ✓</span>}
                  </p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {chunk.map(it => (
                      <div key={it.id} className="shrink-0 w-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ aspectRatio: '9 / 16' }}>
                        {files[it.id]?.statusUrl
                          ? <img src={files[it.id]!.statusUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-gray-300 text-center px-1">{files[it.id] === null ? 'No picture' : '…'}</div>}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => sendStatus(i)} disabled={!ready}
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-black py-2.5 rounded-xl hover:bg-[#20bd5a] transition-all text-xs uppercase tracking-widest disabled:opacity-50">
                    {ready ? `Share ${chunk.length} image${chunk.length > 1 ? 's' : ''} (pick "My Status")` : 'Preparing images…'}
                  </button>
                  <button onClick={() => guard(chunk.map(it => it.id), () => {
                      downloadFiles(chunk.map(it => files[it.id]?.status).filter((f): f is File => !!f));
                      markSent(`s${i}`);
                      onShared(chunk.filter(it => files[it.id]?.status).map(it => it.id), 'whatsapp-status');
                    })}
                    disabled={!ready}
                    className="w-full border-2 border-gray-200 text-gray-600 font-black py-2 rounded-xl hover:border-[#FA5600] hover:text-[#FA5600] transition-all text-[10px] uppercase tracking-widest disabled:opacity-50">
                    Download this group
                  </button>
                </div>
              ))}
            </>
          )}

          {mode === 'captions' && (
            <div className="space-y-2">
              {items.map((it, n) => (
                <div key={it.id} className={`rounded-xl border-2 p-3 flex items-center gap-3 ${sent.has(`c${it.id}`) ? 'border-green-200 bg-green-50/50' : 'border-gray-100'}`}>
                  <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-4 h-4" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Product {n + 1} of {items.length} {sent.has(`c${it.id}`) && <span className="text-green-600 normal-case">· done ✓</span>}</p>
                    <p className="font-black text-sm text-gray-900 truncate">{it.name}</p>
                    <p className="text-xs font-black text-[#FA5600]">₹{it.price.toFixed(0)}</p>
                  </div>
                  <button onClick={() => sendWithCaption(it)} disabled={!ready}
                    className="shrink-0 bg-[#25D366] text-white font-black text-[10px] uppercase tracking-widest px-3 py-2.5 rounded-xl hover:bg-[#20bd5a] transition-all disabled:opacity-50">
                    {ready ? 'Send' : '…'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-[9px] text-gray-400 font-semibold text-center">
            In WhatsApp's share window you can tick several chats, so one send reaches many contacts.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Video sharing: WhatsApp, Telegram, Instagram/Facebook Reels, Instagram/Facebook video stories ──
type VidTarget = 'whatsapp' | 'telegram' | 'instagram_reel' | 'facebook_reel' | 'instagram_story' | 'facebook_story';
type VidState = { state: 'idle' | 'working' | 'ok' | 'error'; text?: string };
const VIDEO_CHANNEL: Record<VidTarget, string> = {
  whatsapp: 'whatsapp-video', telegram: 'telegram-video', instagram_reel: 'instagram-reel',
  facebook_reel: 'facebook-reel', instagram_story: 'instagram-video-story', facebook_story: 'facebook-video-story',
};
const IDLE_VID: Record<VidTarget, VidState> = {
  whatsapp: { state: 'idle' }, telegram: { state: 'idle' }, instagram_reel: { state: 'idle' },
  facebook_reel: { state: 'idle' }, instagram_story: { state: 'idle' }, facebook_story: { state: 'idle' },
};
const MAX_VIDEO_MB = 100;   // Cloudinary's direct-upload limit on most plans
const sleepMs = (ms: number) => new Promise(r => setTimeout(r, ms));

// XMLHttpRequest (not fetch) so upload progress can be shown. The file goes straight to Cloudinary,
// never through the Vercel function, so its ~4.5MB body limit doesn't apply.
const uploadVideoFile = (file: File, onPct: (n: number) => void): Promise<string> => new Promise(async (resolve, reject) => {
  try {
    const sig = await (await fetch('/api/products?cloudinarySign=true&resourceType=video')).json();
    if (!sig.signature) throw new Error('Could not get an upload permission from the server.');
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', sig.folder);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`);
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onPct(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
        else reject(new Error(data.error?.message || 'Cloudinary upload failed.'));
      } catch { reject(new Error('Cloudinary returned an unexpected response.')); }
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.send(form);
  } catch (e: any) { reject(e); }
});

async function videoApi(body: any) {
  const r = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

function VideoSharePanel({ product, caption, guard, onShared }: {
  product: any; caption: string; guard: ShareGuard; onShared: OnShared;
}) {
  const [file, setFile]             = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [duration, setDuration]     = useState<number | null>(null);
  const [uploadPct, setUploadPct]   = useState<number | null>(null);
  const [fileError, setFileError]   = useState('');
  const [status, setStatus]         = useState<Record<VidTarget, VidState>>(IDLE_VID);
  const [waLink, setWaLink]         = useState('');
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const derived  = useRef<{ meta?: string; plain?: string }>({});
  const busy = Object.values(status).some(s => s.state === 'working');
  const tooShort = duration !== null && duration < 3;
  const productId = String(product._id);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const setTarget = (t: VidTarget, s: VidState) => setStatus(prev => ({ ...prev, [t]: s }));

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('video/')) { setFileError('That file is not a video.'); return; }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setFileError(`That video is ${(f.size / 1048576).toFixed(0)} MB. The limit is ${MAX_VIDEO_MB} MB — trim or compress it first.`); return; }
    setFileError(''); setDuration(null); setWaLink(''); setStatus(IDLE_VID);
    uploaded.current = null; derived.current = {};
    setFile(f); setPreviewUrl(URL.createObjectURL(f));
  };
  const clearFile = () => {
    setFile(null); setPreviewUrl(''); setDuration(null); setFileError(''); setWaLink(''); setStatus(IDLE_VID);
    uploaded.current = null; derived.current = {};
  };

  const ensureUploaded = async (): Promise<string> => {
    if (!file) throw new Error('Choose a video first.');
    if (uploaded.current?.file === file) return uploaded.current.url;
    setUploadPct(0);
    try {
      const url = await uploadVideoFile(file, setUploadPct);
      uploaded.current = { file, url };
      return url;
    } finally { setUploadPct(null); }
  };

  // Asks Cloudinary for an MP4 copy (9:16 for Meta, original shape for Telegram) and waits until it exists
  const prepare = async (kind: 'meta' | 'plain', original: string, report: (t: string) => void): Promise<string> => {
    if (derived.current[kind]) return derived.current[kind]!;
    for (let i = 0; i < 45; i++) {
      const d = await videoApi({ videoAction: 'prepare', videoUrl: original, kind });
      if (d.error) throw new Error(d.error);
      if (d.ready) { derived.current[kind] = d.url; return d.url; }
      report('Converting the video…');
      await sleepMs(4000);
    }
    throw new Error('Converting the video is taking too long — try a shorter or smaller video.');
  };

  const runMeta = async (target: 'instagram_reel' | 'facebook_reel' | 'instagram_story' | 'facebook_story') => {
    setTarget(target, { state: 'working', text: 'Uploading…' });
    try {
      const original = await ensureUploaded();
      const url = await prepare('meta', original, t => setTarget(target, { state: 'working', text: t }));
      setTarget(target, { state: 'working', text: 'Sending…' });
      const started = await videoApi({ videoAction: 'start', target, videoUrl: url, caption: igCaptionText(caption) });
      let ready = false;
      for (let i = 0; i < 70 && !ready; i++) {
        await sleepMs(3000);
        const s = await videoApi({ videoAction: 'status', target, containerId: started.containerId, videoId: started.videoId });
        if (s.state === 'error') throw new Error(`Rejected: ${s.detail || 'unknown reason'}`);
        if (s.state === 'ready') ready = true;
        else setTarget(target, { state: 'working', text: 'Processing…' });
      }
      if (!ready) throw new Error('Still processing after 3½ minutes — check the app in a few minutes before trying again.');
      if (target.startsWith('instagram')) {
        setTarget(target, { state: 'working', text: 'Publishing…' });
        await videoApi({ videoAction: 'publish', target, containerId: started.containerId });
      }
      setTarget(target, { state: 'ok', text: 'Posted!' });
      onShared([productId], VIDEO_CHANNEL[target]);
    } catch (e: any) { setTarget(target, { state: 'error', text: e.message || 'Failed' }); }
  };

  const runTelegram = async () => {
    setTarget('telegram', { state: 'working', text: 'Uploading…' });
    try {
      const original = await ensureUploaded();
      const url = await prepare('plain', original, t => setTarget('telegram', { state: 'working', text: t }));
      setTarget('telegram', { state: 'working', text: 'Posting…' });
      await videoApi({ videoAction: 'telegram', videoUrl: url, caption });
      setTarget('telegram', { state: 'ok', text: 'Posted to channel!' });
      onShared([productId], VIDEO_CHANNEL.telegram);
    } catch (e: any) { setTarget('telegram', { state: 'error', text: e.message || 'Failed' }); }
  };

  // WhatsApp has no posting API. Phone: native share sheet with the video attached.
  // Desktop: upload, then open WhatsApp with the caption plus a link to the video.
  const runWhatsApp = async () => {
    setWaLink('');
    setTarget('whatsapp', { state: 'working', text: 'Opening…' });
    try {
      if (file && isMobileDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: waLinkText(caption) });
        setTarget('whatsapp', { state: 'ok', text: 'Shared!' });
        onShared([productId], VIDEO_CHANNEL.whatsapp);
        return;
      }
      setTarget('whatsapp', { state: 'working', text: 'Uploading…' });
      const original = await ensureUploaded();
      const link = `https://wa.me/?text=${encodeURIComponent(`${waLinkText(caption)}\n\n▶ Watch the video:\n${original}`)}`;
      setWaLink(link);
      window.open(link, '_blank');
      setTarget('whatsapp', { state: 'ok', text: 'WhatsApp opened with a link to the video' });
      onShared([productId], VIDEO_CHANNEL.whatsapp);
    } catch (e: any) {
      if (e?.name === 'AbortError') setTarget('whatsapp', { state: 'idle' });
      else setTarget('whatsapp', { state: 'error', text: e.message || 'Failed' });
    }
  };

  const go = (t: VidTarget) => {
    if (!file || busy) return;
    guard([productId], () => {
      if (t === 'whatsapp') runWhatsApp();
      else if (t === 'telegram') runTelegram();
      else runMeta(t);
    });
  };

  const storyWarn = duration !== null && duration > 60;
  const reelWarn  = duration !== null && duration > 90;

  const renderBtn = ({ t, label, sub, cls }: { t: VidTarget; label: string; sub: string; cls: string }) => {
    const s = status[t];
    return (
      <div key={t}>
        <button onClick={() => go(t)} disabled={!file || busy || (t !== 'whatsapp' && t !== 'telegram' && tooShort)}
          className={`w-full flex flex-col items-center justify-center font-black py-3 rounded-xl transition-all shadow-sm text-xs uppercase tracking-widest disabled:opacity-40 ${
            s.state === 'ok' ? 'bg-green-500 text-white' : cls
          }`}>
          <span className="flex items-center gap-2">
            {s.state === 'working' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {s.state === 'ok' && <Check className="w-4 h-4" />}
            {label}
          </span>
          <span className="text-[9px] font-bold normal-case tracking-normal opacity-80 mt-0.5">
            {s.state === 'working' || s.state === 'ok' ? s.text : sub}
          </span>
        </button>
        {s.state === 'error' && <p className="text-[10px] font-bold text-red-500 mt-1 leading-snug">{s.text}</p>}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {!file ? (
        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 text-gray-500 font-black py-6 rounded-xl hover:border-[#FA5600] hover:text-[#FA5600] transition cursor-pointer text-xs uppercase tracking-widest">
          <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Choose a video from your device</span>
          <span className="text-[9px] font-bold normal-case tracking-normal text-gray-400">MP4 or MOV · up to {MAX_VIDEO_MB} MB · vertical 9:16 works best</span>
          <input type="file" accept="video/*" onChange={pickFile} className="hidden" />
        </label>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <video src={previewUrl} controls playsInline preload="metadata"
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
              className="w-24 h-32 rounded-lg object-contain bg-black shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-800 truncate">{file.name}</p>
              <p className="text-[10px] text-gray-400 font-bold">
                {(file.size / 1048576).toFixed(1)} MB{duration !== null ? ` · ${Math.round(duration)}s` : ''}
              </p>
              {uploadPct !== null && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#FA5600] transition-all" style={{ width: `${uploadPct}%` }} /></div>
                  <p className="text-[10px] font-bold text-gray-400 mt-1">Uploading {uploadPct}%</p>
                </div>
              )}
            </div>
            {!busy && <button onClick={clearFile} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><X className="w-4 h-4" /></button>}
          </div>
          {tooShort && <p className="text-[10px] font-bold text-red-500">Instagram and Facebook need at least 3 seconds of video.</p>}
          {reelWarn && <p className="text-[10px] font-bold text-yellow-600">Over 90 seconds — Facebook Reels may reject it. Instagram usually accepts longer.</p>}
          {storyWarn && !reelWarn && <p className="text-[10px] font-bold text-yellow-600">Over 60 seconds — video stories may be rejected. Reels are fine.</p>}
          {storyWarn && reelWarn && <p className="text-[10px] font-bold text-yellow-600">Over 60 seconds — video stories may be rejected.</p>}
        </div>
      )}
      {fileError && <p className="text-[11px] font-bold text-red-500">{fileError}</p>}

      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Chat apps</p>
          <div className="grid grid-cols-2 gap-2">
            {renderBtn({ t: 'whatsapp', label: 'WhatsApp', sub: isMobileDevice() ? 'Share sheet with the video' : 'Caption + link to video', cls: 'bg-[#25D366] hover:bg-[#20bd5a] text-white' })}
            {renderBtn({ t: 'telegram', label: 'Telegram', sub: 'Post to channel', cls: 'bg-[#2AABEE] hover:bg-[#229ED9] text-white' })}
          </div>
          {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className="block mt-1.5 text-[10px] font-black text-[#25D366] underline">Didn't open? Tap here to open WhatsApp</a>}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Feed — posted as a Reel</p>
          <div className="grid grid-cols-2 gap-2">
            {renderBtn({ t: 'instagram_reel', label: 'Instagram', sub: 'Reel + feed', cls: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white' })}
            {renderBtn({ t: 'facebook_reel', label: 'Facebook', sub: 'Reel on your Page', cls: 'bg-[#1877F2] hover:bg-[#1568d6] text-white' })}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Stories</p>
          <div className="grid grid-cols-2 gap-2">
            {renderBtn({ t: 'instagram_story', label: 'Instagram', sub: 'Video story', cls: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white' })}
            {renderBtn({ t: 'facebook_story', label: 'Facebook', sub: 'Video story', cls: 'bg-[#1877F2] hover:bg-[#1568d6] text-white' })}
          </div>
        </div>
      </div>
      <p className="text-[9px] text-gray-400 font-semibold leading-relaxed">
        The caption comes from the Message Post tab — edit it there first. Videos are converted to vertical 9:16 MP4 for Reels and stories (black bars are added, nothing is cropped).
        Reels and stories can take a minute or two to process, so keep this tab open until it says Posted.
      </p>
    </div>
  );
}

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
  const [igPostSending, setIgPostSending]     = useState(false);
  const [igPostSuccess, setIgPostSuccess]     = useState(false);
  const [fbPostSending, setFbPostSending]     = useState(false);
  const [fbPostSuccess, setFbPostSuccess]     = useState(false);

  const [rightTab, setRightTab]           = useState<'message' | 'story' | 'video'>('message');
  const [showBulkWA, setShowBulkWA]         = useState(false);

  // Share history: which products were broadcast, when, and where (stored on the server so it's the same on every device)
  const [shareHistory, setShareHistory]     = useState<Record<string, ShareInfo>>({});
  const [shareTab, setShareTab]             = useState<'toshare' | 'shared'>('toshare');
  const [shareDate, setShareDate]           = useState<'any' | 'today' | 'yesterday' | '7d' | 'custom'>('any');
  const [customDate, setCustomDate]         = useState('');
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const [pendingShare, setPendingShare]     = useState<null | {
    hits: { id: string; name: string; info: ShareInfo }[]; action: () => void; onlyNew?: () => void;
  }>(null);
  const shareLogOk = useRef(false);   // only true once the server confirms it supports the share log

  useEffect(() => {
    fetch('/api/products?shareLog=true')
      .then(r => r.json())
      .then(d => { if (d && typeof d.history === 'object') { shareLogOk.current = true; setShareHistory(d.history); } })
      .catch(() => {});
  }, []);

  const recordShare: OnShared = (ids, channel) => {
    const clean = Array.from(new Set(ids.map(String)));
    if (clean.length === 0) return;
    const now = new Date().toISOString();
    setShareHistory(prev => {
      const next = { ...prev };
      clean.forEach(id => { next[id] = { lastAt: now, channel, count: (prev[id]?.count || 0) + 1 }; });
      return next;
    });
    if (shareLogOk.current) {
      fetch('/api/products?shareLog=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: clean, channel }),
      }).catch(() => {});
    }
  };

  // Runs `action` straight away, unless one of the products was shared within the last month —
  // then it asks first. Nothing is sent until the person confirms.
  const guard: ShareGuard = (ids, action, opts) => {
    const uniq = Array.from(new Set(ids.map(String)));
    const hits = uniq
      .filter(id => isRecentShare(shareHistory[id]))
      .map(id => ({ id, name: products.find(p => String(p._id) === id)?.name || 'Product', info: shareHistory[id] }));
    if (hits.length === 0) { action(); return; }
    const hitIds = new Set(hits.map(h => h.id));
    setPendingShare({
      hits, action,
      onlyNew: opts?.onlyNew && hits.length < uniq.length ? () => opts.onlyNew!(uniq.filter(id => !hitIds.has(id))) : undefined,
    });
  };

  const categories = ['All', ...Array.from(new Set(products.map((p:any) => p.category || '').filter(Boolean))).sort()];
  useEffect(() => {
    // NOTE: the API caps `limit` at 100 per request, so a single fetch
    // silently drops anything past product #100 (sorted newest-first).
    // Page through every page until the API says there's no more.
    async function fetchAllProducts() {
      let all: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const r = await fetch(`/api/products?page=${page}&limit=100&adminView=true`);
        const d = await r.json();
        all = all.concat(d.products || []);
        hasMore = !!d.hasMore;
        page++;
      }
      return all;
    }

    fetchAllProducts()
      .then(all => setProducts(all))
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

  const resolveOrigPrice = (p: any) => p.originalPrice ? (parseFloat(String(p.originalPrice).replace(/[^0-9.]/g, '')) || 0) : 0;

  const getStock = (p: any): number | null => {
    if (p.stock?.availableStock !== undefined) return p.stock.availableStock;
    if (p.stock?.available !== undefined) return p.stock.available;
    return null;
  };

  const getProductImages = (p: any): string[] => {
    return productImageList(p);
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
    const h = shareHistory[String(p._id)];
    const inShared = isRecentShare(h);
    if (shareTab === 'toshare' && inShared) return false;
    if (shareTab === 'shared') {
      if (!inShared || !h) return false;
      const d = shareDaysAgo(h.lastAt);
      if (shareDate === 'today'     && d !== 0) return false;
      if (shareDate === 'yesterday' && d !== 1) return false;
      if (shareDate === '7d'        && d > 6)   return false;
      if (shareDate === 'custom' && customDate && shareLocalDay(h.lastAt) !== customDate) return false;
    }
    return true;
  });
  // Shared tab: newest share first, so everything shared on the same day sits together
  if (shareTab === 'shared') {
    filtered.sort((a, b) => new Date(shareHistory[String(b._id)]?.lastAt || 0).getTime() - new Date(shareHistory[String(a._id)]?.lastAt || 0).getTime());
  }
  const toShareCount = products.filter(p => !isRecentShare(shareHistory[String(p._id)])).length;
  const sharedCount  = products.length - toShareCount;
  const sharedPerDay: Record<string, number> = {};
  if (shareTab === 'shared') filtered.forEach(p => { const k = shareLocalDay(shareHistory[String(p._id)].lastAt); sharedPerDay[k] = (sharedPerDay[k] || 0) + 1; });

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
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => previewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
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
    const id = String(preview._id);
    guard([id], () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(waLinkText(customMsg))}`, '_blank');
      recordShare([id], 'whatsapp');
    });
  };

  const sendTelegramSingle = async () => {
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
      recordShare([String(preview._id)], 'telegram');
      setTelegramSuccess(true);
      setTimeout(() => setTelegramSuccess(false), 3000);
    } catch (err: any) {
      alert('❌ Telegram Error: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleTelegramSingle = () => {
    if (!preview) return;
    guard([String(preview._id)], () => { sendTelegramSingle(); });
  };

  const sendInstagramPost = async () => {
    if (!preview) return;
    setIgPostSending(true);
    setIgPostSuccess(false);
    const allImages = getProductImages(preview);
    const imageUrl  = allImages[selectedImageIndex] || allImages[0] || '';
    if (!imageUrl) { alert('❌ This product has no image to post.'); setIgPostSending(false); return; }
    try {
      const res  = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagramPost: true, imageUrl, caption: igCaptionText(customMsg) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');
      recordShare([String(preview._id)], 'instagram');
      setIgPostSuccess(true);
      setTimeout(() => setIgPostSuccess(false), 3000);
    } catch (err: any) {
      alert('❌ Instagram Error: ' + err.message);
    } finally {
      setIgPostSending(false);
    }
  };

  const handleInstagramPost = () => {
    if (!preview) return;
    guard([String(preview._id)], () => { sendInstagramPost(); });
  };

  const sendFacebookPost = async () => {
    if (!preview) return;
    setFbPostSending(true);
    setFbPostSuccess(false);
    const allImages = getProductImages(preview);
    const imageUrl  = allImages[selectedImageIndex] || allImages[0] || '';
    if (!imageUrl) { alert('❌ This product has no image to post.'); setFbPostSending(false); return; }
    try {
      const res  = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebookPost: true, imageUrl, caption: igCaptionText(customMsg) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');
      recordShare([String(preview._id)], 'facebook');
      setFbPostSuccess(true);
      setTimeout(() => setFbPostSuccess(false), 3000);
    } catch (err: any) {
      alert('❌ Facebook Error: ' + err.message);
    } finally {
      setFbPostSending(false);
    }
  };

  const handleFacebookPost = () => {
    if (!preview) return;
    guard([String(preview._id)], () => { sendFacebookPost(); });
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

  const runTelegramBatch = async (ids: string[]) => {
    if (ids.length === 0) return;
    const wanted = new Set(ids);
    const toSend = products.filter(p => wanted.has(String(p._id)));
    setSending(true);
    setProgress({ current: 0, total: toSend.length });
    setDoneCount(0);
    let done = 0;
    const okIds: string[] = [];
    for (const p of toSend) {
      const imgs = getProductImages(p);
      try {
        const r = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broadcast: true, imageUrl: imgs[0] || '', message: generateMessage(p) }),
        });
        if (r.ok) okIds.push(String(p._id));
      } catch { /* continue */ }
      done++;
      setProgress({ current: done, total: toSend.length });
      if (done < toSend.length) await new Promise(r => setTimeout(r, 1500));
    }
    recordShare(okIds, 'telegram');
    setDoneCount(done);
    setSending(false);
    setTimeout(() => { setProgress(null); setDoneCount(0); setSelectedIds(new Set()); }, 4000);
  };

  const handleTelegramBatch = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).map(String);
    guard(ids, () => { runTelegramBatch(ids); }, { onlyNew: fresh => { runTelegramBatch(fresh); } });
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-5">
      <SectionHeader icon={Megaphone} title="Product Broadcast" desc="Send promo messages via WhatsApp or Telegram, or post product stories to Instagram, Facebook & WhatsApp Status" />

      {/* ── Sticky Send Bar ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-md px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${selectedCount > 0 ? 'bg-[#FA5600] text-white' : 'bg-gray-100 text-gray-400'}`}>
            {selectedCount}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-800">
              {selectedCount === 0 ? 'Tick checkboxes to batch-send to Telegram or WhatsApp' : `${selectedCount} product${selectedCount > 1 ? 's' : ''} selected for batch send`}
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
          <button onClick={() => setShowBulkWA(true)} disabled={selectedCount === 0}
            className="flex items-center gap-2 font-black py-2 px-4 rounded-xl transition-all text-sm uppercase tracking-widest disabled:opacity-50 bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-md">
            WhatsApp {selectedCount > 0 ? `(${selectedCount})` : ''}
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

          {/* To Share / Shared folders */}
          <div className="flex gap-2 p-3 border-b border-gray-100 bg-white">
            {([['toshare', 'To Share', toShareCount], ['shared', `Shared · last ${RECENT_SHARE_DAYS}d`, sharedCount]] as const).map(([id, label, n]) => (
              <button key={id} onClick={() => { setShareTab(id); setSelectedIds(new Set()); }}
                className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl border-2 transition-all ${
                  shareTab === id ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-500 bg-white hover:border-[#FA5600]/50'
                }`}>{label} ({n})</button>
            ))}
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Filters</p>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white" />
            {/* Category */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border-2 transition-all ${
                    categoryFilter === cat ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-400 bg-white hover:border-[#FA5600]/50'
                  }`}>{cat}</button>
              ))}
            </div>
            {/* Shared-date filter (Shared tab only) */}
            {shareTab === 'shared' && (
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase shrink-0">Shared</span>
                {([['any', 'Any day'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => { setShareDate(id); setCustomDate(''); }}
                    className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full border-2 transition-all ${
                      shareDate === id ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-400'
                    }`}>{label}</button>
                ))}
                <input type="date" value={customDate}
                  min={shareLocalDay(new Date(Date.now() - (RECENT_SHARE_DAYS - 1) * 86400000).toISOString())}
                  max={shareLocalDay(new Date().toISOString())}
                  onChange={e => { setCustomDate(e.target.value); setShareDate(e.target.value ? 'custom' : 'any'); }}
                  className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border-2 outline-none bg-white ${shareDate === 'custom' ? 'border-gray-800 text-gray-800' : 'border-gray-200 text-gray-500'}`} />
              </div>
            )}
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
                <p className="font-black text-sm uppercase tracking-widest">
                  {shareTab === 'shared' && sharedCount === 0 ? `Nothing shared in the last ${RECENT_SHARE_DAYS} days` : 'No products match filters'}
                </p>
              </div>
            ) : filtered.map((p, idx) => {
              const price      = resolvePrice(p);
              const stock      = getStock(p);
              const isChecked  = selectedIds.has(p._id);
              const isPreviewed = preview?._id === p._id;
              const sInfo      = shareHistory[String(p._id)];
              const dayKey     = shareTab === 'shared' && sInfo ? shareLocalDay(sInfo.lastAt) : '';
              const prevInfo   = idx > 0 ? shareHistory[String(filtered[idx - 1]._id)] : undefined;
              const showDayHeader = !!dayKey && (!prevInfo || shareLocalDay(prevInfo.lastAt) !== dayKey);
              return (
                <Fragment key={p._id}>
                {showDayHeader && (
                  <div className="px-4 py-1.5 bg-gray-100 border-b border-gray-200 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-600">
                    <span>{shareDateLabel(sInfo!.lastAt)} · {shareAgoLabel(sInfo!.lastAt)}</span>
                    <span className="text-gray-400">{sharedPerDay[dayKey]} product{sharedPerDay[dayKey] > 1 ? 's' : ''}</span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition ${isPreviewed ? 'bg-orange-50' : 'hover:bg-gray-50'} ${isChecked ? 'border-l-4 border-l-[#FA5600]' : ''}`}>
                  {/* Checkbox for batch */}
                  <button onClick={() => toggleSelect(p._id)}
                    className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${isChecked ? 'bg-[#FA5600] border-[#FA5600]' : 'border-gray-300 hover:border-[#FA5600]'}`}>
                    {isChecked && <Check className="w-3 h-3 text-white"/>}
                  </button>
                  {/* Thumbnail — click to preview */}
                  <button onClick={() => selectPreview(p)} className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200 hover:border-[#FA5600] transition">
                    {productImageList(p)[0] ? (
                      <img src={productImageList(p)[0]} alt={p.name} className="w-full h-full object-cover"/>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-5 h-5"/></div>
                    )}
                  </button>
                  {/* Info — click to preview */}
                  <button onClick={() => selectPreview(p)} className="flex-1 min-w-0 text-left">
                    <p className="font-black text-sm text-gray-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">{p.category}</p>
                    {sInfo && (
                      <span className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <ShareBadge info={sInfo} />
                        {shareTab === 'shared' && <span className="text-[9px] font-bold text-gray-400">{shareBackInLabel(sInfo.lastAt)}</span>}
                      </span>
                    )}
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
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Single product preview + WhatsApp/Telegram/Copy */}
        <div ref={previewPanelRef} className="flex flex-col gap-4 scroll-mt-24">
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
                    {shareHistory[String(preview._id)] && <div className="mt-1"><ShareBadge info={shareHistory[String(preview._id)]} /></div>}
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

                {/* Tabs: Message vs Story */}
                <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
                  {([['message', 'Message Post'], ['story', 'Story'], ['video', 'Video']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setRightTab(id)}
                      className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl border-2 transition-all ${
                        rightTab === id ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-400 bg-white hover:border-[#FA5600]/50'
                      }`}>{label}</button>
                  ))}
                </div>

                {rightTab === 'story' && (
                  <StoryComposer
                    product={preview}
                    imageUrl={getProductImages(preview)[selectedImageIndex] || ''}
                    price={resolvePrice(preview)}
                    origPrice={resolveOrigPrice(preview)}
                    caption={customMsg}
                    description={preview.description || ''}
                    guard={guard}
                    onShared={recordShare}
                  />
                )}

                {/* Video: WhatsApp, Telegram, Instagram/Facebook Reels, Instagram/Facebook video stories */}
                <div className={rightTab === 'video' ? '' : 'hidden'}>
                  <VideoSharePanel key={String(preview._id)} product={preview} caption={customMsg} guard={guard} onShared={recordShare} />
                </div>

                {/* Editable message */}
                {rightTab === 'message' && (
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
                )}
              </div>

              {/* Send buttons */}
              {rightTab === 'message' && (
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 grid grid-cols-1 gap-2">
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

                {/* Instagram feed post (a real post, not a story) */}
                <button onClick={handleInstagramPost} disabled={igPostSending}
                  className={`w-full flex items-center justify-center gap-3 font-black py-3.5 rounded-xl transition-all shadow-md text-sm uppercase tracking-widest disabled:opacity-60 ${
                    igPostSuccess ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white'
                  }`}>
                  {igPostSending ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Posting...</>
                  ) : igPostSuccess ? (
                    <><Check className="w-5 h-5"/> Posted to Instagram!</>
                  ) : (
                    <><Send className="w-5 h-5" /> Post to Instagram Feed</>
                  )}
                </button>

                {/* Facebook feed post (a real post, not a story) */}
                <button onClick={handleFacebookPost} disabled={fbPostSending}
                  className={`w-full flex items-center justify-center gap-3 font-black py-3.5 rounded-xl transition-all shadow-md text-sm uppercase tracking-widest disabled:opacity-60 ${
                    fbPostSuccess ? 'bg-green-500 text-white' : 'bg-[#1877F2] hover:bg-[#1568d6] text-white'
                  }`}>
                  {fbPostSending ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Posting...</>
                  ) : fbPostSuccess ? (
                    <><Check className="w-5 h-5"/> Posted to Facebook!</>
                  ) : (
                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Post to Facebook Feed</>
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
              )}
            </>
          )}
        </div>
      </div>
      {showBulkWA && (
        <BulkWhatsAppModal
          items={products.filter(p => selectedIds.has(p._id)).map(p => ({
            id: String(p._id), name: p.name || '', description: p.description || '', price: resolvePrice(p), origPrice: resolveOrigPrice(p),
            image: getProductImages(p)[0] || '',
          }))}
          onClose={() => setShowBulkWA(false)}
          guard={guard}
          onShared={recordShare}
        />
      )}
      {pendingShare && (
        <ShareGuardModal
          hits={pendingShare.hits}
          onCancel={() => setPendingShare(null)}
          onConfirm={() => { const run = pendingShare.action; setPendingShare(null); run(); }}
          onOnlyNew={pendingShare.onlyNew ? () => { const run = pendingShare.onlyNew!; setPendingShare(null); run(); } : undefined}
        />
      )}
    </div>
  );
}

export default AdminPanel;
