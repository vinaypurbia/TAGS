import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, LogOut, Megaphone, Image, Tag, Package, FolderTree,
  ChevronRight, Save, Check, AlertCircle, Upload, Eye
} from 'lucide-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

type Section = 'home' | 'promo' | 'banner' | 'category-images' | 'products' | 'categories';

export function AdminPanel() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('home');

  // Promo + Banner state
  const [settings, setSettings] = useState({ promoText: '', bannerImage: '', bannerText: '' });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Category images state
  const [categories, setCategories] = useState<any[]>([]);
  const [catSaving, setCatSaving] = useState<string | null>(null);
  const [catSaved, setCatSaved] = useState<string | null>(null);
  const [catImageInputs, setCatImageInputs] = useState<Record<string, string>>({});

  // Load settings and categories once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/banner')
      .then(r => r.json())
      .then(data => {
        setSettings({
          promoText: data.promoText || '',
          bannerImage: data.bannerImage || '',
          bannerText: data.bannerText || '',
        });
      })
      .catch(() => {});

    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        const main = Array.isArray(data) ? data.filter((c: any) => !c.parentId) : [];
        setCategories(main);
        const inputs: Record<string, string> = {};
        main.forEach((c: any) => { inputs[c._id] = c.image || ''; });
        setCatImageInputs(inputs);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password.');
      setPasswordInput('');
    }
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await fetch('/api/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveCategoryImage = async (catId: string) => {
    setCatSaving(catId);
    try {
      await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catId, image: catImageInputs[catId] }),
      });
      setCatSaved(catId);
      setTimeout(() => setCatSaved(null), 2500);
    } catch {
      alert('Failed to save category image.');
    } finally {
      setCatSaving(null);
    }
  };

  const menuItems = [
    { id: 'promo', label: 'Offer Bar', icon: Megaphone, desc: 'Update top announcement text' },
    { id: 'banner', label: 'Hero Banner', icon: Image, desc: 'Update banner image & text' },
    { id: 'category-images', label: 'Category Images', icon: Tag, desc: 'Update category cover images' },
    { id: 'products', label: 'Add & Edit Products', icon: Package, desc: 'Manage your product catalog' },
    { id: 'categories', label: 'Manage Categories', icon: FolderTree, desc: 'Add or edit categories' },
  ];

  // PASSWORD SCREEN
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
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-center text-lg focus:ring-2 focus:ring-[#FA5600] focus:border-[#FA5600] outline-none mb-3"
            autoFocus
          />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button
            onClick={handlePasswordSubmit}
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
        <div className="flex items-center gap-3">
          <a href="/" target="_blank" className="text-xs text-white/60 hover:text-white flex items-center gap-1 transition">
            <Eye className="w-3.5 h-3.5" /> View Site
          </a>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-2 text-xs text-white/60 hover:text-red-400 transition font-bold">
            <LogOut className="w-4 h-4" /> Lock
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* HOME — menu grid */}
        {activeSection === 'home' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">What would you like to update?</h2>
              <p className="text-sm text-gray-500 mt-1">Select a section to manage</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'products') navigate('/add-product');
                    else if (item.id === 'categories') navigate('/manage-categories');
                    else setActiveSection(item.id as Section);
                  }}
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

        {/* PROMO BAR */}
        {activeSection === 'promo' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={Megaphone} title="Offer Bar" desc="Update the announcement text shown at the very top of your site" />
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-2">
                Announcement Text
              </label>
              <input
                type="text"
                value={settings.promoText}
                onChange={e => setSettings(s => ({ ...s, promoText: e.target.value }))}
                placeholder="🔥 TAGS · Free Shipping on Orders Over ₹999 · Up to 90% Off Today!"
                className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold focus:border-[#FA5600] outline-none transition mb-2"
              />
              <p className="text-xs text-gray-400 mb-6">Tip: Use emojis to make it stand out. Keep it short and punchy.</p>

              {/* Live preview */}
              <div className="mb-6">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Preview</p>
                <div className="bg-[#FA5600] text-white text-[10px] font-bold uppercase tracking-widest px-8 py-1.5 text-center rounded-lg">
                  {settings.promoText || '(empty)'}
                </div>
              </div>

              <SaveButton onClick={handleSaveSettings} loading={settingsLoading} saved={settingsSaved} />
            </div>
          </div>
        )}

        {/* HERO BANNER */}
        {activeSection === 'banner' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={Image} title="Hero Banner" desc="Update the main banner image and overlay headline text" />
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-6">

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-2">
                  Banner Image URL
                </label>
                <input
                  type="url"
                  value={settings.bannerImage}
                  onChange={e => setSettings(s => ({ ...s, bannerImage: e.target.value }))}
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold focus:border-[#FA5600] outline-none transition"
                />
                <p className="text-xs text-gray-400 mt-1">Paste a Cloudinary or any direct image URL. Recommended: 1600×600px.</p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-2">
                  Headline Text
                </label>
                <input
                  type="text"
                  value={settings.bannerText}
                  onChange={e => setSettings(s => ({ ...s, bannerText: e.target.value }))}
                  placeholder="Discover Great Toys, Gear & Sports"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold focus:border-[#FA5600] outline-none transition"
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty to show the default headline.</p>
              </div>

              {/* Live preview */}
              {settings.bannerImage && (
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Image Preview</p>
                  <div className="relative h-32 rounded-xl overflow-hidden border-2 border-gray-200">
                    <img src={settings.bannerImage} alt="Banner preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <p className="text-white font-black uppercase text-lg tracking-tight text-center px-4">
                        {settings.bannerText || 'Discover Great Toys, Gear & Sports'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <SaveButton onClick={handleSaveSettings} loading={settingsLoading} saved={settingsSaved} />
            </div>
          </div>
        )}

        {/* CATEGORY IMAGES */}
        {activeSection === 'category-images' && (
          <div>
            <BackButton onClick={() => setActiveSection('home')} />
            <SectionHeader icon={Tag} title="Category Images" desc="Update the cover image for each category shown on the homepage" />
            <div className="space-y-4">
              {categories.length === 0 && (
                <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center text-gray-400 text-sm">
                  No categories found.
                </div>
              )}
              {categories.map(cat => (
                <div key={cat._id} className="bg-white rounded-2xl border-2 border-gray-200 p-5">
                  <div className="flex items-center gap-4">
                    {/* Current image thumbnail */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-gray-200 shrink-0 bg-gray-100 flex items-center justify-center">
                      {catImageInputs[cat._id] ? (
                        <img src={catImageInputs[cat._id]} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <Tag className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-black uppercase tracking-tight text-sm text-gray-900 mb-2">{cat.name}</p>
                      <input
                        type="url"
                        value={catImageInputs[cat._id] || ''}
                        onChange={e => setCatImageInputs(prev => ({ ...prev, [cat._id]: e.target.value }))}
                        placeholder="Paste image URL..."
                        className="w-full border-2 border-gray-200 rounded-lg p-2 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveCategoryImage(cat._id)}
                      disabled={catSaving === cat._id}
                      className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition ${
                        catSaved === cat._id
                          ? 'bg-green-500 text-white'
                          : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'
                      }`}>
                      {catSaved === cat._id ? (
                        <><Check className="w-3.5 h-3.5" /> Saved</>
                      ) : catSaving === cat._id ? (
                        '...'
                      ) : (
                        <><Save className="w-3.5 h-3.5" /> Save</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Reusable sub-components ──

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
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition ${
        saved ? 'bg-green-500 text-white' : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'
      } disabled:opacity-60`}>
      {saved ? (
        <><Check className="w-4 h-4" /> Saved!</>
      ) : loading ? (
        'Saving...'
      ) : (
        <><Save className="w-4 h-4" /> Save Changes</>
      )}
    </button>
  );
}

export default AdminPanel;
