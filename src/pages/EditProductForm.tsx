import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

export function EditProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    originalPrice: '',
    discountedPrice: '',
    category: '',
    subcategory: '',
    description: '',
    videoUrl: ''
  });

  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoUrlError, setVideoUrlError] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);

  const imageInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Fetch product data
  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        const product = data.find((p: any) => p._id === id);
        if (product) {
          setFormData({
            name: product.name || '',
            originalPrice: product.originalPrice || '',
            discountedPrice: product.discountedPrice || '',
            category: product.category || '',
            subcategory: product.subcategory || '',
            description: product.description || '',
            videoUrl: product.videoUrl || ''
          });
          const imgs = product.imageUrls?.length > 0
            ? product.imageUrls
            : product.imageUrl ? [product.imageUrl] : [];
          setExistingImageUrls(imgs);
          if (product.videoUrl) {
            const embed = getEmbedUrl(product.videoUrl);
            if (embed) setEmbedUrl(embed);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Fetch categories
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(() => {});
  }, []);

  // Update subcategories when category changes
  useEffect(() => {
    if (!formData.category) { setSubcategories([]); return; }
    const selectedCat = categories.find(c => c.name === formData.category);
    if (selectedCat) {
      const subs = categories.filter(c => c.parentId === String(selectedCat._id));
      setSubcategories(subs);
    }
  }, [formData.category, categories]);

  const parentCategories = categories.filter(c => !c.parentId);

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password.');
      setPasswordInput('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'category' ? { subcategory: '' } : {})
    }));
    if (name === 'videoUrl') { setVideoUrlError(''); setEmbedUrl(null); }
  };

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFiles = [...imageFiles];
      const newPreviews = [...imagePreviews];
      newFiles[index] = file;
      newPreviews[index] = URL.createObjectURL(file);
      setImageFiles(newFiles);
      setImagePreviews(newPreviews);
    }
  };

  const handleRemoveNewImage = (index: number) => {
    const newFiles = [...imageFiles];
    const newPreviews = [...imagePreviews];
    newFiles[index] = null;
    newPreviews[index] = null;
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    if (imageInputRefs[index].current) imageInputRefs[index].current!.value = '';
  };

  const handleRemoveExistingImage = (index: number) => {
    const updated = [...existingImageUrls];
    updated.splice(index, 1);
    setExistingImageUrls(updated);
  };

  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const ytMatch =
      url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
      url.match(/youtu\.be\/([\w-]+)/) ||
      url.match(/youtube\.com\/shorts\/([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    if (url.includes('facebook.com') || url.includes('fb.watch'))
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`;
    const igMatch = url.match(/instagram\.com\/(reel|p)\/([\w-]+)/);
    if (igMatch) return `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed`;
    const ttMatch = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
    if (ttMatch) return `https://www.tiktok.com/embed/${ttMatch[1]}`;
    return null;
  };

  const detectPlatform = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return { label: 'YouTube', icon: '▶️' };
    if (url.includes('facebook.com') || url.includes('fb.watch')) return { label: 'Facebook', icon: '📘' };
    if (url.includes('instagram.com')) return { label: 'Instagram', icon: '📸' };
    if (url.includes('tiktok.com')) return { label: 'TikTok', icon: '🎵' };
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
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': file.type },
    });
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
      setVideoUrlError('Could not embed this URL.');
      return;
    }

    setUploading(true);
    try {
      // Upload any new images
      const newUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageFiles[i]) {
          const url = await uploadImage(imageFiles[i]!);
          newUrls.push(url);
        }
      }

      // Combine existing + new images
      const allImageUrls = [...existingImageUrls, ...newUrls];

      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...formData,
          imageUrl: allImageUrls[0] || '',
          imageUrls: allImageUrls,
        }),
      });

      if (!res.ok) throw new Error('Failed to update product');
      alert('Product updated successfully!');
      navigate(`/products/${id}`);

    } catch (err) {
      alert('Failed to update product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      alert('Product deleted!');
      navigate('/products');
    } catch {
      alert('Failed to delete product.');
    }
  };

  const detectedPlatform = detectPlatform(formData.videoUrl);

  // PASSWORD SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your password to edit this product</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded-lg p-3 text-center text-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3"
          />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button onClick={handlePasswordSubmit}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">
            Enter
          </button>
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

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100 p-4 overflow-hidden">
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-xl border border-gray-100 flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Sticky Header */}
        <div className="flex justify-between items-center border-b px-8 py-4 shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">Edit Product</h2>
          <div className="flex gap-3">
            <button onClick={handleDelete}
              className="text-sm text-red-400 hover:text-red-600 font-bold transition">
              🗑️ Delete Product
            </button>
            <button onClick={() => setIsAuthenticated(false)}
              className="text-sm text-gray-400 hover:text-red-500 transition">
              🔓 Lock
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-8 py-6 flex-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Product Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Category *</label>
          <select name="category" value={formData.category} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Select Category</option>
            {parentCategories.map(cat => (
              <option key={cat._id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Subcategory */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">
            Subcategory <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <select name="subcategory" value={formData.subcategory} onChange={handleChange}
            disabled={subcategories.length === 0}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400">
            <option value="">{subcategories.length === 0 ? 'No subcategories' : 'Select Subcategory'}</option>
            {subcategories.map(sub => (
              <option key={sub._id} value={sub.name}>{sub.name}</option>
            ))}
          </select>
        </div>

        {/* Original Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Original Price *</label>
          <input type="number" name="originalPrice" value={formData.originalPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        {/* Discounted Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">
            Discounted Price <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <input type="number" name="discountedPrice" value={formData.discountedPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">
            Description <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
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
                  <button
                    onClick={() => handleRemoveExistingImage(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600">
                    ✕
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">Main</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Images */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Add New Images <span className="text-gray-400 font-normal">(Optional — up to 3)</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <div
                  onClick={() => imageInputRefs[index].current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 hover:bg-blue-50 transition aspect-square flex items-center justify-center relative overflow-hidden">
                  {imagePreviews[index] ? (
                    <>
                      <img src={imagePreviews[index]!} alt={`New ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveNewImage(index); }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600">
                        ✕
                      </button>
                    </>
                  ) : (
                    <div>
                      <div className="text-3xl text-gray-300 mb-1">➕</div>
                      <p className="text-xs text-gray-400">Add Image</p>
                    </div>
                  )}
                </div>
                <input
                  ref={imageInputRefs[index]}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => handleImageChange(index, e)}
                  className="hidden"
                />
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
              <input
                type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange}
                placeholder="Paste a YouTube, Facebook, Instagram or TikTok link..."
                className={`block w-full border rounded-lg p-3 pr-32 focus:ring-2 focus:ring-blue-500 outline-none ${videoUrlError ? 'border-red-400' : 'border-gray-300'}`}
              />
              {detectedPlatform && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full pointer-events-none">
                  {detectedPlatform.icon} {detectedPlatform.label}
                </span>
              )}
            </div>
            <button onClick={handlePreviewVideo}
              className="bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg hover:bg-blue-700 transition whitespace-nowrap">
              Preview
            </button>
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
        </div>{/* end scrollable body */}

        {/* Sticky Footer */}
        <div className="border-t px-8 py-4 shrink-0 bg-white flex gap-3 rounded-b-xl">
          <button onClick={() => navigate(`/products/${id}`)}
            className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={uploading}
            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {uploading ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
        </div>

      </div>{/* end modal card */}
    </div>
  );
}

export default EditProductForm;
