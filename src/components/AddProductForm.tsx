import React, { useState, useRef } from 'react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

const AddProductForm = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    originalPrice: '',
    discountedPrice: '',
    category: '',
    description: '',
    videoUrl: ''
  });

  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [uploading, setUploading] = useState(false);
  const [videoUrlError, setVideoUrlError] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const imageInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPasswordInput('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'videoUrl') {
      setVideoUrlError('');
      setEmbedUrl(null);
    }
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

  const handleRemoveImage = (index: number) => {
    const newFiles = [...imageFiles];
    const newPreviews = [...imagePreviews];
    newFiles[index] = null;
    newPreviews[index] = null;
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    if (imageInputRefs[index].current) imageInputRefs[index].current!.value = '';
  };

  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const ytMatch =
      url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
      url.match(/youtu\.be\/([\w-]+)/) ||
      url.match(/youtube\.com\/shorts\/([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`;
    }
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
    if (!embed) {
      setVideoUrlError('Could not embed this URL. Supported: YouTube, Facebook, Instagram, TikTok.');
      return;
    }
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
      setVideoUrlError('Could not embed this URL. Supported: YouTube, Facebook, Instagram, TikTok.');
      return;
    }

    setUploading(true);

    try {
      // Upload all selected images
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
        body: JSON.stringify({
          ...formData,
          imageUrl: imageUrls[0] || '',   // primary image
          imageUrls,                       // all images array
        }),
      });

      if (!res.ok) throw new Error('Failed to save product');
      alert('Product added successfully!');

      // Reset form
      setFormData({ name: '', originalPrice: '', discountedPrice: '', category: '', description: '', videoUrl: '' });
      setImageFiles([null, null, null]);
      setImagePreviews([null, null, null]);
      setEmbedUrl(null);
      imageInputRefs.forEach(ref => { if (ref.current) ref.current.value = ''; });

    } catch (err) {
      alert('Failed to save product. Please try again.');
    } finally {
      setUploading(false);
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
            <p className="text-sm text-gray-500 mt-1">Enter your password to continue</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded-lg p-3 text-center text-lg focus:ring-2 focus:ring-green-500 outline-none mb-3"
          />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button
            onClick={handlePasswordSubmit}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition duration-300"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  // MAIN FORM
  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-xl rounded-xl mt-10 border border-gray-100">
      <div className="flex justify-between items-center border-b pb-4 mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Add New Product</h2>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm text-gray-400 hover:text-red-500 transition">
          🔓 Lock
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Product Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" required />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Category *</label>
          <select name="category" value={formData.category} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Select Category</option>
            <option value="Electronics">Electronics</option>
            <option value="Automotive">Automotive</option>
            <option value="Travel Gear">Travel Gear</option>
            <option value="Toys">Toys</option>
          </select>
        </div>

        {/* Original Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Original Price *</label>
          <input type="number" name="originalPrice" value={formData.originalPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" required />
        </div>

        {/* Discounted Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Discounted Price <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input type="number" name="discountedPrice" value={formData.discountedPrice} onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows={4}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        {/* 3 Image Slots */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Product Images <span className="text-gray-400 font-normal">(Up to 3 — PNG, JPG, WEBP)</span>
          </label>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <div
                  onClick={() => imageInputRefs[index].current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 hover:bg-blue-50 transition aspect-square flex items-center justify-center relative overflow-hidden"
                >
                  {imagePreviews[index] ? (
                    <>
                      <img src={imagePreviews[index]!} alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600"
                      >✕</button>
                    </>
                  ) : (
                    <div>
                      <div className="text-3xl text-gray-300 mb-1">🖼️</div>
                      <p className="text-xs text-gray-400">Image {index + 1}</p>
                      {index === 0 && <p className="text-[10px] text-blue-400 mt-1">Main</p>}
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
          <p className="text-xs text-gray-400 mt-2">⭐ Image 1 is the main display image</p>
        </div>

        {/* Video URL - Optional */}
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
          <div className="flex gap-3 mt-2">
            {['▶️ YouTube', '📘 Facebook', '📸 Instagram', '🎵 TikTok'].map((p) => (
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

        {/* Submit */}
        <div className="md:col-span-2">
          <button onClick={handleSubmit} disabled={uploading}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 transition duration-300 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {uploading ? '⏳ Uploading images & saving...' : 'Add Product to Database'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddProductForm;
