import React, { useState, useRef, useEffect } from 'react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'playgear2024';

interface Category {
  _id: string;
  name: string;
  parentId: string | null;
}

const AddProductForm = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    originalPrice: '',
    discountedPrice: '',
    category: '',
    subCategory: '',
    description: '',
    videoUrl: ''
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrlError, setVideoUrlError] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      setPasswordError('Incorrect password.');
      setPasswordInput('');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/categories')
        .then(res => res.json())
        .then(data => setCategories(Array.isArray(data) ? data : []));
    }
  }, [isAuthenticated]);

  const mainCategories = categories.filter(c => !c.parentId);
  const subCategories = categories.filter(c => c.parentId === formData.category);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'category' ? { subCategory: '' } : {})
    }));
    if (name === 'videoUrl') { setVideoUrlError(''); setEmbedUrl(null); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const ytMatch = url.match(/youtube\.com\/watch\?v=([\w-]+)/) || url.match(/youtu\.be\/([\w-]+)/) || url.match(/youtube\.com\/shorts\/([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    if (url.includes('facebook.com') || url.includes('fb.watch'))
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
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

  const handleSubmit = async () => {
    if (!formData.name || !formData.originalPrice || !formData.category) {
      setSubmitError('Please fill in Product Name, Category and Original Price.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');

    try {
      let imageUrl = '';
      if (imagePreview && imageFile) {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imagePreview }),
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error('Image upload failed');
        imageUrl = uploadData.url;
      }

      const mainCat = categories.find(c => c._id === formData.category);
      const subCat = categories.find(c => c._id === formData.subCategory);

      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.discountedPrice) || parseFloat(formData.originalPrice),
        originalPrice: parseFloat(formData.originalPrice),
        discountedPrice: parseFloat(formData.discountedPrice) || null,
        category: mainCat?.name || formData.category,
        subCategory: subCat?.name || null,
        image: imageUrl,
        videoUrl: formData.videoUrl || null,
      };

      const saveRes = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error('Failed to save product');

      setSubmitSuccess(true);
      setFormData({ name: '', originalPrice: '', discountedPrice: '', category: '', subCategory: '', description: '', videoUrl: '' });
      setImageFile(null);
      setImagePreview(null);
      setEmbedUrl(null);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (error: any) {
      setSubmitError(error.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const detectedPlatform = detectPlatform(formData.videoUrl);

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
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded-lg p-3 text-center text-lg focus:ring-2 focus:ring-orange-400 outline-none mb-3" />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button onClick={handlePasswordSubmit}
            className="w-full bg-[#FA5600] text-white font-bold py-3 rounded-lg hover:bg-[#E04A00] transition">
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-xl rounded-xl mt-10 border border-gray-100 mb-10">
      <div className="flex justify-between items-center border-b pb-4 mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Add New Product</h2>
        <div className="flex items-center gap-4">
          <a href="/manage-categories" className="text-sm text-[#FA5600] font-bold hover:underline">⚙️ Manage Categories</a>
          <button onClick={() => setIsAuthenticated(false)} className="text-sm text-gray-400 hover:text-red-500 transition">🔓 Lock</button>
        </div>
      </div>

      {submitSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 font-semibold text-center">
          ✅ Product added successfully!
        </div>
      )}
      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          ❌ {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Product Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none" required />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Category *</label>
          <select name="category" value={formData.category} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none">
            <option value="">Select Category</option>
            {mainCategories.map(cat => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">
            Subcategory <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <select name="subCategory" value={formData.subCategory} onChange={handleChange}
            disabled={!formData.category || subCategories.length === 0}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none disabled:bg-gray-100 disabled:text-gray-400">
            <option value="">
              {!formData.category ? 'Select category first' : subCategories.length === 0 ? 'No subcategories yet' : 'Select Subcategory'}
            </option>
            {subCategories.map(sub => (
              <option key={sub._id} value={sub._id}>{sub.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Original Price *</label>
          <input type="number" name="originalPrice" value={formData.originalPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none" required />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Discounted Price <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input type="number" name="discountedPrice" value={formData.discountedPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows={4}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Product Image</label>
          <div onClick={() => imageInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-5 text-center hover:border-orange-400 hover:bg-orange-50 transition">
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600">✕</button>
                <p className="text-xs text-gray-500 mt-2">{imageFile?.name}</p>
              </div>
            ) : (
              <div>
                <div className="text-4xl text-gray-300 mb-2">🖼️</div>
                <p className="text-sm text-gray-500">Click to upload a product image</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP up to 10MB</p>
              </div>
            )}
          </div>
          <input ref={imageInputRef} type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} className="hidden" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Video URL <span className="text-xs font-normal text-gray-400">(Optional)</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange}
                placeholder="Paste a YouTube, Facebook, Instagram or TikTok link..."
                className={`block w-full border rounded-lg p-3 pr-32 focus:ring-2 focus:ring-orange-400 outline-none ${videoUrlError ? 'border-red-400' : 'border-gray-300'}`} />
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

        <div className="md:col-span-2">
          <button onClick={handleSubmit} disabled={isSubmitting}
            className={`w-full text-white font-bold py-4 rounded-lg transition duration-300 shadow-lg ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#FA5600] hover:bg-[#E04A00]'}`}>
            {isSubmitting ? '⏳ Uploading & Saving...' : 'Add Product to Database'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddProductForm;
