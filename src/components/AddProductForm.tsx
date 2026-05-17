import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';
const SESSION_KEY = 'adminAuth';

// ─────────────────────────────────────────────
// IMAGE COMPRESSION UTILITY
// Compresses to WebP, max 800×800px, 72% quality
// Reduces a 3MB phone photo to ~150–250KB
// ─────────────────────────────────────────────
async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; format?: 'webp' | 'jpeg' } = {}
): Promise<{ blob: Blob; dataUrl: string; originalKB: number; compressedKB: number; savedPct: number }> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.72, format = 'webp' } = options;
  const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        // Scale down keeping aspect ratio
        if (w > maxWidth || h > maxHeight) {
          const scale = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;

        // White background for jpeg
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            const fr = new FileReader();
            fr.onload = (ev) => {
              const originalKB    = Math.round(file.size / 1024);
              const compressedKB  = Math.round(blob.size / 1024);
              const savedPct      = Math.round((1 - blob.size / file.size) * 100);
              resolve({ blob, dataUrl: ev.target!.result as string, originalKB, compressedKB, savedPct });
            };
            fr.readAsDataURL(blob);
          },
          mimeType,
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: convert Blob to File so we can POST it
function blobToFile(blob: Blob, originalName: string, format: 'webp' | 'jpeg'): File {
  const ext  = format === 'webp' ? 'webp' : 'jpg';
  const name = originalName.replace(/\.[^.]+$/, '') + '.' + ext;
  return new File([blob], name, { type: blob.type });
}

// ─────────────────────────────────────────────
// COMPRESSION INFO BADGE (shown under each slot)
// ─────────────────────────────────────────────
interface CompressionInfo { originalKB: number; compressedKB: number; savedPct: number }

function CompressionBadge({ info }: { info: CompressionInfo | null }) {
  if (!info) return null;
  const good = info.savedPct > 0;
  return (
    <div className={`mt-1 text-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      good ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
    }`}>
      {info.originalKB}KB → {info.compressedKB}KB
      {good ? ` (−${info.savedPct}%)` : ''}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
const AddProductForm = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated]   = useState(false);
  const [passwordInput, setPasswordInput]       = useState('');
  const [passwordError, setPasswordError]       = useState('');
  const [newProductId, setNewProductId]         = useState<string | null>(null);

  const [allProducts, setAllProducts]   = useState<any[]>([]);
  const [searchQuery, setSearchQuery]   = useState('');

  const [formData, setFormData] = useState({
    name: '', originalPrice: '', discountedPrice: '',
    category: '', subcategory: '', description: '', videoUrl: ''
  });

  const [categories, setCategories]       = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);

  // imageFiles now stores the COMPRESSED blobs ready to upload
  const [imageFiles, setImageFiles]           = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews]     = useState<(string | null)[]>([null, null, null]);
  const [compressionInfo, setCompressionInfo] = useState<(CompressionInfo | null)[]>([null, null, null]);
  const [compressing, setCompressing]         = useState<boolean[]>([false, false, false]);

  const [uploading, setUploading]       = useState(false);
  const [videoUrlError, setVideoUrlError] = useState('');
  const [embedUrl, setEmbedUrl]         = useState<string | null>(null);

  const imageInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!formData.category) { setSubcategories([]); return; }
    const sel = categories.find(c => c.name === formData.category);
    if (sel) setSubcategories(categories.filter(c => c.parentId === String(sel._id)));
  }, [formData.category, categories]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/products').then(r => r.json()).then(d => setAllProducts(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isAuthenticated]);

  const parentCategories   = categories.filter(c => !c.parentId);
  const filteredProducts   = allProducts.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPasswordInput('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'category' ? { subcategory: '' } : {}) }));
    if (name === 'videoUrl') { setVideoUrlError(''); setEmbedUrl(null); }
  };

  // ── IMAGE CHANGE: compress immediately on pick ──
  const handleImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show spinner for this slot
    setCompressing(prev => { const n = [...prev]; n[index] = true; return n; });

    try {
      const result = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.72, format: 'webp' });

      const compressedFile = blobToFile(result.blob, file.name, 'webp');

      setImageFiles(prev   => { const n = [...prev];   n[index] = compressedFile; return n; });
      setImagePreviews(prev => { const n = [...prev];  n[index] = result.dataUrl;  return n; });
      setCompressionInfo(prev => {
        const n = [...prev];
        n[index] = { originalKB: result.originalKB, compressedKB: result.compressedKB, savedPct: result.savedPct };
        return n;
      });
    } catch {
      // fallback: use original if compression fails
      const newFiles    = [...imageFiles];
      const newPreviews = [...imagePreviews];
      newFiles[index]    = file;
      newPreviews[index] = URL.createObjectURL(file);
      setImageFiles(newFiles);
      setImagePreviews(newPreviews);
    } finally {
      setCompressing(prev => { const n = [...prev]; n[index] = false; return n; });
    }
  };

  const handleRemoveImage = (index: number) => {
    const nf = [...imageFiles];    nf[index]    = null;
    const np = [...imagePreviews]; np[index]    = null;
    const nc = [...compressionInfo]; nc[index]  = null;
    setImageFiles(nf);
    setImagePreviews(np);
    setCompressionInfo(nc);
    if (imageInputRefs[index].current) imageInputRefs[index].current!.value = '';
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

  const detectPlatform = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return { label: 'YouTube', icon: '▶️' };
    if (url.includes('facebook.com') || url.includes('fb.watch')) return { label: 'Facebook', icon: '📘' };
    if (url.includes('instagram.com')) return { label: 'Instagram', icon: '📸' };
    if (url.includes('tiktok.com'))    return { label: 'TikTok',    icon: '🎵' };
    return null;
  };

  const handlePreviewVideo = () => {
    const url = formData.videoUrl.trim();
    if (!url) { setVideoUrlError('Please enter a video URL first.'); return; }
    const embed = getEmbedUrl(url);
    if (!embed) { setVideoUrlError('Could not embed this URL. Supported: YouTube, Facebook, Instagram, TikTok.'); return; }
    setEmbedUrl(embed);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const res  = await fetch('/api/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
    const data = await res.json();
    if (!data.url) throw new Error('Upload failed');
    return data.url;
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.originalPrice || !formData.category) {
      alert('Please fill in Name, Category and Original Price.');
      return;
    }
    if (formData.videoUrl && !getEmbedUrl(formData.videoUrl)) {
      setVideoUrlError('Could not embed this URL. Supported: YouTube, Facebook, Instagram, TikTok.');
      return;
    }
    setUploading(true);
    try {
      const imageUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageFiles[i]) {
          const url = await uploadImage(imageFiles[i]!);
          imageUrls.push(url);
        }
      }
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, imageUrl: imageUrls[0] || '', imageUrls }),
      });
      if (!res.ok) throw new Error('Failed to save product');
      const data = await res.json();
      setNewProductId(data._id || data.id);
    } catch {
      alert('Failed to save product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddAnother = () => {
    setNewProductId(null);
    setFormData({ name: '', originalPrice: '', discountedPrice: '', category: '', subcategory: '', description: '', videoUrl: '' });
    setImageFiles([null, null, null]);
    setImagePreviews([null, null, null]);
    setCompressionInfo([null, null, null]);
    setEmbedUrl(null);
    setSearchQuery('');
    imageInputRefs.forEach(ref => { if (ref.current) ref.current.value = ''; });
  };

  const detectedPlatform = detectPlatform(formData.videoUrl);

  // ── PASSWORD SCREEN ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your password to continue</p>
          </div>
          <input type="password" value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded-lg p-3 text-center text-lg focus:ring-2 focus:ring-green-500 outline-none mb-3" />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button onClick={handlePasswordSubmit}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition">Enter</button>
        </div>
      </div>
    );
  }

  // ── SUCCESS SCREEN ──
  if (newProductId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Added!</h2>
          <p className="text-sm text-gray-500 mb-8">What would you like to do next?</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => navigate(`/products/${newProductId}/edit`)}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">✏️ Edit this Product</button>
            <button onClick={() => navigate(`/products/${newProductId}`)}
              className="w-full bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-900 transition">👁️ View Product Page</button>
            <button onClick={handleAddAnother}
              className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition">➕ Add Another Product</button>
            <button onClick={() => navigate('/admin')}
              className="w-full bg-[#FA5600] text-white font-bold py-3 rounded-lg hover:bg-[#E04A00] transition">← Back to Admin Panel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN FORM ──
  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-xl rounded-xl mt-10 mb-10 border border-gray-100">
      <div className="flex justify-between items-center border-b pb-4 mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Add & Edit Products</h2>
        <div className="flex gap-3">
          <button onClick={() => navigate('/admin')} className="text-sm text-[#FA5600] hover:text-[#E04A00] font-bold transition">← Admin Panel</button>
          <button onClick={() => { sessionStorage.removeItem(SESSION_KEY); setIsAuthenticated(false); }}
            className="text-sm text-gray-400 hover:text-red-500 transition">🔓 Lock</button>
        </div>
      </div>

      {/* EDIT EXISTING */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-gray-800 mb-1">Edit an Existing Product</h3>
        <p className="text-sm text-gray-400 mb-3">Search by name or category and click to edit.</p>
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search products..."
          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none mb-3" />
        {searchQuery.trim() !== '' && (
          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No products found.</p>
            ) : filteredProducts.map(p => {
              const pid = p._id?.toString() || p.id;
              const img = p.imageUrls?.[0] || p.imageUrl || null;
              return (
                <button key={pid} onClick={() => navigate(`/products/${pid}/edit`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left">
                  {img
                    ? <img src={img} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                    : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg shrink-0">📦</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}</p>
                  </div>
                  <span className="text-xs text-blue-500 font-bold shrink-0">✏️ Edit</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* DIVIDER */}
      <div className="relative mb-10">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm font-bold text-gray-400 uppercase tracking-widest">Or Add a New Product</span>
        </div>
      </div>

      {/* FORM FIELDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Product Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Category *</label>
          <select name="category" value={formData.category} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Select Category</option>
            {parentCategories.map(cat => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Subcategory <span className="text-gray-400 font-normal">(Optional)</span></label>
          <select name="subcategory" value={formData.subcategory} onChange={handleChange}
            disabled={subcategories.length === 0}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400">
            <option value="">{subcategories.length === 0 ? 'No subcategories' : 'Select Subcategory'}</option>
            {subcategories.map(sub => <option key={sub._id} value={sub.name}>{sub.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Original Price *</label>
          <input type="number" name="originalPrice" value={formData.originalPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Discounted Price <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input type="number" name="discountedPrice" value={formData.discountedPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows={4}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        {/* ── IMAGE UPLOAD WITH COMPRESSION ── */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Images <span className="text-gray-400 font-normal">(Optional — up to 3, PNG/JPG/WEBP)</span>
          </label>
          {/* Compression info banner */}
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
            <span className="text-green-600 text-sm">⚡</span>
            <span className="text-xs text-green-700 font-medium">
              Images are automatically compressed to WebP (max 800px, 72% quality) before upload — saving up to 90% storage space.
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <div onClick={() => !compressing[index] && imageInputRefs[index].current?.click()}
                  className={`cursor-pointer border-2 border-dashed rounded-lg p-3 text-center transition aspect-square flex items-center justify-center relative overflow-hidden
                    ${compressing[index] ? 'border-orange-300 bg-orange-50 cursor-wait' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                  {compressing[index] ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-orange-500 font-medium">Compressing...</p>
                    </div>
                  ) : imagePreviews[index] ? (
                    <>
                      <img src={imagePreviews[index]!} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                      <button onClick={e => { e.stopPropagation(); handleRemoveImage(index); }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600">✕</button>
                    </>
                  ) : (
                    <div>
                      <div className="text-3xl text-gray-300 mb-1">🖼️</div>
                      <p className="text-xs text-gray-400">Image {index + 1}</p>
                      {index === 0 && <p className="text-[10px] text-blue-400 mt-1">Main</p>}
                    </div>
                  )}
                </div>
                {/* Compression badge */}
                <CompressionBadge info={compressionInfo[index]} />
                <input ref={imageInputRefs[index]} type="file" accept="image/png, image/jpeg, image/webp"
                  onChange={e => handleImageChange(index, e)} className="hidden" />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">⭐ Image 1 is the main display image</p>
        </div>

        {/* VIDEO URL */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Video URL <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange}
                placeholder="Paste a YouTube, Facebook, Instagram or TikTok link..."
                className={`block w-full border rounded-lg p-3 pr-32 focus:ring-2 focus:ring-blue-500 outline-none ${videoUrlError ? 'border-red-400' : 'border-gray-300'}`} />
              {detectedPlatform && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full pointer-events-none">
                  {detectedPlatform.icon} {detectedPlatform.label}
                </span>
              )}
            </div>
            <button onClick={handlePreviewVideo}
              className="bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg hover:bg-blue-700 transition whitespace-nowrap">Preview</button>
          </div>
          {videoUrlError && <p className="text-red-500 text-xs mt-1">{videoUrlError}</p>}
          <div className="flex gap-3 mt-2">
            {['▶️ YouTube', '📘 Facebook', '📸 Instagram', '🎵 TikTok'].map(p => (
              <span key={p} className="text-xs text-gray-400">{p}</span>
            ))}
          </div>
          {embedUrl && (
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-md bg-black">
              <div className="bg-gray-800 text-white text-xs px-3 py-2 flex items-center justify-between">
                <span>📺 Video Preview</span>
                <button onClick={() => { setEmbedUrl(null); setFormData(f => ({ ...f, videoUrl: '' })); }}
                  className="text-gray-400 hover:text-white ml-4">✕ Remove</button>
              </div>
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <iframe src={embedUrl} className="absolute top-0 left-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen frameBorder="0" />
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <button onClick={handleSubmit} disabled={uploading || compressing.some(Boolean)}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 transition duration-300 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {uploading ? '⏳ Uploading & saving...' : compressing.some(Boolean) ? '⚡ Compressing images...' : 'Add Product to Database'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductForm;
