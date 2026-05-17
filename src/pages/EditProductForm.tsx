import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

// ─────────────────────────────────────────────
// IMAGE COMPRESSION UTILITY
// Compresses to WebP, max 800×800px, 72% quality
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
        if (w > maxWidth || h > maxHeight) {
          const scale = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        if (format === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          const fr = new FileReader();
          fr.onload = (ev) => {
            resolve({
              blob,
              dataUrl: ev.target!.result as string,
              originalKB:   Math.round(file.size / 1024),
              compressedKB: Math.round(blob.size / 1024),
              savedPct:     Math.round((1 - blob.size / file.size) * 100),
            });
          };
          fr.readAsDataURL(blob);
        }, mimeType, quality);
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToFile(blob: Blob, originalName: string, format: 'webp' | 'jpeg'): File {
  const ext  = format === 'webp' ? 'webp' : 'jpg';
  const name = originalName.replace(/\.[^.]+$/, '') + '.' + ext;
  return new File([blob], name, { type: blob.type });
}

interface CompressionInfo { originalKB: number; compressedKB: number; savedPct: number }

function CompressionBadge({ info }: { info: CompressionInfo | null }) {
  if (!info) return null;
  const good = info.savedPct > 0;
  return (
    <div className={`mt-1 text-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      good ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
    }`}>
      {info.originalKB}KB → {info.compressedKB}KB{good ? ` (−${info.savedPct}%)` : ''}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export function EditProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput]     = useState('');
  const [passwordError, setPasswordError]     = useState('');

  const [formData, setFormData] = useState({
    name: '', originalPrice: '', discountedPrice: '',
    category: '', subcategory: '', description: '', videoUrl: ''
  });

  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imageFiles, setImageFiles]               = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews]         = useState<(string | null)[]>([null, null, null]);
  const [compressionInfo, setCompressionInfo]     = useState<(CompressionInfo | null)[]>([null, null, null]);
  const [compressing, setCompressing]             = useState<boolean[]>([false, false, false]);

  const [uploading, setUploading]       = useState(false);
  const [loading, setLoading]           = useState(true);
  const [videoUrlError, setVideoUrlError] = useState('');
  const [embedUrl, setEmbedUrl]         = useState<string | null>(null);
  const [categories, setCategories]     = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);

  const imageInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        const product = data.find((p: any) => p._id === id);
        if (product) {
          setFormData({
            name: product.name || '', originalPrice: product.originalPrice || '',
            discountedPrice: product.discountedPrice || '', category: product.category || '',
            subcategory: product.subcategory || '', description: product.description || '',
            videoUrl: product.videoUrl || ''
          });
          const imgs = product.imageUrls?.length > 0 ? product.imageUrls
            : product.imageUrl ? [product.imageUrl] : [];
          setExistingImageUrls(imgs);
          if (product.videoUrl) { const e = getEmbedUrl(product.videoUrl); if (e) setEmbedUrl(e); }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!formData.category) { setSubcategories([]); return; }
    const sel = categories.find(c => c.name === formData.category);
    if (sel) setSubcategories(categories.filter(c => c.parentId === String(sel._id)));
  }, [formData.category, categories]);

  const parentCategories = categories.filter(c => !c.parentId);

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) { setIsAuthenticated(true); setPasswordError(''); }
    else { setPasswordError('Incorrect password.'); setPasswordInput(''); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'category' ? { subcategory: '' } : {}) }));
    if (name === 'videoUrl') { setVideoUrlError(''); setEmbedUrl(null); }
  };

  // ── COMPRESS ON PICK ──
  const handleImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(prev => { const n = [...prev]; n[index] = true; return n; });
    try {
      const result       = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.72, format: 'webp' });
      const compressedFile = blobToFile(result.blob, file.name, 'webp');

      setImageFiles(prev     => { const n = [...prev]; n[index] = compressedFile; return n; });
      setImagePreviews(prev  => { const n = [...prev]; n[index] = result.dataUrl;  return n; });
      setCompressionInfo(prev => {
        const n = [...prev];
        n[index] = { originalKB: result.originalKB, compressedKB: result.compressedKB, savedPct: result.savedPct };
        return n;
      });
    } catch {
      // fallback to original
      const nf = [...imageFiles]; nf[index] = file;
      const np = [...imagePreviews]; np[index] = URL.createObjectURL(file);
      setImageFiles(nf); setImagePreviews(np);
    } finally {
      setCompressing(prev => { const n = [...prev]; n[index] = false; return n; });
    }
  };

  const handleRemoveNewImage = (index: number) => {
    const nf = [...imageFiles];    nf[index]    = null;
    const np = [...imagePreviews]; np[index]    = null;
    const nc = [...compressionInfo]; nc[index]  = null;
    setImageFiles(nf); setImagePreviews(np); setCompressionInfo(nc);
    if (imageInputRefs[index].current) imageInputRefs[index].current!.value = '';
  };

  const handleRemoveExistingImage = (index: number) => {
    const updated = [...existingImageUrls];
    updated.splice(index, 1);
    setExistingImageUrls(updated);
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
    if (!embed) { setVideoUrlError('Could not embed this URL.'); return; }
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
      alert('Please fill in Name, Category and Original Price.'); return;
    }
    if (formData.videoUrl && !getEmbedUrl(formData.videoUrl)) {
      setVideoUrlError('Could not embed this URL.'); return;
    }
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageFiles[i]) { newUrls.push(await uploadImage(imageFiles[i]!)); }
      }
      const allImageUrls = [...existingImageUrls, ...newUrls];
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...formData, imageUrl: allImageUrls[0] || '', imageUrls: allImageUrls }),
      });
      if (!res.ok) throw new Error('Failed to update product');
      alert('Product updated successfully!');
      navigate(`/products/${id}`);
    } catch {
      alert('Failed to update product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/products', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      alert('Product deleted!');
      navigate('/products');
    } catch { alert('Failed to delete product.'); }
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
            <p className="text-sm text-gray-500 mt-1">Enter your password to edit this product</p>
          </div>
          <input type="password" value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded-lg p-3 text-center text-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3" />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button onClick={handlePasswordSubmit}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">Enter</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="font-black uppercase tracking-widest">Loading product...</p>
      </div>
    );
  }

  // ── MAIN FORM ──
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100 p-4 overflow-hidden">
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-xl border border-gray-100 flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Sticky Header */}
        <div className="flex justify-between items-center border-b px-8 py-4 shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">Edit Product</h2>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-600 font-bold transition">🗑️ Delete Product</button>
            <button onClick={() => setIsAuthenticated(false)} className="text-sm text-gray-400 hover:text-red-500 transition">🔓 Lock</button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-8 py-6 flex-1">
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
              <label className="block text-sm font-semibold text-gray-700">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            {/* Existing Images */}
            {existingImageUrls.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Images</label>
                <div className="flex gap-3 flex-wrap">
                  {existingImageUrls.map((url, i) => (
                    <div key={i} className="relative w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => handleRemoveExistingImage(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600">✕</button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">Main</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── NEW IMAGES WITH COMPRESSION ── */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Add New Images <span className="text-gray-400 font-normal">(Optional — up to 3)</span>
              </label>
              {/* Compression banner */}
              <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
                <span className="text-green-600 text-sm">⚡</span>
                <span className="text-xs text-green-700 font-medium">
                  Images are automatically compressed to WebP before upload — saves up to 90% storage space.
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
                          <img src={imagePreviews[index]!} alt={`New ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                          <button onClick={e => { e.stopPropagation(); handleRemoveNewImage(index); }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600">✕</button>
                        </>
                      ) : (
                        <div>
                          <div className="text-3xl text-gray-300 mb-1">➕</div>
                          <p className="text-xs text-gray-400">Add Image</p>
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
            </div>

            {/* Video URL */}
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

          </div>
        </div>

        {/* Sticky Footer */}
        <div className="border-t px-8 py-4 shrink-0 bg-white flex gap-3 rounded-b-xl">
          <button onClick={() => navigate(`/products/${id}`)}
            className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={uploading || compressing.some(Boolean)}
            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {uploading ? '⏳ Saving...' : compressing.some(Boolean) ? '⚡ Compressing...' : '💾 Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default EditProductForm;
