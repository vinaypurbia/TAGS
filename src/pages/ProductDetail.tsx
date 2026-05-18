import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ShoppingBag, Check, Star, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── Stars (display only) ────────────────────────────────────────────────────
function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={cn(cls, s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200')} />
      ))}
    </div>
  );
}

// ─── Interactive star selector for review form ────────────────────────────────
function StarSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="focus:outline-none transition-transform hover:scale-110">
          <Star className={cn(
            'w-7 h-7 transition-colors',
            s <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'
          )} />
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, addItem } = useCart();
  const [isRecentlyAdded, setIsRecentlyAdded] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [perks, setPerks] = useState<{ icon: string; text: string }[]>([
    { icon: '🚚', text: 'Free Shipping' },
    { icon: '✅', text: 'Secure Payments' },
    { icon: '🔁', text: 'Easy Returns' },
  ]);

  // ─── Real reviews state ──────────────────────────────────────────────────
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // ─── Review form state ───────────────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/banner')
      .then(r => r.json())
      .then(data => { if (data.perks && Array.isArray(data.perks) && data.perks.length === 3) setPerks(data.perks); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/products?id=${id}`)
      .then(res => { if (!res.ok) throw new Error('Not found'); return res.json(); })
      .then(data => { setProduct(data); })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  // ─── Fetch real reviews ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setReviewsLoading(true);
    fetch(`/api/reviews?productId=${id}`)
      .then(r => r.json())
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  // ─── Submit a review ─────────────────────────────────────────────────────
  const handleSubmitReview = async () => {
    setFormError('');
    if (!formName.trim())    { setFormError('Please enter your name.');      return; }
    if (formRating === 0)    { setFormError('Please select a star rating.');  return; }
    if (!formComment.trim()) { setFormError('Please write a comment.');       return; }

    setFormSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId:   id,
          productName: product?.name || '',
          name:        formName.trim(),
          rating:      formRating,
          comment:     formComment.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || 'Failed to submit. Please try again.');
        return;
      }
      const newReview = await res.json();
      setReviews(prev => [newReview, ...prev]);
      setFormName(''); setFormRating(0); setFormComment('');
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 4000);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

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
        <button onClick={() => navigate('/products')}
          className="inline-flex items-center gap-2 bg-[#FA5600] text-white font-bold py-3 px-8 rounded-full shadow-md hover:bg-orange-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </button>
      </div>
    );
  }

  const allImages: string[] =
    product.imageUrls?.length > 0 ? product.imageUrls
    : product.imageUrl             ? [product.imageUrl]
    : product.image                ? [product.image]
    : [];

  const embedUrl = product.videoUrl ? getEmbedUrl(product.videoUrl) : null;

  const slides: { type: 'image' | 'video'; src: string }[] = [
    ...allImages.map(src => ({ type: 'image' as const, src })),
    ...(embedUrl ? [{ type: 'video' as const, src: embedUrl }] : []),
  ];

  const handleAddItem = () => {
    addItem(product);
    setIsRecentlyAdded(true);
    setTimeout(() => setIsRecentlyAdded(false), 1500);
  };

  const quantityInCart = items.find(i => i.product.id === product._id?.toString())?.quantity || 0;
  const hasDiscount    = product.discountedPrice && product.originalPrice
                         && Number(product.discountedPrice) < Number(product.originalPrice);
  const displayPrice   = hasDiscount ? product.discountedPrice : (product.originalPrice || product.price);
  const discountPct    = hasDiscount
    ? Math.round((1 - Number(product.discountedPrice) / Number(product.originalPrice)) * 100) : 0;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const prevSlide = () => setSelectedIdx(i => Math.max(0, i - 1));
  const nextSlide = () => setSelectedIdx(i => Math.min(slides.length - 1, i + 1));

  return (
    <div className="bg-gray-50 min-h-screen">

      {/* Back link */}
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-2">
        <Link to="/products"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-[#FA5600] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">

          {/* ── LEFT: image gallery ── */}
          <div className="flex gap-3">

            {slides.length > 1 && (
              <div ref={thumbsRef} className="hidden md:flex flex-col gap-2 w-16 shrink-0 max-h-[540px] overflow-y-auto pr-1 scrollbar-thin">
                {slides.map((slide, i) => (
                  <button key={i} onClick={() => setSelectedIdx(i)}
                    className={cn(
                      'w-16 h-16 rounded-lg border-2 overflow-hidden shrink-0 transition-all',
                      selectedIdx === i ? 'border-[#FA5600] shadow-sm' : 'border-gray-200 hover:border-gray-400'
                    )}>
                    {slide.type === 'image'
                      ? <img src={slide.src} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <span className="text-white text-xl">▶</span>
                        </div>
                    }
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="relative bg-white rounded-2xl border border-gray-200 overflow-hidden aspect-square shadow-sm group">

                {slides.length === 0 && (
                  <div className="w-full h-full flex items-center justify-center text-7xl">📦</div>
                )}

                {slides[selectedIdx]?.type === 'image' && (
                  <>
                    <img
                      src={slides[selectedIdx].src}
                      alt={product.name}
                      className="w-full h-full object-contain p-4 cursor-zoom-in"
                      onClick={() => setZoomed(true)}
                    />
                    <div className="absolute bottom-3 right-3 bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="w-4 h-4" />
                    </div>
                  </>
                )}

                {slides[selectedIdx]?.type === 'video' && (
                  <div className="relative w-full h-full">
                    <iframe src={slides[selectedIdx].src} className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen frameBorder="0" />
                  </div>
                )}

                {slides.length > 1 && (
                  <>
                    <button onClick={prevSlide} disabled={selectedIdx === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 border border-gray-200 rounded-full flex items-center justify-center shadow hover:bg-white disabled:opacity-30 transition-all">
                      <ChevronLeft className="w-4 h-4 text-gray-700" />
                    </button>
                    <button onClick={nextSlide} disabled={selectedIdx === slides.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 border border-gray-200 rounded-full flex items-center justify-center shadow hover:bg-white disabled:opacity-30 transition-all">
                      <ChevronRight className="w-4 h-4 text-gray-700" />
                    </button>
                  </>
                )}

                {slides.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {slides.map((_, i) => (
                      <button key={i} onClick={() => setSelectedIdx(i)}
                        className={cn('rounded-full transition-all', selectedIdx === i ? 'w-4 h-1.5 bg-[#FA5600]' : 'w-1.5 h-1.5 bg-gray-300')} />
                    ))}
                  </div>
                )}
              </div>

              {slides.length > 1 && (
                <div className="flex md:hidden gap-2 mt-3 overflow-x-auto pb-1">
                  {slides.map((slide, i) => (
                    <button key={i} onClick={() => setSelectedIdx(i)}
                      className={cn(
                        'w-14 h-14 rounded-lg border-2 overflow-hidden shrink-0 transition-all',
                        selectedIdx === i ? 'border-[#FA5600]' : 'border-gray-200'
                      )}>
                      {slide.type === 'image'
                        ? <img src={slide.src} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white text-lg">▶</div>
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Product info ── */}
          <div className="flex flex-col gap-4">

            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-black text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded">
                {product.category}
              </span>
              {product.subcategory && (
                <span className="border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  {product.subcategory}
                </span>
              )}
            </div>

            <h1 className="text-xl lg:text-2xl font-black text-gray-900 leading-snug">
              {product.name}
            </h1>

            {avgRating && (
              <div className="flex items-center gap-2">
                <Stars rating={Math.round(Number(avgRating))} />
                <span className="text-sm font-bold text-gray-700">{avgRating}</span>
                <span className="text-xs text-gray-400">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-black text-gray-900">
                &#8377;{Number(displayPrice).toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base text-gray-400 line-through">
                    &#8377;{Number(product.originalPrice).toLocaleString('en-IN')}
                  </span>
                  <span className="bg-[#FA5600] text-white text-xs font-black px-2.5 py-1 rounded-full">
                    -{discountPct}% OFF
                  </span>
                </>
              )}
            </div>

            <div className="border border-[#25D366]/30 rounded-xl bg-[#25D366]/5 divide-x divide-[#25D366]/20 flex overflow-hidden">
              {perks.map((perk, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 text-center">
                  <span className="text-lg leading-none">{perk.icon}</span>
                  <span className="text-[10px] font-black text-[#1a9e4f] uppercase tracking-wide leading-tight">{perk.text}</span>
                </div>
              ))}
            </div>

            {product.description && (
              <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                {product.description}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleAddItem}
                disabled={isRecentlyAdded}
                className={cn(
                  'w-full py-4 px-6 font-black uppercase tracking-wide flex items-center justify-center gap-2 text-sm rounded-xl border-2 transition-all',
                  isRecentlyAdded
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-[#FA5600] hover:bg-orange-600 text-white border-[#FA5600] shadow-lg shadow-orange-100 hover:shadow-orange-200 active:scale-95'
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

        {/* ── REVIEWS SECTION ── */}
        <div className="mt-10 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide">Customer Reviews</h2>
              <p className="text-xs text-gray-400 font-bold mt-0.5">
                {reviewsLoading
                  ? 'Loading...'
                  : reviews.length === 0
                    ? 'No reviews yet — be the first!'
                    : `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`}
              </p>
            </div>
            {avgRating && (
              <div className="flex items-center gap-3">
                <span className="text-5xl font-black text-gray-900">{avgRating}</span>
                <div className="flex flex-col gap-1">
                  <Stars rating={Math.round(Number(avgRating))} size="lg" />
                  <span className="text-xs text-gray-400 font-bold">out of 5</span>
                </div>
              </div>
            )}
          </div>

          {/* Review list */}
          {reviewsLoading ? (
            <div className="px-6 py-10 text-center">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#FA5600] rounded-full animate-spin mx-auto" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm font-bold">
              No reviews yet. Share your experience below!
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {reviews.map((review: any) => (
                <div key={review._id} className="px-6 py-5 flex gap-4">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 text-white text-xs font-black">
                    {review.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-gray-900">{review.name}</span>
                      <span className="bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Verified
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <Stars rating={review.rating} />
                    <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{review.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Write a Review form ── */}
          <div className="px-6 py-6 border-t border-gray-100 bg-gray-50/60">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-4">Write a Review</h3>

            {formSuccess ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-green-700 font-black text-sm">🎉 Thank you! Your review has been posted.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Rahul M."
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Rating</label>
                  <StarSelector value={formRating} onChange={setFormRating} />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Your Review</label>
                  <textarea
                    value={formComment}
                    onChange={e => setFormComment(e.target.value)}
                    placeholder="What did you think of this product?"
                    rows={3}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition resize-none bg-white"
                  />
                </div>

                {formError && (
                  <p className="text-red-500 text-xs font-bold">{formError}</p>
                )}

                <button
                  onClick={handleSubmitReview}
                  disabled={formSubmitting}
                  className="w-full py-3 bg-[#FA5600] hover:bg-orange-600 text-white font-black uppercase tracking-widest text-sm rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                  {formSubmitting
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                    : <><Star className="w-4 h-4" /> Submit Review</>
                  }
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── ZOOM LIGHTBOX ── */}
      {zoomed && slides[selectedIdx]?.type === 'image' && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomed(false)}>
          <img src={slides[selectedIdx].src} alt={product.name}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()} />
          <button onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition">
            ✕
          </button>
        </div>
      )}

    </div>
  );
}

export default ProductDetail;
