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
    // Fetch single product by ID — fixes "Product Not Found" caused by
    // paginated API envelope breaking the old array.find() approach
    fetch(`/api/products?id=${id}`)
      .then(res => { if (!res.ok) throw new Error('Not found'); return res.json(); })
      .then(data => {
        setProduct(data);
        const imgs: string[] =
          data.imageUrls?.length > 0 ? data.imageUrls
          : data.imageUrl             ? [data.imageUrl]
          : data.image                ? [data.image]
          : [];
        if (imgs.length > 0) setSelectedImage(imgs[0]);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-[#FA5600] rounded-full animate-spin" />
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">404</div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Product Not Found</h2>
        <p className="text-gray-500 mb-8 text-sm">We couldn't find the product you're looking for.</p>
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center gap-2 bg-[#25D366] text-white font-bold py-3 px-8 rounded-full shadow-md hover:bg-green-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </button>
      </div>
    );
  }

  const handleAddItem = () => {
    addItem(product);
    setIsRecentlyAdded(true);
    setTimeout(() => setIsRecentlyAdded(false), 1500);
  };

  const quantityInCart = items.find(i => i.product.id === product._id?.toString())?.quantity || 0;
  const hasDiscount    = product.discountedPrice && product.originalPrice
                         && Number(product.discountedPrice) < Number(product.originalPrice);
  const displayPrice   = hasDiscount
                         ? product.discountedPrice
                         : (product.originalPrice || product.price);
  const discountPct    = hasDiscount
                         ? Math.round((1 - Number(product.discountedPrice) / Number(product.originalPrice)) * 100)
                         : 0;

  const allImages: string[] =
    product.imageUrls?.length > 0 ? product.imageUrls
    : product.imageUrl             ? [product.imageUrl]
    : product.image                ? [product.image]
    : [];

  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const yt = url.match(/youtube\.com\/watch\?v=([\w-]+)/)
            || url.match(/youtu\.be\/([\w-]+)/)
            || url.match(/youtube\.com\/shorts\/([\w-]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
    if (url.includes('facebook.com') || url.includes('fb.watch'))
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`;
    const ig = url.match(/instagram\.com\/(reel|p)\/([\w-]+)/);
    if (ig) return `https://www.instagram.com/${ig[1]}/${ig[2]}/embed`;
    const tt = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
    if (tt) return `https://www.tiktok.com/embed/${tt[1]}`;
    return null;
  };

  const embedUrl = product.videoUrl ? getEmbedUrl(product.videoUrl) : null;

  return (
    <div className="px-4 py-6 md:p-8 max-w-5xl mx-auto">

      {/* Back link */}
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-[#FA5600] transition-colors mb-6 border-b-2 border-transparent hover:border-[#FA5600] pb-1">
        <ArrowLeft className="w-4 h-4" /> Back to Catalog
      </Link>

      <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">

        {/* KEY FIX: md:items-start stops right column from stretching the image panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 md:items-start">

          {/* ── LEFT: Image — strict aspect-square, never grows ── */}
          <div className="bg-gray-50 border-b-2 md:border-b-0 md:border-r-2 border-black">
            <div className="aspect-square w-full p-5 flex items-center justify-center">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              ) : (
                <span className="text-7xl">📦</span>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 p-3 border-t-2 border-black bg-white overflow-x-auto">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className={cn(
                      'w-14 h-14 border-2 overflow-hidden shrink-0 transition-all',
                      selectedImage === img ? 'border-black' : 'border-gray-200 hover:border-gray-500'
                    )}>
                    <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Product info ── */}
          <div className="p-6 lg:p-8 flex flex-col gap-4">

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-black text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                {product.category}
              </span>
              {product.subcategory && (
                <span className="border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  {product.subcategory}
                </span>
              )}
            </div>

            {/* Title — normal case, contained size, good line-height */}
            <h1 className="text-xl lg:text-2xl font-black text-gray-900 leading-snug">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-gray-100">
              <span className="text-2xl font-black text-gray-900">
                &#8377;{Number(displayPrice).toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-gray-400 line-through">
                    &#8377;{Number(product.originalPrice).toLocaleString('en-IN')}
                  </span>
                  <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-0.5 rounded-full">
                    -{discountPct}% OFF
                  </span>
                </>
              )}
            </div>

            {/* Description — sentence case, normal weight, readable */}
            {product.description && (
              <p className="text-gray-600 text-sm leading-relaxed">
                {product.description}
              </p>
            )}

            {/* CTA */}
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={handleAddItem}
                disabled={isRecentlyAdded}
                className={cn(
                  'w-full py-4 px-6 font-black uppercase tracking-wide flex items-center justify-center gap-2 text-sm border-2 transition-all',
                  isRecentlyAdded
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-[var(--color-wa-green)] hover:bg-[#20bd5a] text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                )}>
                {isRecentlyAdded
                  ? <><Check className="w-5 h-5" /> Added to List!</>
                  : <><ShoppingBag className="w-5 h-5" /> Add to Order List{quantityInCart > 0 ? ` (${quantityInCart})` : ''}</>
                }
              </button>
              <p className="text-center text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                Order via WhatsApp &nbsp;&middot;&nbsp; No checkout required
              </p>
            </div>

          </div>
        </div>

        {/* Video */}
        {embedUrl && (
          <div className="border-t-2 border-black p-6 md:p-8">
            <h3 className="font-black uppercase tracking-widest text-sm text-gray-900 mb-4">Product Video</h3>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                frameBorder="0"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ProductDetail;
