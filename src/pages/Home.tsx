import { Link } from 'react-router-dom';
import { MessageCircle, FileText, CheckCircle, Package, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Home() {
  const [categories, setCategories] = useState<{ _id: string; name: string; image?: string }[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data.filter((c: any) => !c.parentId));
        }
      })
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
      {/* Hero Section */}
      <section className="bg-white overflow-hidden relative border-b-4 border-[#FA5600]">
        <div className="max-w-5xl mx-auto px-8 py-20 lg:py-28 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFF3E0] border-2 border-[#FA5600] text-[10px] font-bold uppercase tracking-widest mb-6">
            <MessageCircle className="w-4 h-4 text-[#FA5600]" /> Order Directly via WhatsApp
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tighter leading-none uppercase mb-6">
            Discover Great<br />
            <span className="text-[#FA5600]">Toys, Gear</span><br />
            <span className="text-3xl md:text-5xl text-gray-700">& Sports</span>
          </h1>
          <p className="text-sm md:text-base font-bold text-slate-500 max-w-2xl mx-auto mb-10 uppercase tracking-wide">
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

      {/* How it Works - Brighter */}
      <section className="py-20 bg-[#FA5600]">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">How to Order</h2>
            <p className="text-sm font-bold uppercase tracking-widest text-white/70">Quick, personalized service via chat</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative overflow-hidden p-6 bg-white rounded-xl shadow-md">
              <span className="step-number text-[#FA5600]">1</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-4">
                  <Package className="w-6 h-6 text-[#FA5600]" />
                </div>
                <h3 className="font-black text-lg mb-2 uppercase text-gray-900">Select Items</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Add favorite toys and gear to your order list.</p>
              </div>
            </div>

            <div className="relative overflow-hidden p-6 bg-white rounded-xl shadow-md">
              <span className="step-number text-[#FA5600]">2</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-[#FA5600]" />
                </div>
                <h3 className="font-black text-lg mb-2 uppercase text-gray-900">Fill Details</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Enter your name, phone and delivery address.</p>
              </div>
            </div>

            <div className="relative overflow-hidden p-6 bg-[#1A1A1A] rounded-xl shadow-md text-white">
              <span className="step-number text-white opacity-10">3</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-6 h-6 text-[#25D366]" />
                </div>
                <h3 className="font-black text-lg mb-2 uppercase">Send on WhatsApp</h3>
                <p className="text-xs font-bold text-white/60 uppercase tracking-wide">One click sends your order directly on WhatsApp!</p>
              </div>
            </div>

            <div className="relative overflow-hidden p-6 bg-white rounded-xl shadow-md">
              <span className="step-number text-[#FA5600]">4</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-[#FA5600]" />
                </div>
                <h3 className="font-black text-lg mb-2 uppercase text-gray-900">Confirm</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">We reply with payment instructions & delivery.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Browse by Category - loads from MongoDB */}
      <section className="py-20 bg-[#F5F5F5]">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b-2 border-gray-300 pb-4">
            <div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-1">Shop by Category</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Find exactly what you are looking for</p>
            </div>
            <Link to="/products" className="hidden sm:inline-flex items-center gap-2 text-[#FA5600] font-black uppercase text-sm tracking-widest hover:underline transition-colors mt-4 md:mt-0">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.length > 0 ? categories.map((cat, index) => (
              <Link
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                key={cat._id}
                className="group relative h-48 rounded-xl overflow-hidden shadow-md block bg-black">
                <img
                  src={cat.image || defaultImages[cat.name] || fallbackImages[index % 4]}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-60 group-hover:opacity-40"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{cat.name}</h3>
                </div>
              </Link>
            )) : (
              // Fallback static categories if API not ready
              ['Electronics', 'Automotive', 'Travel Gear', 'Toys'].map((cat, index) => (
                <Link
                  to={`/products?category=${encodeURIComponent(cat)}`}
                  key={cat}
                  className="group relative h-48 rounded-xl overflow-hidden shadow-md block bg-black">
                  <img
                    src={fallbackImages[index]}
                    alt={cat}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-60 group-hover:opacity-40"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{cat}</h3>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="mt-8 sm:hidden text-center">
            <Link to="/products" className="inline-flex items-center gap-2 text-[#FA5600] font-black uppercase text-sm tracking-widest border-b-2 border-[#FA5600] pb-1 hover:opacity-80 transition-all">
              View All Products <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
