import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Phone, Mail, MapPin, Search } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { CustomerRegistrationModal } from './CustomerRegistrationModal';
import { User } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { ChatBot } from './ChatBot';

export function Layout({ children }: { children: ReactNode }) {
  const { totalItems, customer, setShowSignIn, setRedirectAfterAuth } = useCart();
  const { categories, banner, isLoaded } = useAppData();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const tickerRef = useRef<HTMLDivElement>(null);

  // Build promo lines from shared banner data
  const promoLines = banner?.promoLines
    ? banner.promoLines.filter((l: any) => l.text?.trim()).map((l: any) => l.text)
    : banner?.promoText
    ? [banner.promoText]
    : [];

  // Sync CSS animation duration based on content width so speed stays constant
  useEffect(() => {
    const el = tickerRef.current;
    if (!el || promoLines.length === 0) return;
    // ~80px per second; content is duplicated so use half the scrollWidth
    const contentWidth = el.scrollWidth / 2;
    const duration = Math.max(12, contentWidth / 48);
    el.style.animationDuration = `${duration}s`;
  }, [promoLines.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const mapsLink = `https://www.google.com/maps?q=24.58626748321101,73.68766945881869`;

  return (
    <div className="min-h-screen flex flex-col max-w-[1200px] mx-auto bg-[#F5F5F5] shadow-2xl relative">

      {/* Promo Banner — continuous relay marquee */}
      {isLoaded && promoLines.length > 0 && (
        <div className="bg-[#FA5600] text-white text-[10px] font-bold uppercase tracking-widest overflow-hidden h-6 flex items-center">
          <div
            ref={tickerRef}
            className="flex whitespace-nowrap"
            style={{
              animation: 'tags-ticker 30s linear infinite',
              willChange: 'transform',
            }}
          >
            {/* Duplicate the list twice so the scroll loops seamlessly */}
            {[...promoLines, ...promoLines].map((line, i) => (
              <span key={i} className="flex items-center">
                <span className="px-8">{line}</span>
                <span className="text-white/40 select-none">•</span>
              </span>
            ))}
          </div>
          <style>{`
            @keyframes tags-ticker {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      )}

      {/* Main Header */}
      <header className="bg-white text-[#1A1A1A] px-6 py-3 z-50 sticky top-0 flex justify-between items-center shadow-sm border-b border-gray-200">
        <Link to="/" className="text-2xl font-black tracking-tighter uppercase cursor-pointer shrink-0">
          <span className="text-[#FA5600]">T</span>AGS
        </Link>

        <form onSubmit={handleSearch} className="hidden md:flex flex-1 mx-8 max-w-xl">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for toys, gear, gadgets, sports..."
              className="w-full border-2 border-[#FA5600] rounded-full px-5 py-2 text-sm outline-none pr-12"
            />
            <button type="submit" className="absolute right-0 top-0 h-full bg-[#FA5600] text-white px-4 rounded-full hover:bg-[#E04A00] transition">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex space-x-5 text-sm font-semibold uppercase tracking-wider text-[#1A1A1A]">
            <Link to="/" className="hover:text-[#FA5600] transition-colors">Home</Link>
            <Link to="/products" className="hover:text-[#FA5600] transition-colors">Catalog</Link>
            <Link to="/contact" className="hover:text-[#FA5600] transition-colors">Contact</Link>
            {customer.name && customer.name !== 'Guest' && customer.customerId ? (
              <a href="/account" className="flex items-center gap-1.5 hover:text-[#FA5600] transition-colors">
                <User className="w-3.5 h-3.5" />
                <span>{customer.name.split(' ')[0]}</span>
              </a>
            ) : (
              <button onClick={() => setShowSignIn(true)} className="flex items-center gap-1.5 hover:text-[#FA5600] transition-colors">
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </nav>

          <button
            onClick={() => {
              if (customer.customerId) {
                navigate('/order');
              } else {
                setRedirectAfterAuth('/order');
                setShowSignIn(true);
              }
            }}
            className="relative flex items-center bg-[#FA5600] text-white px-4 py-2 rounded-full hover:bg-[#E04A00] transition-colors"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Order List</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-black text-white bg-[#E53935] rounded-full shadow-sm">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Category Strip — skeleton until BOTH APIs loaded */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex gap-4 overflow-x-auto no-scrollbar items-center">
        <Link to="/products" className="text-xs font-bold uppercase tracking-widest whitespace-nowrap px-3 py-1 rounded-full hover:bg-[#FFF3E0] hover:text-[#FA5600] transition-colors text-gray-600">
          All
        </Link>
        {!isLoaded ? (
          [80, 120, 90, 110].map((w, i) => (
            <div key={i} className="h-5 rounded-full bg-gray-200 animate-pulse shrink-0" style={{ width: w }} />
          ))
        ) : (
          categories.map((cat) => (
            <Link key={cat._id} to={`/products?category=${encodeURIComponent(cat.name)}`}
              className="text-xs font-bold uppercase tracking-widest whitespace-nowrap px-3 py-1 rounded-full hover:bg-[#FFF3E0] hover:text-[#FA5600] transition-colors text-gray-600">
              {cat.name}
            </Link>
          ))
        )}
      </div>

      <main className="flex-grow bg-[#F5F5F5] overflow-x-hidden">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white px-8 py-10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8 text-[11px] font-bold uppercase tracking-widest">

          <div className="space-y-4 max-w-xs">
            <div className="text-2xl font-black tracking-tighter uppercase">
              <span className="text-[#FA5600]">T</span>AGS
            </div>
            <div className="opacity-80 leading-relaxed normal-case font-normal text-xs">
              TAGS: Toys Adventure Gadgets Sports is your destination for Toys, Adventure, Gadgets, and Sports. We fuel passions with "play with purpose" toys, rugged outdoor gear, cutting-edge tech, and pro sports equipment. Gear up for life!
            </div>
            <div className="flex gap-4 pt-2">
              <a href="https://www.facebook.com/TAGSUDR" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FA5600] transition-colors" title="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
              </a>
              <a href="https://instagram.com/tags.udr" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FA5600] transition-colors" title="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>
              </a>
              <a href="https://youtube.com/@tagsudr" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FA5600] transition-colors" title="YouTube">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58a2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
              </a>
              <a href="https://wa.me/916350021226" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FA5600] transition-colors" title="WhatsApp">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-[#FA5600] border-b border-white/10 pb-2">Support & Info</div>
            <ul className="space-y-2 opacity-80 flex flex-col normal-case font-normal text-xs">
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#FA5600]" /> +91 63500 21226</li>
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#FA5600]" /> tags.udr@gmail.com</li>
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#FA5600] mt-0.5 shrink-0" />
                <span>5, B Inside Hathipole, Street #2,<br />Gulabeshwar Marg, Udaipur - 313001,<br />Rajasthan, India</span>
              </li>
              <li>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#FA5600] hover:underline font-bold text-xs mt-1">
                  <MapPin className="w-3 h-3" /> Open in Google Maps →
                </a>
              </li>
              <li><Link to="/contact" className="text-[#FA5600] hover:underline font-bold">Contact Us →</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="text-[#FA5600] border-b border-white/10 pb-2">Easy Ordering</div>
            <p className="opacity-80 leading-relaxed normal-case font-normal text-xs">
              1. Select items<br />
              2. Fill your details<br />
              3. Send on WhatsApp
            </p>
            <p className="text-[#FA5600]">No online transactions</p>
          </div>

        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-center text-[10px] text-white/40 normal-case">
          © 2025 TAGS. All rights reserved.
        </div>
      </footer>
      <CustomerRegistrationModal />
      <ChatBot />
    </div>
  );
}
