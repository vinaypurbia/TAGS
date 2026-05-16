import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Filter, SlidersHorizontal, Image as ImageIcon, Tag, ChevronDown, X, Check, Pencil, Trash2, Plus, Upload, Eye, RotateCcw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  originalPrice: number | string;
  discountedPrice?: number | string;
  description?: string;
  videoUrl?: string;
  imageUrl?: string;
  imageUrls?: string[];
  image?: string;
}

interface EditState {
  name: string;
  originalPrice: string;
  discountedPrice: string;
  category: string;
  subcategory: string;
  description: string;
  videoUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getImg = (p: Product): string | null =>
  p.imageUrls?.[0] || p.imageUrl || p.image || null;

const getPrice = (p: Product): number =>
  Number(p.discountedPrice || p.originalPrice) || 0;

const getOrigPrice = (p: Product): number => Number(p.originalPrice) || 0;

const hasDiscount = (p: Product): boolean =>
  !!p.discountedPrice && Number(p.discountedPrice) < Number(p.originalPrice);

const discountPct = (p: Product): number => {
  if (!hasDiscount(p)) return 0;
  return Math.round(((Number(p.originalPrice) - Number(p.discountedPrice)) / Number(p.originalPrice)) * 100);
};

const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const yt = url.match(/youtube\.com\/watch\?v=([\w-]+)/) || url.match(/youtu\.be\/([\w-]+)/) || url.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  if (url.includes('facebook.com') || url.includes('fb.watch'))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`;
  const ig = url.match(/instagram\.com\/(reel|p)\/([\w-]+)/);
  if (ig) return `https://www.instagram.com/${ig[1]}/${ig[2]}/embed`;
  const tt = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
  if (tt) return `https://www.tiktok.com/embed/${tt[1]}`;
  return null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all whitespace-nowrap
        ${active
          ? 'bg-[#FA5600] border-[#FA5600] text-white shadow-sm shadow-orange-200'
          : 'bg-white border-gray-200 text-gray-500 hover:border-[#FA5600] hover:text-[#FA5600]'}`}>
      {label}
    </button>
  );
}

function ProductCard({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const img = getImg(product);
  const disc = discountPct(product);

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-200 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {img ? (
          <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
            <ImageIcon className="w-8 h-8" />
            <span className="text-[10px] font-black uppercase tracking-widest">No Image</span>
          </div>
        )}
        {disc > 0 && (
          <span className="absolute top-2 left-2 bg-[#FA5600] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
            -{disc}%
          </span>
        )}
        {/* Edit button overlay */}
        <button
          onClick={onEdit}
          className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white text-gray-900 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </span>
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col justify-between gap-1">
        <div>
          <p className="text-xs font-black text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 font-bold">{product.category}{product.subcategory ? ` › ${product.subcategory}` : ''}</p>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div>
            {hasDiscount(product) ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-[#FA5600]">₹{Number(product.discountedPrice).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-gray-400 line-through">₹{Number(product.originalPrice).toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <span className="text-sm font-black text-gray-900">₹{Number(product.originalPrice).toLocaleString('en-IN')}</span>
            )}
          </div>
          <button
            onClick={onEdit}
            className="w-7 h-7 bg-orange-50 hover:bg-[#FA5600] rounded-xl flex items-center justify-center transition-colors group/btn">
            <Pencil className="w-3.5 h-3.5 text-[#FA5600] group-hover/btn:text-white transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  product,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  product: Product;
  categories: any[];
  onClose: () => void;
  onSaved: (updated: Product) => void;
  onDeleted: (id: string) => void;
}) {
  const [formData, setFormData] = useState<EditState>({
    name: product.name || '',
    originalPrice: String(product.originalPrice || ''),
    discountedPrice: String(product.discountedPrice || ''),
    category: product.category || '',
    subcategory: product.subcategory || '',
    description: product.description || '',
    videoUrl: product.videoUrl || '',
  });

  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(
    product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []
  );
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [videoUrlError, setVideoUrlError] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(
    product.videoUrl ? getEmbedUrl(product.videoUrl) : null
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  const imageInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const parentCategories = categories.filter((c: any) => !c.parentId);

  useEffect(() => {
    if (!formData.category) { setSubcategories([]); return; }
    const sel = categories.find((c: any) => c.name === formData.category);
    if (sel) setSubcategories(categories.filter((c: any) => c.parentId === String(sel._id)));
    else setSubcategories([]);
  }, [formData.category, categories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'category' ? { subcategory: '' } : {}) }));
    if (name === 'videoUrl') { setVideoUrlError(''); setEmbedUrl(null); }
  };

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const nf = [...imageFiles]; const np = [...imagePreviews];
      nf[index] = file; np[index] = URL.createObjectURL(file);
      setImageFiles(nf); setImagePreviews(np);
    }
  };

  const removeNewImage = (index: number) => {
    const nf = [...imageFiles]; const np = [...imagePreviews];
    nf[index] = null; np[index] = null;
    setImageFiles(nf); setImagePreviews(np);
    if (imageInputRefs[index].current) imageInputRefs[index].current!.value = '';
  };

  const removeExistingImage = (index: number) => {
    const updated = [...existingImageUrls]; updated.splice(index, 1);
    setExistingImageUrls(updated);
  };

  const handlePreviewVideo = () => {
    const url = formData.videoUrl.trim();
    if (!url) { setVideoUrlError('Please enter a video URL first.'); return; }
    const embed = getEmbedUrl(url);
    if (!embed) { setVideoUrlError('Could not embed this URL. Supported: YouTube, Facebook, Instagram, TikTok.'); return; }
    setEmbedUrl(embed);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const res = await fetch('/api/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
    const data = await res.json();
    if (!data.url) throw new Error('Upload failed');
    return data.url;
  };

  const handleSave = async () => {
    if (!formData.name || !formData.originalPrice || !formData.category) {
      alert('Please fill in Name, Category and Original Price.');
      return;
    }
    if (formData.videoUrl && !getEmbedUrl(formData.videoUrl)) {
      setVideoUrlError('Could not embed this URL.');
      return;
    }
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageFiles[i]) newUrls.push(await uploadImage(imageFiles[i]!));
      }
      const allImageUrls = [...existingImageUrls, ...newUrls];
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product._id,
          ...formData,
          imageUrl: allImageUrls[0] || '',
          imageUrls: allImageUrls,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated: Product = { ...product, ...formData, imageUrl: allImageUrls[0] || '', imageUrls: allImageUrls };
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); onSaved(updated); }, 1000);
    } catch {
      alert('Failed to update product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product._id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      onDeleted(product._id);
    } catch {
      alert('Failed to delete product.');
    }
  };

  const img = getImg(product);

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          {img && (
            <img src={img} alt={product.name} className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-[#FA5600]">Editing Product</p>
            <p className="text-sm font-black text-gray-900 truncate">{product.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleDelete} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400 hover:text-red-600 transition">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Product Name *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange}
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
          </div>

          {/* Category / Subcategory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Category *</label>
              <select name="category" value={formData.category} onChange={handleChange}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white">
                <option value="">Select</option>
                {parentCategories.map((cat: any) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Subcategory</label>
              <select name="subcategory" value={formData.subcategory} onChange={handleChange}
                disabled={subcategories.length === 0}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">{subcategories.length === 0 ? 'None' : 'Select'}</option>
                {subcategories.map((sub: any) => <option key={sub._id} value={sub.name}>{sub.name}</option>)}
              </select>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Original Price *</label>
              <input type="number" name="originalPrice" value={formData.originalPrice} onChange={handleChange}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Discounted Price</label>
              <input type="number" name="discountedPrice" value={formData.discountedPrice} onChange={handleChange}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition resize-none" />
          </div>

          {/* Existing Images */}
          {existingImageUrls.length > 0 && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Current Images</label>
              <div className="flex gap-2 flex-wrap">
                {existingImageUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden group/img">
                    <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => removeExistingImage(i)}
                      className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition flex items-center justify-center">
                      <X className="w-4 h-4 text-white opacity-0 group-hover/img:opacity-100 transition" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 bg-[#FA5600] text-white text-[8px] font-black text-center py-0.5 uppercase tracking-widest">Main</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Images */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
              Add New Images <span className="text-gray-400 normal-case font-bold tracking-normal">(up to 3)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <div key={index}>
                  <div onClick={() => imageInputRefs[index].current?.click()}
                    className="cursor-pointer border-2 border-dashed border-gray-200 rounded-xl text-center hover:border-[#FA5600] hover:bg-orange-50/50 transition aspect-square flex items-center justify-center relative overflow-hidden">
                    {imagePreviews[index] ? (
                      <>
                        <img src={imagePreviews[index]!} alt="" className="w-full h-full object-cover" />
                        <button onClick={(e) => { e.stopPropagation(); removeNewImage(index); }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow hover:bg-red-600">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="w-5 h-5 text-gray-300" />
                        <p className="text-[9px] text-gray-400 font-black uppercase">Add</p>
                      </div>
                    )}
                  </div>
                  <input ref={imageInputRefs[index]} type="file" accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleImageChange(index, e)} className="hidden" />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">⭐ First image is main display image</p>
          </div>

          {/* Video URL */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
              Product Video URL <span className="text-gray-400 normal-case font-bold tracking-normal">(Optional)</span>
            </label>
            <div className="flex gap-2">
              <input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange}
                placeholder="YouTube, Facebook, Instagram or TikTok..."
                className={`flex-1 border-2 rounded-xl p-3 text-sm font-bold outline-none transition ${videoUrlError ? 'border-red-400' : 'border-gray-200 focus:border-[#FA5600]'}`} />
              <button onClick={handlePreviewVideo}
                className="shrink-0 bg-gray-100 hover:bg-[#FA5600] hover:text-white text-gray-600 text-xs font-black px-3 rounded-xl transition uppercase tracking-widest">
                Preview
              </button>
            </div>
            {videoUrlError && <p className="text-red-500 text-xs mt-1 font-bold">{videoUrlError}</p>}
            {embedUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-black">
                <div className="bg-gray-800 text-white text-[10px] px-3 py-1.5 flex items-center justify-between font-black uppercase tracking-widest">
                  <span>📺 Preview</span>
                  <button onClick={() => { setEmbedUrl(null); setFormData(f => ({ ...f, videoUrl: '' })); }} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe src={embedUrl} className="absolute top-0 left-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen frameBorder="0" />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0 bg-white">
          <button onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 font-black py-3 rounded-xl hover:bg-gray-200 transition text-sm uppercase tracking-widest">
            Cancel
          </button>
          <button onClick={handleSave} disabled={uploading}
            className={`flex-1 font-black py-3 rounded-xl transition text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60
              ${saveSuccess ? 'bg-green-500 text-white' : 'bg-[#FA5600] hover:bg-[#E04A00] text-white shadow-lg shadow-orange-200'}`}>
            {uploading ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : saveSuccess ? (
              <><Check className="w-4 h-4" /> Saved!</>
            ) : (
              '💾 Save Changes'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProductManagerEmbed() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterImage, setFilterImage] = useState<'all' | 'has' | 'none'>('all');
  const [filterDiscount, setFilterDiscount] = useState<'all' | 'yes' | 'no'>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Edit modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // View: grid or list
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Add new product inline state
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(r => r.json()).catch(() => []),
      fetch('/api/categories').then(r => r.json()).catch(() => []),
    ]).then(([products, cats]) => {
      setAllProducts(Array.isArray(products) ? products : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setLoading(false);
    });
  }, []);

  const parentCategories = categories.filter((c: any) => !c.parentId);

  // ── Filter logic ─────────────────────────────────────────────────────────
  const filtered = allProducts.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.category?.toLowerCase().includes(q) && !p.subcategory?.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterImage === 'has' && !getImg(p)) return false;
    if (filterImage === 'none' && getImg(p)) return false;
    if (filterDiscount === 'yes' && !hasDiscount(p)) return false;
    if (filterDiscount === 'no' && hasDiscount(p)) return false;
    const price = getOrigPrice(p);
    if (priceMin && price < Number(priceMin)) return false;
    if (priceMax && price > Number(priceMax)) return false;
    return true;
  });

  // ── Group by category ─────────────────────────────────────────────────────
  const grouped: Record<string, Product[]> = {};
  filtered.forEach(p => {
    const cat = p.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });
  const groupKeys = Object.keys(grouped).sort();

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleSaved = useCallback((updated: Product) => {
    setAllProducts(prev => prev.map(p => p._id === updated._id ? updated : p));
    setEditingProduct(null);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setAllProducts(prev => prev.filter(p => p._id !== id));
    setEditingProduct(null);
  }, []);

  const handleProductAdded = useCallback((newProduct: Product) => {
    setAllProducts(prev => [newProduct, ...prev]);
    setShowAdd(false);
  }, []);

  const activeFiltersCount = [
    filterCategory !== '',
    filterImage !== 'all',
    filterDiscount !== 'all',
    priceMin !== '',
    priceMax !== '',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterCategory('');
    setFilterImage('all');
    setFilterDiscount('all');
    setPriceMin('');
    setPriceMax('');
    setSearch('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Top Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-[#FA5600] outline-none transition"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-black uppercase tracking-widest transition
              ${showFilters || activeFiltersCount > 0 ? 'border-[#FA5600] bg-orange-50 text-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-[#FA5600] hover:text-[#FA5600]'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="bg-[#FA5600] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Add Product */}
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FA5600] hover:bg-[#E04A00] text-white text-sm font-black uppercase tracking-widest transition shadow-sm shadow-orange-200">
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {/* Filter Row */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {/* Category pills */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                <FilterPill label="All" active={filterCategory === ''} onClick={() => setFilterCategory('')} />
                {parentCategories.map((cat: any) => (
                  <FilterPill key={cat._id} label={cat.name} active={filterCategory === cat.name} onClick={() => setFilterCategory(cat.name)} />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Image filter */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Image</p>
                <div className="flex gap-2">
                  <FilterPill label="All" active={filterImage === 'all'} onClick={() => setFilterImage('all')} />
                  <FilterPill label="Has Image" active={filterImage === 'has'} onClick={() => setFilterImage('has')} />
                  <FilterPill label="No Image" active={filterImage === 'none'} onClick={() => setFilterImage('none')} />
                </div>
              </div>

              {/* Discount filter */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Discount</p>
                <div className="flex gap-2">
                  <FilterPill label="All" active={filterDiscount === 'all'} onClick={() => setFilterDiscount('all')} />
                  <FilterPill label="On Sale" active={filterDiscount === 'yes'} onClick={() => setFilterDiscount('yes')} />
                  <FilterPill label="Full Price" active={filterDiscount === 'no'} onClick={() => setFilterDiscount('no')} />
                </div>
              </div>

              {/* Price range */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Price Range (₹)</p>
                <div className="flex items-center gap-2">
                  <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                    placeholder="Min" className="w-20 border-2 border-gray-200 rounded-xl px-2 py-1.5 text-xs font-bold focus:border-[#FA5600] outline-none" />
                  <span className="text-gray-400 text-xs font-bold">—</span>
                  <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                    placeholder="Max" className="w-20 border-2 border-gray-200 rounded-xl px-2 py-1.5 text-xs font-bold focus:border-[#FA5600] outline-none" />
                </div>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <button onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 font-black uppercase tracking-widest transition">
                <RotateCcw className="w-3 h-3" /> Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats Bar ── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400">
          {loading ? 'Loading...' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''} · ${groupKeys.length} categor${groupKeys.length !== 1 ? 'ies' : 'y'}`}
        </p>
        <div className="flex gap-1">
          {(['grid', 'list'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition
                ${viewMode === mode ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-400'}`}>
              {mode === 'grid' ? '⊞' : '≡'} {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ── Add Product Form (inline) ── */}
      {showAdd && (
        <AddProductInline
          categories={categories}
          onAdded={handleProductAdded}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                <div className="h-2 bg-gray-100 rounded-full w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-sm font-black uppercase tracking-widest text-gray-400">No products found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or search query</p>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="mt-4 text-xs text-[#FA5600] font-black uppercase tracking-widest hover:underline">
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* ── Product Groups ── */}
      {!loading && groupKeys.map(cat => (
        <div key={cat}>
          {/* Category header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4 text-[#FA5600]" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">{cat}</h3>
            <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">{grouped[cat].length}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
              {grouped[cat].map(p => (
                <ProductCard key={p._id} product={p} onEdit={() => setEditingProduct(p)} />
              ))}
            </div>
          ) : (
            <div className="space-y-1 mb-6">
              {grouped[cat].map(p => (
                <ListRow key={p._id} product={p} onEdit={() => setEditingProduct(p)} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* ── Edit Modal ── */}
      {editingProduct && (
        <EditModal
          product={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

// ─── List Row View ────────────────────────────────────────────────────────────

function ListRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const img = getImg(product);
  const disc = discountPct(product);
  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-orange-200 transition flex items-center gap-3 px-4 py-3 group">
      {img ? (
        <img src={img} alt={product.name} className="w-10 h-10 rounded-xl object-cover border border-gray-100 shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4 text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-900 truncate">{product.name}</p>
        <p className="text-[10px] text-gray-400 font-bold">{product.category}{product.subcategory ? ` › ${product.subcategory}` : ''}</p>
      </div>
      <div className="text-right shrink-0 mr-3">
        {hasDiscount(product) ? (
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-sm font-black text-[#FA5600]">₹{Number(product.discountedPrice).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-gray-400 line-through">₹{Number(product.originalPrice).toLocaleString('en-IN')}</span>
            <span className="text-[9px] bg-orange-100 text-[#FA5600] font-black px-1.5 py-0.5 rounded-full">-{disc}%</span>
          </div>
        ) : (
          <span className="text-sm font-black text-gray-900">₹{Number(product.originalPrice).toLocaleString('en-IN')}</span>
        )}
      </div>
      <button onClick={onEdit}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-[#FA5600] text-[#FA5600] hover:text-white rounded-xl transition text-xs font-black uppercase tracking-widest">
        <Pencil className="w-3 h-3" /> Edit
      </button>
    </div>
  );
}

// ─── Add Product Inline ───────────────────────────────────────────────────────

function AddProductInline({
  categories,
  onAdded,
  onClose,
}: {
  categories: any[];
  onAdded: (p: Product) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '', originalPrice: '', discountedPrice: '',
    category: '', subcategory: '', description: '', videoUrl: ''
  });
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const imageInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const parentCategories = categories.filter((c: any) => !c.parentId);

  useEffect(() => {
    if (!formData.category) { setSubcategories([]); return; }
    const sel = categories.find((c: any) => c.name === formData.category);
    if (sel) setSubcategories(categories.filter((c: any) => c.parentId === String(sel._id)));
    else setSubcategories([]);
  }, [formData.category, categories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'category' ? { subcategory: '' } : {}) }));
  };

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const nf = [...imageFiles]; const np = [...imagePreviews];
      nf[index] = file; np[index] = URL.createObjectURL(file);
      setImageFiles(nf); setImagePreviews(np);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const res = await fetch('/api/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
    const data = await res.json();
    if (!data.url) throw new Error('Upload failed');
    return data.url;
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.originalPrice || !formData.category) {
      alert('Please fill in Name, Category and Original Price.'); return;
    }
    setUploading(true);
    try {
      const imageUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageFiles[i]) imageUrls.push(await uploadImage(imageFiles[i]!));
      }
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, imageUrl: imageUrls[0] || '', image: imageUrls[0] || '', imageUrls }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setSuccess(true);
      setTimeout(() => {
        onAdded({ _id: data._id || data.id, ...formData, imageUrl: imageUrls[0] || '', imageUrls } as Product);
      }, 800);
    } catch {
      alert('Failed to add product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#FA5600] shadow-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#FA5600] rounded-lg flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-black uppercase tracking-widest text-gray-900">Add New Product</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Product Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Category *</label>
          <select name="category" value={formData.category} onChange={handleChange}
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white">
            <option value="">Select Category</option>
            {parentCategories.map((cat: any) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Subcategory</label>
          <select name="subcategory" value={formData.subcategory} onChange={handleChange}
            disabled={subcategories.length === 0}
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">{subcategories.length === 0 ? 'No subcategories' : 'Select Subcategory'}</option>
            {subcategories.map((sub: any) => <option key={sub._id} value={sub.name}>{sub.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Original Price *</label>
          <input type="number" name="originalPrice" value={formData.originalPrice} onChange={handleChange}
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Discounted Price</label>
          <input type="number" name="discountedPrice" value={formData.discountedPrice} onChange={handleChange}
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows={2}
            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-[#FA5600] outline-none transition resize-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Product Images (up to 3)</label>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <div onClick={() => imageInputRefs[index].current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-200 rounded-xl hover:border-[#FA5600] hover:bg-orange-50/50 transition aspect-square flex items-center justify-center relative overflow-hidden">
                  {imagePreviews[index] ? (
                    <>
                      <img src={imagePreviews[index]!} alt="" className="w-full h-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); const nf = [...imageFiles]; const np = [...imagePreviews]; nf[index] = null; np[index] = null; setImageFiles(nf); setImagePreviews(np); }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <p className="text-[9px] text-gray-400 font-black uppercase">Image {index + 1}</p>
                      {index === 0 && <p className="text-[8px] text-[#FA5600] font-black">Main</p>}
                    </div>
                  )}
                </div>
                <input ref={imageInputRefs[index]} type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleImageChange(index, e)} className="hidden" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={uploading}
        className={`w-full font-black py-3.5 rounded-xl transition text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60
          ${success ? 'bg-green-500 text-white' : 'bg-[#FA5600] hover:bg-[#E04A00] text-white shadow-lg shadow-orange-200'}`}>
        {uploading ? (
          <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Uploading...</>
        ) : success ? (
          <><Check className="w-4 h-4" /> Product Added!</>
        ) : (
          <><Plus className="w-4 h-4" /> Add Product to Database</>
        )}
      </button>
    </div>
  );
}

export default ProductManagerEmbed;
