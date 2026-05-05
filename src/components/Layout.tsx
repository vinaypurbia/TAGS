import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Phone, Mail, MapPin } from 'lucide-react';
import { useCart } from '../context/CartContext';

export function Layout({ children }: { children: ReactNode }) {
  const { totalItems } = useCart();
  
  return (
    <div className="min-h-screen flex flex-col max-w-[1024px] mx-auto bg-white shadow-2xl relative">
      <header className="bg-[var(--color-wa-dark)] text-white px-8 py-4 z-50 sticky top-0 flex justify-between items-center shadow-md">
        <Link to="/" className="text-2xl font-black tracking-tighter uppercase relative cursor-pointer">
          Play<span className="text-[var(--color-wa-green)]">&Gear</span>
        </Link>
        
        <nav className="hidden md:flex space-x-6 text-sm font-semibold uppercase tracking-wider">
          <Link to="/" className="opacity-80 hover:opacity-100 transition-opacity">Home</Link>
          <Link to="/products" className="opacity-80 hover:opacity-100 transition-opacity">Catalog</Link>
        </nav>

        <div className="flex items-center gap-4">
           <Link to="/order" className="relative flex items-center bg-white/10 px-4 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-colors">
             <ShoppingBag className="w-4 h-4 mr-2" />
             <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Order List</span>
             {totalItems > 0 && (
               <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-black text-[var(--color-wa-dark)] bg-white rounded-full shadow-sm">
                 {totalItems}
               </span>
             )}
           </Link>
        </div>
      </header>

      <main className="flex-grow bg-white overflow-x-hidden">
        {children}
      </main>

      <footer className="bg-[var(--color-wa-dark)] text-white px-8 py-10 text-[10px] font-bold uppercase tracking-widest mt-auto border-t-[8px] border-[var(--color-wa-green)] gap-8 flex flex-col md:flex-row justify-between">
        <div className="space-y-4">
          <div className="text-2xl font-black tracking-tighter uppercase">
            Play<span className="text-[var(--color-wa-green)]">&Gear</span>
          </div>
          <div className="opacity-70 max-w-xs leading-relaxed">
            Your one-stop shop for toys, adventure gear, and gadgets. Easy ordering via WhatsApp without online payment hassle.
          </div>
        </div>
        <div className="space-y-4">
          <div className="text-white/50 border-b border-white/20 pb-2">Support & Info</div>
          <ul className="space-y-2 opacity-80 flex flex-col">
            <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-[var(--color-wa-green)]"/> +1 (555) 123-4567</li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-[var(--color-wa-green)]"/> support@playandgear.com</li>
            <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[var(--color-wa-green)]"/> 124 Adventure Lane, Sport City</li>
          </ul>
        </div>
        <div className="space-y-4 max-w-xs">
           <div className="text-white/50 border-b border-white/20 pb-2">Easy Ordering</div>
           <p className="opacity-80 leading-relaxed">
             1. Select items<br/>
             2. Download PDF Form<br/>
             3. Send on WhatsApp
           </p>
           <p className="text-[var(--color-wa-green)] opacity-100">No online transactions</p>
        </div>
      </footer>
    </div>
  )
}
