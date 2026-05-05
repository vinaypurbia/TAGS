import { useParams, Link, useNavigate } from 'react-router-dom';
import { PRODUCTS } from '../data/products';
import { useCart } from '../context/CartContext';
import { useState } from 'react';
import { ArrowLeft, ShoppingBag, Check, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = PRODUCTS.find(p => p.id === id);
  const { items, addItem } = useCart();
  const [isRecentlyAdded, setIsRecentlyAdded] = useState(false);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Product Not Found</h2>
        <p className="text-gray-500 mb-8">We couldn't find the product you're looking for.</p>
        <button onClick={() => navigate('/products')} className="inline-flex items-center justify-center bg-[#25D366] text-white font-bold py-3 px-8 rounded-full shadow-md hover:bg-green-600 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Catalog
        </button>
      </div>
    );
  }

  const handleAddItem = () => {
    addItem(product);
    setIsRecentlyAdded(true);
    setTimeout(() => {
      setIsRecentlyAdded(false);
    }, 1500);
  };

  const quantityInCart = items.find(i => i.product.id === product.id)?.quantity || 0;

  return (
    <div className="p-8">
      <Link to="/products" className="inline-flex items-center text-xs font-bold uppercase tracking-widest hover:text-[var(--color-wa-green)] transition-colors mb-8 text-slate-500 border-b-2 border-transparent hover:border-[var(--color-wa-green)] pb-1">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Catalog
      </Link>
      
      <div className="bg-white border-2 border-black max-w-5xl mx-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="grid grid-cols-1 md:grid-cols-2">
          
          {/* Image Gallery (Placeholder for simplicity) */}
          <div className="overflow-hidden bg-slate-50 border-b-2 md:border-b-0 md:border-r-2 border-black">
            <img 
              src={product.image} 
              alt={product.name} 
              className="w-full h-full object-cover mix-blend-multiply aspect-square" 
            />
          </div>
          
          {/* Product Details */}
          <div className="flex flex-col justify-center p-8 lg:p-12">
            <div className="inline-flex px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest w-max mb-6">
              {product.category}
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-black text-black tracking-tighter mb-4 leading-none uppercase">
              {product.name}
            </h1>
            
            <div className="text-3xl font-black text-black mb-8 pb-4 border-b-4 border-black inline-block w-max">
              ${product.price.toFixed(2)}
            </div>
            
            <p className="text-slate-600 text-sm font-bold uppercase tracking-wide leading-relaxed mb-8">
              {product.description}
            </p>
            
            {product.specs && product.specs.length > 0 && (
              <div className="mb-10 text-sm">
                <h3 className="font-black uppercase tracking-widest text-[#075E54] mb-4 border-b-2 border-[#075E54] pb-2 inline-block">Specifications</h3>
                <ul className="space-y-3">
                  {product.specs.map((spec, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-[var(--color-wa-green)] mr-3 shrink-0" />
                      <span className="font-bold uppercase tracking-wider text-slate-700">{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-auto space-y-4 pt-8">
               <button 
                  onClick={handleAddItem}
                  disabled={isRecentlyAdded}
                  className={cn(
                    "w-full py-5 px-6 font-black uppercase tracking-tighter flex items-center justify-center gap-2 transition-all text-sm border-2",
                    isRecentlyAdded 
                      ? "bg-slate-100 text-black border-black/20" 
                      : "bg-[var(--color-wa-green)] hover:bg-[#20bd5a] text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none"
                  )}
                >
                  {isRecentlyAdded ? (
                    <><Check className="w-5 h-5"/> Added to List!</>
                  ) : (
                    <><ShoppingBag className="w-5 h-5"/> Add to Order List {quantityInCart > 0 && `(${quantityInCart})`}</>
                  )}
                </button>
                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Order via WhatsApp / No checkout required
                </p>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
