import { Link } from 'react-router-dom';
import { MessageCircle, FileText, CheckCircle, Package, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Home() {
  const [categories, setCategories] = useState<{ _id: string; name: string; image?: string }[]>([]);
  const [banner, setBanner] = useState<{ image?: string; text?: string } | null>(null);

  useEffect(() => {
    // Load categories - sorted by createdAt ascending (oldest first)
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const filtered = data
            .filter((c: any) => !c.parentId && c.name && c.name.trim() !== '') // remove empty/unnamed
            .sort((a: any, b: any) => {
              // Sort oldest first (ascending by createdAt)
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateA - dateB;
            });
          setCategories(filtered);
        }
      })
      .catch(() => {});

    // Load banner settings
    fetch('/api/banner')
      .then(res => res.json())
      .then(data => { if (data && !data.error) setBanner(data); })
      .catch(() => {});
  }, []);

  const defaultImages: Record<string, string> = {
    'Electronics': 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
    'Automotive': 'https://images.unsplash.com/photo-1504280390224-340788ee5c60?auto=format&fit=crop&q=80&w=800',
    'Travel Gear': 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?auto=format&fit=crop&q=80&w=800',
    'Toys': 'https://images.unsplash.com/photo-1519861531473-920026076da6?auto=format&fit=crop&q=80&w=800',
  };

  const fallbackImages = [
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1504280390224-340788ee5c60?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1579829366248-204fe8413f31?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1519861531473-920026076da6?auto=format&fit=crop&q=80&w=800',
  ];

  return (
    <div>
      {/* ===== DYNAMIC HERO BANNER ===== */}
      {/*
        HOW TO UPDATE THE BANNER:
        - Image & text are loaded from your /api/banner endpoint (MongoDB).
        - To update, use your admin panel to POST/PUT to /api/banner with:
            { "image": "<image URL>", "text": "<headline text>" }
        - If no banner is set in DB, the default gradient + default heading shows.
        - Category cover images: update the `image` field on each category
          via your admin panel (POST/PUT to /api/categories with the category _id).
      */}
      <section
        className="relative overflow-hidden border-b-4 border-[#FA5600] min-h-[400px] lg:min-h-[500px] flex items-center"
        style={{
          background: banner?.image
            ? `url(${banner.image}) center/cover no-repeat`
            : 'linear-gradient(135deg, #1A1A1A 0%, #2d2d2d 100%)'
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-8 py-20 lg:py-28 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FA5600] text-white text-[10px] font-bold uppercase tracking-widest mb-6 rounded-full">
            <MessageCircle className="w-4 h-4" /> Order Directly via WhatsApp
          </div>

          {/* Dynamic banner text or default */}
          {banner?.text ? (
            <div className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight uppercase mb-6 max-w-3xl">
              {banner.text}
            </div>
          ) : (
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none uppercase mb-6">
              Discover Great<br />
              <span className="text-[#FA5600]">Toys, Gear</span><br />
              <span className="text-3xl md:text-5xl text-white/80">& Sports</span>
            </h1>
          )}

          <p className="text-sm md:text-base font-bold text-white/70 max-w-2xl mx-auto mb-10 uppercase tracking-wide">
            Discover great toys, Adventure gear, gadgets, sports items — Browse our curated collection and send your order directly via WhatsApp!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link to="/products"
              className="bg-[#FA5600] hover:bg-[#E04A00] text-white font-black uppercase text-sm tracking-widest py-4 px-8 w-full sm:w-auto flex items-center justify-center gap-2 transition-all rounded-full shadow-lg">
              Browse Catalog <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="https://wa.me/916350021226" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-black uppercase text-sm tracking-widest py-4 px-8 hover:bg-[#20bd5a] transition-all w-full sm:w-auto rounded-full shadow-lg">
              <MessageCircle className="w-5 h-5" /> Chat with Us
            </a>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS — 3 steps only (removed empty 4th box) ===== */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter uppercase">How to Order</h2>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Quick, personalized service via chat</p>
          </div>

          {/* FIX: Changed grid from md:grid-cols-4 to md:grid-cols-3, removed empty 4th box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative overflow-hidden p-6 bg-slate-50 border-2 border-black card-hover">
              <span className="step-number">1</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <Package className="w-6 h-6 mb-4 text-black" />
                <h3 className="font-black text-lg mb-2 uppercase">Select Items</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Add favorite toys and gear to your order list.</p>
              </div>
            </div>

            <div className="relative overflow-hidden p-6 bg-slate-50 border-2 border-black card-hover">
              <span className="step-number">2</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <FileText className="w-6 h-6 mb-4 text-black" />
                <h3 className="font-black text-lg mb-2 uppercase">Fill Details</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Enter your name, phone and delivery address.</p>
              </div>
            </div>

            <div className="relative overflow-hidden p-6 bg-[#FA5600] border-2 border-black card-hover text-white">
              <span className="step-number text-black opacity-10">3</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <MessageCircle className="w-6 h-6 mb-4 text-white" />
                <h3 className="font-black text-lg mb-2 uppercase">Send on WhatsApp</h3>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wide">One click sends your order directly on WhatsApp!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SHOP BY CATEGORY ===== */}
      <section className="py-20 bg-slate-50 border-t-4 border-black">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b-2 border-black pb-4">
            <div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-1">Shop by Category</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Find exactly what you are looking for</p>
            </div>
            <Link to="/products" className="hidden sm:inline-flex items-center gap-2 text-black font-black uppercase text-sm tracking-widest hover:text-[#FA5600] transition-colors mt-4 md:mt-0">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/*
            FIX: Categories are now sorted oldest-first (done in useEffect above).
            FIX: Empty/unnamed categories are filtered out (done in useEffect above).
            To update a category's cover image: use your admin panel to update
            the `image` field on the category document in MongoDB.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(categories.length > 0 ? categories : ['Electronics', 'Automotive', 'Travel Gear', 'Toys'].map(name => ({ _id: name, name }))).map((cat: any, index) => (
              <Link
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                key={cat._id}
                className="group relative h-48 border-2 border-black overflow-hidden card-hover block bg-black">
                <img
                  src={cat.image || defaultImages[cat.name] || fallbackImages[index % 4]}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-60 group-hover:opacity-40"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{cat.name}</h3>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 sm:hidden text-center">
            <Link to="/products" className="inline-flex items-center gap-2 text-black font-black uppercase text-sm tracking-widest border-b-2 border-black pb-1 hover:text-[#FA5600] hover:border-[#FA5600] transition-all">
              View All Products <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
