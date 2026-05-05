"use client";

import React, { useState, useRef } from 'react';

const AddProductForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    originalPrice: '',
    discountedPrice: '',
    category: '',
    description: '',
    videoUrl: ''
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrlError, setVideoUrlError] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'videoUrl') {
      setVideoUrlError('');
      setEmbedUrl(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Converts any YouTube / Facebook / Instagram URL into an embeddable iframe src
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    // YouTube: handles youtube.com/watch?v=ID and youtu.be/ID and shorts
    const ytMatch =
      url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
      url.match(/youtu\.be\/([\w-]+)/) ||
      url.match(/youtube\.com\/shorts\/([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;

    // Facebook: video embed URL
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
      const encoded = encodeURIComponent(url);
      return `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=false&autoplay=false`;
    }

    // Instagram: reel or post
    const igMatch = url.match(/instagram\.com\/(reel|p)\/([\w-]+)/);
    if (igMatch) return `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed`;

    // TikTok
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

  const handleSubmit = async () => {
    if (formData.videoUrl && !getEmbedUrl(formData.videoUrl)) {
      setVideoUrlError('Could not embed this URL. Supported: YouTube, Facebook, Instagram, TikTok.');
      return;
    }
    console.log('New Product Submission:', { ...formData, imageFile });
    alert('Product details captured!');
  };

  const detectedPlatform = detectPlatform(formData.videoUrl);

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-xl rounded-xl mt-10 border border-gray-100">
      <h2 className="text-3xl font-bold mb-8 text-gray-900 border-b pb-4">Add New Product</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Product Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Product Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Select Category</option>
            <option value="electronics">Electronics</option>
            <option value="automotive">Automotive</option>
            <option value="travel">Travel Gear</option>
          </select>
        </div>

        {/* Original Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Original Price</label>
          <input
            type="number"
            name="originalPrice"
            value={formData.originalPrice}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        {/* Discounted Price */}
        <div>
          <label className="block text-sm font-semibold text-gray-700">Discounted Price</label>
          <input
            type="number"
            name="discountedPrice"
            value={formData.discountedPrice}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="mt-1 block w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
          ></textarea>
        </div>

        {/* Product Image Upload */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Product Image</label>
          <div
            onClick={() => imageInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-5 text-center hover:border-blue-400 hover:bg-blue-50 transition"
          >
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow hover:bg-red-600"
                >✕</button>
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

        {/* Video URL + Embed Preview */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Video URL
            <span className="ml-2 text-xs font-normal text-gray-400">(Optional — customers will watch it on your site)</span>
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                name="videoUrl"
                value={formData.videoUrl}
                onChange={handleChange}
                placeholder="Paste a YouTube, Facebook, Instagram or TikTok link..."
                className={`block w-full border rounded-lg p-3 pr-32 focus:ring-2 focus:ring-blue-500 outline-none ${
                  videoUrlError ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {detectedPlatform && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full pointer-events-none">
                  {detectedPlatform.icon} {detectedPlatform.label}
                </span>
              )}
            </div>
            <button
              onClick={handlePreviewVideo}
              className="bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
            >
              Preview
            </button>
          </div>

          {videoUrlError && <p className="text-red-500 text-xs mt-1">{videoUrlError}</p>}

          <div className="flex gap-3 mt-2">
            {['▶️ YouTube', '📘 Facebook', '📸 Instagram', '🎵 TikTok'].map((p) => (
              <span key={p} className="text-xs text-gray-400">{p}</span>
            ))}
          </div>

          {/* Embedded Video Preview */}
          {embedUrl && (
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-md bg-black">
              <div className="bg-gray-800 text-white text-xs px-3 py-2 flex items-center justify-between">
                <span>📺 Video Preview — this is how customers will see it on your website</span>
                <button
                  onClick={() => { setEmbedUrl(null); setFormData(f => ({ ...f, videoUrl: '' })); }}
                  className="text-gray-400 hover:text-white ml-4"
                >✕ Remove</button>
              </div>
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  className="absolute top-0 left-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  frameBorder="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2">
          <button
            onClick={handleSubmit}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 transition duration-300 shadow-lg"
          >
            Add Product to Database
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddProductForm;
