import { useState, useEffect, useRef } from 'react';
import { AddProductFormEmbed } from './AddProductFormEmbed';
import { ManageCategoriesEmbed } from './ManageCategoriesEmbed';
import { InventoryEmbed } from './InventoryEmbed';
import { BusinessEmbed } from './BusinessEmbed';
import {
  Lock, LogOut, Megaphone, Image, Tag, Package, FolderTree,
  ChevronRight, Save, Check, Trash2, Eye, Upload, BarChart2
} from 'lucide-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';
const SESSION_KEY = 'adminAuth';

type Section = 'home' | 'promo' | 'banner' | 'category-images' | 'products' | 'categories' | 'inventory' | 'business';

interface BannerSlide { image: string; text: string; description: string; }
interface PromoLine { text: string; }

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('home');

  const [promoLines, setPromoLines] = useState<PromoLine[]>([
    { text: '🔥 TAGS · Free Shipping on Orders Over ₹999 · Up to 90% Off Today!' },
    { text: '' }, { text: '' }, { text: '' }, { text: '' },
  ]);
  const [promoSaved, setPromoSaved] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);

  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>([
    { image: '', text: '', description: '' },
    { image: '', text: '', description: '' },
    { image: '', text: '', description: '' },
    { image: '', text: '', description: '' },
    { image: '', text: '', description: '' },
  ]);
  const [bannerSaved, setBannerSaved] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState<number | null>(null);
  const bannerRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [categories, setCategories] = useState<any[]>([]);
  const [catSaving, setCatSaving] = useState<string | null>(null);
  const [catSaved, setCatSaved] = useState<string | null>(null);
  const [catUploading, setCatUploading] = useState<string | null>(null);
  const [catImages, setCatImages] = useState<Record<string, string>>({});
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/banner')
      .then(r => r.json())
      .then(data => {
        if (data.promoLines && Array.isArray(data.promoLines)) {
          const lines = [...data.promoLines];
          while (lines.length < 5) lines.push({ text: '' });
          setPromoLines(lines.slice(0, 5));
        } else if (data.promoText) {
          setPromoLines(prev => { const n = [...prev]; n[0] = { text: data.promoText }; return n; });
        }
        if (data.bannerSlides && Array.isArray(data.bannerSlides)) {
          const slides = data.bannerSlides.map((s: any) => ({
            image: s.image || '', text: s.text || '', description: s.description || '',
          }));
          while (slides.length < 5) slides.push({ image: '', text: '', description: '' });
          setBannerSlides(slides.slice(0, 5));
        } else if (data.bannerImage) {
          setBannerSlides(prev => { const n = [...prev]; n[0] = { image: data.bannerImage, text: data.bannerText || '', description: '' }; return n; });
        }
      }).catch(() => {});

    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        const main = Array.isArray(data) ? data.filter((c: any) => !c.parentId) : [];
        setCategories(main);
        const imgs: Record<string, string> = {};
        main.forEach((c: any) => { imgs[c._id] = c.image || ''; });
        setCatImages(imgs);
      }).catch(() => {});
  }, [isAuthenticated]);

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password.');
      setPasswordInput('');
    }
  };

  const handleLock = () => { sessionStorage.removeItem(SESSION_KEY); setIsAuthenticated(false); };

  const uploadImage = async (file: File): Promise<string> => {
    const res = await fetch('/api/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
    const data = await res.json();
    if (!data.url) throw new Error('Upload failed');
    return data.url;
  };

  const handleBannerImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(index);
    try {
      const url = await uploadImage(file);
      setBannerSlides(prev => { const n = [...prev]; n[index] = { ...n[index], image: url }; return n; });
    } catch { alert('Image upload failed.'); }
    finally { setBannerUploading(null); }
  };

  const handleCatImageUpload = async (catId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCatUploading(catId);
    try {
      const url = await uploadImage(file);
      setCatImages(prev => ({ ...prev, [catId]: url }));
    } catch { alert('Image upload failed.'); }
    finally { setCatUploading(null); }
  };

  const handleSavePromo = async () => {
    setPromoLoading(true);
    try {
      const activeLines = promoLines.filter(l => l.text.trim());
      await fetch('/api/banner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoLines, promoText: activeLines[0]?.text || '', bannerSlides, bannerImage: bannerSlides[0]?.image || '', bannerText: bannerSlides[0]?.text || '' }),
      });
      setPromoSaved(true); setTimeout(() => setPromoSaved(false), 2500);
    } catch { alert('Failed to save.'); }
    finally { setPromoLoading(false); }
  };

  const handleSaveBanners = async () => {
    setBannerLoading(true);
    try {
      const activeLines = promoLines.filter(l => l.text.trim());
      await fetch('/api/banner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoLines, promoText: activeLines[0]?.text || '', bannerSlides, bannerImage: bannerSlides[0]?.image || '', bannerText: bannerSlides[0]?.text || '' }),
      });
      setBannerSaved(true); setTimeout(() => setBannerSaved(false), 2500);
    } catch { alert('Failed to save.'); }
    finally { setBannerLoading(false); }
  };

  const handleSaveCategoryImage = async (catId: string) => {
    setCatSaving(catId);
    try {
      await fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: catId, image: catImages[catId] }) });
      setCatSaved(catId); setTimeout(() => setCatSaved(null), 2500);
    } catch { alert('Failed to save.'); }
    finally { setCatSaving(null); }
  };

  const menuItems = [
    { id: 'promo', label: 'Offer Bar', icon: Megaphone, desc: 'Set up to 5 scrolling announcement lines' },
    { id: 'banner', label: 'Hero Banners', icon: Image, desc: 'Upload up to 5 banners with heading & description' },
    { id: 'category-images', label: 'Category Images', icon: Tag, desc: 'Upload cover images for each category' },
    { id: 'products', label: 'Add & Edit Products', icon: Package, desc: 'Manage your product catalog' },
    { id: 'categories', label: 'Manage Categories', icon: FolderTree, desc: 'Add or edit categories & subcategories' },
    { id: 'inventory', label: 'Inventory', icon: BarChart2, desc: 'Track stock levels, set alerts & adjust quantities' },
    { id: 'business', label: 'Business', icon: BarChart2, desc: 'Sales, Purchase Orders, Cash Flow, Reports' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#FA5600] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Admin Panel</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your password to continue</p>
          </div>
          <input type="password" value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-center text-lg focus:ring-2 focus:ring-[#FA5600] focus:border-[#FA5600] outline-none mb-3" autoFocus />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button onClick={handlePasswordSubmit}
            className="w-full bg-[#FA5600] text-white font-black py-3 rounded-xl hover:bg-[#E04A00] transition uppercase tracking-widest">
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-[#1A1A1A] text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FA5600] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">T</span>
          </div>
          <div>
            <h1 className="font-black uppercase tracking-widest text-sm">TAGS Admin</h1>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" target="_blank" className="text-xs text-white/60 hover:text-white flex items-center gap-1 transition">
            <Eye className="w-3.5 h-3.5" /> View Site
          </a>
          <button onClick={handleLock}
            className="flex items-center gap-2 text-xs text-white/60 hover:text-red-400 transition font-bold">
            <LogOut className="w-4 h-4" /> Lock
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* HOME MENU */}
        {activeSection === 'home' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">What would you like to update?</h2>
              <p className="text-sm text-gray-500 mt-1">Select a section to manage</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {menuItems.map(item => (
                <button key={item.id} onClick={() => setActiveSection(item.id as Section)}
                  className="bg-white border-2 border-gray-200 hover:border-[#FA5600] rounded-2xl p-6 text-left flex items-center gap-4 transition-all hover:shadow-md group">
                  <div className="w-12 h-12 bg-[#FFF3E0] group-hover:bg-[#FA5600] rounded-xl flex items-center justify-center transition-colors shrink-0">
                    <item.icon className="w-6 h-6 text-[#FA5600] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm">{item.label}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FA5600] transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* OFFER BAR */}
        {activeSection === 'promo' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={Megaphone} title="Offer Bar" desc="Add up to 5 lines — they scroll one by one" />
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">
              {promoLines.map((line, i) => (
                <div key={i}>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                    Line {i + 1} {i === 0 && <span className="text-[#FA5600]">*</span>}
                  </label>
                  <input type="text" value={line.text}
                    onChange={e => setPromoLines(prev => { const n = [...prev]; n[i] = { text: e.target.value }; return n; })}
                    placeholder={i === 0 ? '🔥 TAGS · Free Shipping on Orders Over ₹999...' : `Optional line ${i + 1}...`}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold focus:border-[#FA5600] outline-none transition" />
                </div>
              ))}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Preview</p>
                <div className="bg-[#FA5600] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 text-center rounded-lg">
                  {promoLines.filter(l => l.text.trim()).map((l, i, arr) => (
                    <span key={i}>{l.text}{i < arr.length - 1 ? '  ·  ' : ''}</span>
                  ))}
                </div>
              </div>
              <SaveButton onClick={handleSavePromo} loading={promoLoading} saved={promoSaved} />
            </div>
          </div>
        )}

        {/* HERO BANNERS */}
        {activeSection === 'banner' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={Image} title="Hero Banners" desc="Upload up to 5 banners — auto-rotate every 5 seconds" />
            <div className="space-y-4">
              {bannerSlides.map((slide, i) => (
                <div key={i} className="bg-white rounded-2xl border-2 border-gray-200 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
                    Banner {i + 1} {i === 0 && <span className="text-[#FA5600]">*</span>}
                  </p>
                  <div className="flex gap-4">
                    <div onClick={() => bannerRefs[i].current?.click()}
                      className="w-28 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#FA5600] cursor-pointer flex items-center justify-center overflow-hidden shrink-0 transition bg-gray-50">
                      {bannerUploading === i ? (
                        <p className="text-[10px] text-gray-400 font-bold">Uploading...</p>
                      ) : slide.image ? (
                        <img src={slide.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-5 h-5 text-gray-300 mx-auto mb-1" />
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Upload</p>
                        </div>
                      )}
                      <input ref={bannerRefs[i]} type="file" accept="image/png,image/jpeg,image/webp"
                        onChange={e => handleBannerImageUpload(i, e)} className="hidden" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Overlay Heading</label>
                        <input type="text" value={slide.text}
                          onChange={e => setBannerSlides(prev => { const n = [...prev]; n[i] = { ...n[i], text: e.target.value }; return n; })}
                          placeholder="e.g. Discover Great Toys & Gear"
                          className="w-full border-2 border-gray-200 rounded-xl p-2.5 font-bold focus:border-[#FA5600] outline-none transition text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Description</label>
                        <input type="text" value={slide.description}
                          onChange={e => setBannerSlides(prev => { const n = [...prev]; n[i] = { ...n[i], description: e.target.value }; return n; })}
                          placeholder="e.g. Browse and order via WhatsApp!"
                          className="w-full border-2 border-gray-200 rounded-xl p-2.5 font-bold focus:border-[#FA5600] outline-none transition text-sm" />
                      </div>
                      {slide.image && (
                        <button onClick={() => setBannerSlides(prev => { const n = [...prev]; n[i] = { image: '', text: '', description: '' }; return n; })}
                          className="text-xs text-red-400 hover:text-red-600 font-bold flex items-center gap-1 transition">
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {slide.image && (
                    <div className="mt-3 relative h-20 rounded-lg overflow-hidden border border-gray-200">
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
          </div>
        )}

        {/* ADD & EDIT PRODUCTS */}
        {activeSection === 'products' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <AddProductFormEmbed />
          </div>
        )}

        {/* MANAGE CATEGORIES */}
        {activeSection === 'categories' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <ManageCategoriesEmbed />
          </div>
        )}

        {/* CATEGORY IMAGES */}
        {activeSection === 'category-images' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={Tag} title="Category Images" desc="Upload a cover image for each category" />
            <div className="space-y-4">
              {categories.length === 0 && (
                <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center text-gray-400 text-sm">No categories found.</div>
              )}
              {categories.map(cat => (
                <div key={cat._id} className="bg-white rounded-2xl border-2 border-gray-200 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-700 mb-3">{cat.name}</p>
                  <div className="flex items-center gap-4">
                    <div onClick={() => catRefs.current[cat._id]?.click()}
                      className="w-20 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#FA5600] cursor-pointer flex items-center justify-center overflow-hidden shrink-0 transition bg-gray-50">
                      {catUploading === cat._id ? (
                        <p className="text-[9px] text-gray-400 font-bold">...</p>
                      ) : catImages[cat._id] ? (
                        <img src={catImages[cat._id]} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-4 h-4 text-gray-300 mx-auto mb-0.5" />
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Upload</p>
                        </div>
                      )}
                      <input ref={el => { catRefs.current[cat._id] = el; }} type="file" accept="image/png,image/jpeg,image/webp"
                        onChange={e => handleCatImageUpload(cat._id, e)} className="hidden" />
                    </div>
                    <div className="flex-1 text-xs text-gray-400">
                      {catImages[cat._id] ? 'Image uploaded ✓ — click to replace' : 'Click the box to upload an image'}
                    </div>
                    <button onClick={() => handleSaveCategoryImage(cat._id)} disabled={catSaving === cat._id}
                      className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition ${catSaved === cat._id ? 'bg-green-500 text-white' : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'}`}>
                      {catSaved === cat._id ? <><Check className="w-3.5 h-3.5" /> Saved</> : catSaving === cat._id ? '...' : <><Save className="w-3.5 h-3.5" /> Save</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {activeSection === 'inventory' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={BarChart2} title="Inventory" desc="Track stock levels, set alerts & adjust quantities" />
            <InventoryEmbed />
          </div>
        )}

        {/* BUSINESS */}
        {activeSection === 'business' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={BarChart2} title="Business" desc="Sales, Purchase Orders, Cash Flow, Expenses, Suppliers & Reports" />
            <BusinessEmbed />
          </div>
        )}

      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#FA5600] transition mb-6">
      ← Back to Menu
    </button>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 bg-[#FFF3E0] rounded-xl flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-[#FA5600]" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{title}</h2>
        <p className="text-sm text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition ${saved ? 'bg-green-500 text-white' : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'} disabled:opacity-60`}>
      {saved ? <><Check className="w-4 h-4" /> Saved!</> : loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
    </button>
  );
}

export default AdminPanel;
