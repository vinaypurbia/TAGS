import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingBag, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, addItem } = useCart();
  const [isRecentlyAdded, setIsRecentlyAdded] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    // ── FIX: fetch single product by ID directly ──────────────
    // Old code fetched ALL products then did array.find() which broke
    // when the API switched to a paginated envelope { products, total, hasMore }
    // New code uses ?id=<id> which returns a single product object directly
    fetch(`/api/products?id=${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        // data is a single product object (not an array or envelope)
        setProduct(data);

        // Resolve display image — support imageUrls[], imageUrl, or image
        const imgs: string[] =
          data.imageUrls?.length > 0
            ? data.imageUrls
            : data.imageUrl
              ? [data.imageUrl]
              : data.image
                ? [data.image]
                : [];
        if (imgs.length > 0) setSelectedImage(imgs[0]);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-black font-black uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────
  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Product Not Found</h2>
        <p className="text-gray-500 mb-8">We couldn't find the product you're looking for.</p>
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center justify-center bg-[#25D366] text-white font-bold py-3 px-8 rounded-full shadow-md hover:bg-green-600 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Catalog
        </button>
      </div>
    );
  }

  // ── Handlers ─────────────────────────────────────────────
  const handleAddItem = () => {
    addItem(product);
    setIsRecentlyAdded(true);
    setTimeout(() => setIsRecentlyAdded(false), 1500);
  };

  const quantityInCart = items.find(i => i.product.id === product._id?.toString())?.quantity || 0;
  const displayPrice   = product.discountedPrice || product.originalPrice || product.price;

  // Normalize images
  const allImages: string[] =
    product.imageUrls?.length > 0
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : product.image
          ? [product.image]
          : [];

  // ── Video embed ───────────────────────────────────────────
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

  const embedUrl = product.videoUrl ? getEmbedUrl(product.videoUrl) : null;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-8">
      <Link
        to="/products"
        className="inline-flex items-center text-xs font-bold uppercase tracking-widest hover:text-[var(--color-wa-green)] transition-colors mb-8 text-slate-500 border-b-2 border-transparent hover:border-[var(--color-wa-green)] pb-1">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Catalog
      </Link>

      <div className="bg-white border-2 border-black max-w-5xl mx-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* ── Image Gallery ── */}
          <div className="overflow-hidden bg-slate-50 border-b-2 md:border-b-0 md:border-r-2 border-black flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-full object-contain aspect-square mix-blend-multiply" />
              ) : (
                <div className="w-full aspect-square bg-slate-100 flex items-center justify-center">
                  <span className="text-6xl">📦</span>
                </div>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="flex gap-2 p-3 border-t-2 border-black bg-white overflow-x-auto">
                {allImages.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className={cn(
                      'w-16 h-16 border-2 overflow-hidden flex-shrink-0 transition-all',
                      selectedImage === img ? 'border-black' : 'border-gray-200 hover:border-gray-400'
                    )}>
                    <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product Details ── */}
          <div className="flex flex-col justify-center p-8 lg:p-12">
            <div className="inline-flex px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest w-max mb-6">
              {product.category}
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-black tracking-tighter mb-4 leading-none uppercase">
              {product.name}
            </h1>

            <div className="mb-8 pb-4 border-b-4 border-black">
              <span className="text-3xl font-black text-black">
                ₹{Number(displayPrice).toFixed(2)}
              </span>
              {product.discountedPrice && product.originalPrice && (
                <span className="text-lg text-slate-400 line-through ml-3">
                  ₹{Number(product.originalPrice).toFixed(2)}
                </span>
              )}
            </div>

            <p className="text-slate-600 text-sm font-bold uppercase tracking-wide leading-relaxed mb-8">
              {product.description}
            </p>

            {product.subcategory && (
              <div className="mb-4">
                <span className="inline-block bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-widest px-3 py-1 border border-gray-300">
                  {product.subcategory}
                </span>
              </div>
            )}

            <div className="mt-auto space-y-4 pt-8">
              <button
                onClick={handleAddItem}
                disabled={isRecentlyAdded}
                className={cn(
                  'w-full py-5 px-6 font-black uppercase tracking-tighter flex items-center justify-center gap-2 transition-all text-sm border-2',
                  isRecentlyAdded
                    ? 'bg-slate-100 text-black border-black/20'
                    : 'bg-[var(--color-wa-green)] hover:bg-[#20bd5a] text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none'
                )}>
                {isRecentlyAdded ? (
                  <><Check className="w-5 h-5" /> Added to List!</>
                ) : (
                  <><ShoppingBag className="w-5 h-5" /> Add to Order List {quantityInCart > 0 && `(${quantityInCart})`}</>
                )}
              </button>
              <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Order via WhatsApp / No checkout required
              </p>
            </div>
          </div>
        </div>

        {/* ── Video Section ── */}
        {embedUrl && (
          <div className="border-t-2 border-black p-8">
            <h3 className="font-black uppercase tracking-widest text-sm mb-4">Product Video</h3>
            <div className="relative w-full rounded overflow-hidden" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute top-0 left-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                frameBorder="0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductDetail;
