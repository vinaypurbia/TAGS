import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data/products';
import { MessageCircle, FileText, CheckCircle, Package, ArrowRight } from 'lucide-react';

export function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-slate-50 overflow-hidden relative border-b-4 border-black border-collapse">
        <div className="max-w-5xl mx-auto px-8 py-20 lg:py-28 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-[10px] font-bold uppercase tracking-widest mb-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <MessageCircle className="w-4 h-4 text-[var(--color-wa-green)]" /> Order Directly via WhatsApp
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tighter leading-none uppercase mb-6">
            Discover Great<br/><span className="text-[var(--color-wa-green)]">Toys & Gear</span>
          </h1>
          <p className="text-sm md:text-base font-bold text-slate-500 max-w-2xl mx-auto mb-10 uppercase tracking-wide">
            Browse our curated collection of toys, adventure gear, and gadgets. Create an order list and send it directly to our team via WhatsApp!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link to="/products" className="bg-black hover:bg-slate-800 text-white font-black uppercase text-sm tracking-widest py-4 px-8 w-full sm:w-auto flex items-center justify-center gap-2 transition-all">
              Browse Catalog <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="https://wa.me/15551234567" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[var(--color-wa-green)] text-white font-black uppercase text-sm tracking-widest py-4 px-8 hover:bg-[#20bd5a] transition-all w-full sm:w-auto">
              <MessageCircle className="w-5 h-5" /> Chat with Us
            </a>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter uppercase">How to Order</h2>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Quick, personalized service via chat</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <h3 className="font-black text-lg mb-2 uppercase">Generate PDF</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Enter details and download your custom PDF.</p>
              </div>
            </div>
            
            <div className="relative overflow-hidden p-6 bg-[var(--color-wa-green)] border-2 border-black card-hover text-white">
              <span className="step-number text-black opacity-10">3</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <MessageCircle className="w-6 h-6 mb-4 text-white" />
                <h3 className="font-black text-lg mb-2 uppercase">Send on WA</h3>
                <p className="text-xs font-bold text-[var(--color-wa-dark)] uppercase tracking-wide">Open WhatsApp and attach your order PDF.</p>
              </div>
            </div>
            
            <div className="relative overflow-hidden p-6 bg-slate-50 border-2 border-black card-hover">
              <span className="step-number">4</span>
              <div className="relative z-10 flex flex-col h-full items-start">
                <CheckCircle className="w-6 h-6 mb-4 text-black" />
                <h3 className="font-black text-lg mb-2 uppercase">Confirm</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">We reply with payment instructions & delivery.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section className="py-20 bg-slate-50 border-t-4 border-black">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b-2 border-black pb-4">
            <div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-1">Shop by Category</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Find exactly what you are looking for</p>
            </div>
            <Link to="/products" className="hidden sm:inline-flex items-center gap-2 text-black font-black uppercase text-sm tracking-widest hover:text-[var(--color-wa-green)] transition-colors mt-4 md:mt-0">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORIES.map((cat, index) => {
              const bgImages = [
                'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1504280390224-340788ee5c60?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1579829366248-204fe8413f31?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1519861531473-920026076da6?auto=format&fit=crop&q=80&w=800'
              ];
              
              return (
                <Link to={`/products?category=${encodeURIComponent(cat)}`} key={cat} className="group relative h-48 border-2 border-black overflow-hidden card-hover block bg-black">
                  <img src={bgImages[index]} alt={cat} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-60 group-hover:opacity-40" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter mix-blend-difference">{cat}</h3>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="mt-8 sm:hidden text-center">
             <Link to="/products" className="inline-flex items-center gap-2 text-black font-black uppercase text-sm tracking-widest border-b-2 border-black pb-1 hover:text-[var(--color-wa-green)] hover:border-[var(--color-wa-green)] transition-all">
               View All Products <ArrowRight className="w-5 h-5" />
             </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// THIS LINE IS CRITICAL: Fixes "found pages without a React Component as default export"
export default Home;
