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

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
    // The 'as any' fix prevents the Type Error seen in image_f28da6.png
    return items.find(i => (i.product as any).id === id || (i.product as any)._id === id)?.quantity || 0;
  };

  return (
    <div className="p-8">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-48 shrink-0">
          <div className="sticky top-32 bg-white/50 border-r-0 lg:border-r-4 lg:border-black pr-0 lg:pr-6 pb-6 lg:pb-0">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 border-b-2 border-black pb-2 text-black">Categories</h3>
            <ul className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
              <li>
                <button
                  onClick={() => handleCategoryClick(null)}
                  className={cn(
                    "w-full text-left px-4 py-2 border-2 border-black font-bold uppercase text-[10px] tracking-widest whitespace-nowrap transition-colors",
                    !categoryFilter ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100"
                  )}
                >
                  All Products
                </button>
              </li>
              {CATEGORIES.map(cat => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat)}
                    className={cn(
                      "w-full text-left px-4 py-2 border-2 border-black font-bold uppercase text-[10px] tracking-widest whitespace-nowrap transition-colors flex justify-between items-center group",
                      categoryFilter === cat ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100"
                    )}
                  >
                    {cat}
                    {categoryFilter === cat && <ChevronRight className="w-3 h-3 text-white" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          <div className="flex justify-between items-end mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none uppercase">
              {categoryFilter ? categoryFilter : 'Explore Equip'}
            </h1>
            <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">{filteredProducts.length} items</span>
          </div>

          {loading ? (
            <div className="text-center p-12">
              <p className="text-black font-black uppercase tracking-widest text-sm">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 border-2 border-dashed border-black">
              <p className="text-black font-black uppercase tracking-widest text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(product => {
                const isRecentlyAdded = addedIds.has(product._id);
                const quantityInCart = getItemQuantity(product._id);

                return (
                  <div key={product._id} className="bg-white border-2 border-black p-4 card-hover relative group flex flex-col">
                    <Link to={`/products/${product._id}`} className="block relative focus:outline-none focus:ring-4 focus:ring-green-500">
                      <div className="aspect-square bg-slate-100 mb-4 flex items-center justify-center p-4 border border-black/10 group-hover:border-black transition-colors overflow-hidden">
                        <img
                          src={product.imageUrl || 'https://placehold.co/400x400?text=No+Image'}
                          alt={product.name}
                          className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 right-2 bg-black text-white px-2 py-1 text-[8px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          {product.category}
                        </div>
                      </div>

                      <div className="mb-4">
                        <h3 className="font-black uppercase text-lg leading-tight mb-2 group-hover:text-green-600 transition-colors line-clamp-1">{product.name}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase line-clamp-2">{product.description}</p>
                      </div>
                    </Link>

                    <div className="mt-auto flex justify-between items-center border-t-2 border-black pt-4">
                      <div>
                        {product.discountedPrice ? (
                          <>
                            <span className="text-xl font-black">${Number(product.discountedPrice).toFixed(2)}</span>
                            <span className="text-sm text-slate-400 line-through ml-2">${Number(product.originalPrice).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-xl font-black">${Number(product.originalPrice).toFixed(2)}</span>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleAddItem(e, product)}
                        className={cn(
                          "p-2 border-2 border-black transition-all relative overflow-hidden",
                          isRecentlyAdded ? "bg-green-500 text-white" : "bg-black text-white hover:bg-slate-800"
                        )}
                      >
                        {isRecentlyAdded ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <div className="relative">
                            <ShoppingBag className="w-5 h-5" />
                            {quantityInCart > 0 && (
                              <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                {quantityInCart}
                              </span>
                            )}
                          </div>
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

export default Catalog;
