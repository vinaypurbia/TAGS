import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ShoppingBag, ChevronRight, Check } from 'lucide-react';
import { cn } from '../lib/utils';

const CATEGORIES = ['Electronics', 'Automotive', 'Travel Gear', 'Toys'];

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const { items, addItem } = useCart();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        setError('Failed to load products. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!categoryFilter) return products;
    return products.filter(p => p.category === categoryFilter);
  }, [categoryFilter, products]);

  const handleCategoryClick = (cat: string | null) => {
    if (cat) setSearchParams({ category: cat });
    else setSearchParams({});
  };

  const handleAddItem = (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    setAddedIds(prev => new Set(prev).add(product._id));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(product._id);
        return next;
      });
    }, 1500);
  };

  const getItemQuantity = (id: string) => {
    return items.find(i => i.product.id === id)?.quantity || 0;
  };

  return (
    <div className="p-8">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        <aside className="w-full lg:w-48 shrink-0">
          <div className="sticky top-32 bg-white/50 border-r-0 lg:border-r-4 lg:border-black pr-0 lg:pr-6 pb-6 lg:pb-0">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 border-b-2 border-black pb-2 text-black">Categories</h3>
            <ul className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
              <li>
                <button onClick={() => handleCategoryClick(null)}
                  className={cn("w-full text-left px-4 py-2 border-2 border-black font-bold uppercase text-[10px] tracking-widest whitespace-nowrap transition-colors",
                    !categoryFilter ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100")}>
                  All Products
                </button>
              </li>
              {CATEGORIES.map(cat => (
                <li key={cat}>
                  <button onClick={() => handleCategoryClick(cat)}
                    className={cn("w-full text-left px-4 py-2 border-2 border-black font-bold uppercase text-[10px] tracking-widest whitespace-nowrap transition-colors flex justify-between items-center group",
                      categoryFilter === cat ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100")}>
                    {cat}
                    {categoryFilter === cat && <ChevronRight className="w-3 h-3 text-white" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex-1">
          <div className="flex justify-between items-end mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none uppercase">
              {categoryFilter ? categoryFilter : 'Explore Equip'}
            </h1>
            <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">{filteredProducts.length} items</span>
          </div>

          {loading ? (
            <div className="text-center p-12">
              <p className="text-black font-black uppercase tracking-widest text-sm animate-pulse">Loading products...</p>
            </div>
          ) : error ? (
            <div className="text-center p-12 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-red-600 font-bold">{error}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 border-2 border-dashed border-black">
              <p className="text-black font-black uppercase tracking-widest text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(product => {
                const id = product._id?.toString() || product.id;
                const isRecentlyAdded = addedIds.has(id);
                const quantityInCart = getItemQuantity(id);

                return (
                  <div key={id} className="bg-white border-2 border-black p-4 card-hover relative group flex flex-col">
                    <Link to={`/products/${id}`} className="block relative focus:outline-none focus:ring-4 focus:ring-[var(--color-wa-green)]">
                      <div className="aspect-square bg-slate-100 mb-4 flex items-center justify-center p-4 border border-black/10 group-hover:border-black transition-colors overflow-hidden">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="text-6xl text-gray-200">📦</div>
                        )}
                        <div className="absolute top-2 right-2 bg-black text-white px-2 py-1 text-[8px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          {product.category}
                        </div>
                      </div>
                      <div className="mb-4">
                        <h3 className="font-black uppercase text-lg leading-tight mb-2 group-hover:text-[var(--color-wa-green)] transition-colors line-clamp-1">{product.name}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase line-clamp-2">{product.description}</p>
                      </div>
                    </Link>
                    <div className="mt-auto flex justify-between items-center border-t-2 border-black pt-4">
                      <div>
                        {product.discountedPrice ? (
                          <div>
                            <span className="text-xl font-black">${product.discountedPrice.toFixed(2)}</span>
                            <span className="text-xs text-gray-400 line-through ml-2">${product.originalPrice.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-xl font-black">${product.price?.toFixed(2)}</span>
                        )}
                      </div>
                      <button onClick={(e) => handleAddItem(e, { ...product, id })} disabled={isRecentlyAdded}
                        className={cn("font-bold p-2 px-4 uppercase text-[10px] tracking-widest border-2 transition-all",
                          isRecentlyAdded ? "bg-black text-white border-black" : "bg-[var(--color-wa-green)] text-white border-[var(--color-wa-green)] hover:bg-[#20bd5a]")}>
                        {isRecentlyAdded ? (
                          <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Added</span>
                        ) : (
                          <span className="flex items-center gap-1">+ Add {quantityInCart > 0 && `(${quantityInCart})`}</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
