import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Phone, Mail, MapPin, Search } from 'lucide-react';
import { useCart } from '../context/CartContext';

export function Layout({ children }: { children: ReactNode }) {
  const { totalItems } = useCart();

  return (
    <div className="min-h-screen flex flex-col max-w-[1200px] mx-auto bg-[#F5F5F5] shadow-2xl relative">

      {/* Top bar */}
      <div className="bg-[#FA5600] text-white text-[10px] font-bold uppercase tracking-widest px-8 py-1.5 text-center">
        🔥 Free Shipping on Orders Over $29 · Up to 90% Off Today!
      </div>

      {/* Main Header */}
      <header className="bg-white text-[#1A1A1A] px-6 py-3 z-50 sticky top-0 flex justify-between items-center shadow-sm border-b border-gray-200">
        
        {/* Logo */}
        <Link to="/" className="text-2xl font-black tracking-tighter uppercase cursor-pointer">
          Play<span className="text-[#FA5600]">&Gear</span>
        </Link>

        {/* Search bar - hidden on mobile */}
        <div className="hidden md:flex flex-1 mx-8 max-w-xl">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search for toys, gear, gadgets..."
              className="w-full border-2 border-[#FA5600] rounded-full px-5 py-2 text-sm outline-none pr-12"
            />
            <button className="absolute right-0 top-0 h-full bg-[#FA5600] text-white px-4 rounded-full hover:bg-[#E04A00] transition">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav + Cart */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex space-x-5 text-sm font-semibold uppercase tracking-wider text-[#1A1A1A]">
            <Link to="/" className="hover:text-[#FA5600] transition-colors">Home</Link>
            <Link to="/products" className="hover:text-[#FA5600] transition-colors">Catalog</Link>
          </nav>

          <Link to="/order" className="relative flex items-center bg-[#FA5600] text-white px-4 py-2 rounded-full hover:bg-[#E04A00] transition-colors">
            <ShoppingBag className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Order List</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-black text-white bg-[#E53935] rounded-full shadow-sm">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Category Strip */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex gap-4 overflow-x-auto no-scrollbar">
        {['All', 'Electronics', 'Automotive', 'Travel Gear', 'Toys'].map((cat) => (
          <Link
            key={cat}
            to={cat === 'All' ? '/products' : `/products?category=${cat}`}
            className="text-xs font-bold uppercase tracking-widest whitespace-nowrap px-3 py-1 rounded-full hover:bg-[#FFF3E0] hover:text-[#FA5600] transition-colors text-gray-600"
          >
            {cat}
          </Link>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-grow bg-[#F5F5F5] overflow-x-hidden">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white px-8 py-10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8 text-[11px] font-bold uppercase tracking-widest">

          <div className="space-y-4">
            <div className="text-2xl font-black tracking-tighter uppercase">
              Play<span className="text-[#FA5600]">&Gear</span>
            </div>
            <div className="opacity-60 max-w-xs leading-relaxed normal-case font-normal text-xs">
              Your one-stop shop for toys, adventure gear, and gadgets. Easy ordering via WhatsApp without online payment hassle.
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-[#FA5600] border-b border-white/10 pb-2">Support & Info</div>
            <ul className="space-y-2 opacity-80 flex flex-col normal-case font-normal text-xs">
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#FA5600]" /> +1 (555) 123-4567</li>
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#FA5600]" /> support@playandgear.com</li>
              <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#FA5600]" /> 124 Adventure Lane, Sport City</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="text-[#FA5600] border-b border-white/10 pb-2">Easy Ordering</div>
            <p className="opacity-80 leading-relaxed normal-case font-normal text-xs">
              1. Select items<br />
              2. Download PDF Form<br />
              3. Send on WhatsApp
            </p>
            <p className="text-[#FA5600]">No online transactions</p>
          </div>

        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-center text-[10px] text-white/40 normal-case">
          © 2024 Play&Gear. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
