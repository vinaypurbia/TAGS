import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const searchQuery = searchParams.get('search') || '';
  const { items, addItem } = useCart();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mainCats = data
            .filter((c: any) => !c.parentId && c.name)
            .sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
            .map((c: any) => c.name);
          setCategories(mainCats);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fetch products with stock info
    fetch('/api/products?withStock=true')
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load products. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (categoryFilter) result = result.filter(p => p.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.subCategory?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [categoryFilter, searchQuery, products]);

  const handleCategoryClick = (cat: string | null) => {
    if (cat) setSearchParams({ category: cat });
    else setSearchParams({});
  };

  const handleAddItem = (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't add if out of stock
    if (product.stock?.trackInventory && !product.stock?.isInStock) return;
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

  const formatPrice = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const pageTitle = searchQuery
    ? `Search: "${searchQuery}"`
    : categoryFilter
    ? categoryFilter
    : 'All Products';

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">

        {/* Sidebar */}
        <aside className="w-full lg:w-44 shrink-0">
          <div className="sticky top-32 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-2 text-gray-500">Categories</h3>
            <ul className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
              <li>
                <button onClick={() => handleCategoryClick(null)}
                  className={cn("w-full text-left px-3 py-2 rounded-lg font-bold text-xs tracking-widest whitespace-nowrap transition-colors",
                    !categoryFilter ? "bg-[#FA5600] text-white" : "bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-[#FA5600]")}>
                  All Products
                </button>
              </li>
              {categories.map(cat => (
                <li key={cat}>
                  <button onClick={() => handleCategoryClick(cat)}
                    className={cn("w-full text-left px-3 py-2 rounded-lg font-bold text-xs tracking-widest whitespace-nowrap transition-colors flex justify-between items-center",
                      categoryFilter === cat ? "bg-[#FA5600] text-white" : "bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-[#FA5600]")}>
                    {cat}
                    {categoryFilter === cat && <ChevronRight className="w-3 h-3" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          <div className="flex justify-between items-end mb-6">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter leading-none">{pageTitle}</h1>
            <span className="text-gray-400 font-bold text-xs tracking-widest">{filteredProducts.length} items</span>
          </div>

          {/* Search notice */}
          {searchQuery && (
            <div className="mb-4 flex items-center gap-3">
              <p className="text-sm text-gray-500">
                Showing <span className="font-bold text-gray-900">{filteredProducts.length}</span> results for <span className="font-bold text-[#FA5600]">"{searchQuery}"</span>
              </p>
              <button onClick={() => setSearchParams({})}
                className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 px-2 py-1 rounded-full transition-colors">
                ✕ Clear
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-3 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
                  <div className="h-3 bg-gray-200 rounded mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center p-12 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 font-bold">{error}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-xl border border-gray-200">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm mb-2">No products found</p>
              {searchQuery && (
                <button onClick={() => setSearchParams({})} className="text-[#FA5600] font-bold text-sm hover:underline">
                  Clear search and view all products
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const id = product._id?.toString() || product.id;
                const isRecentlyAdded = addedIds.has(id);
                const quantityInCart = getItemQuantity(id);
                const hasDiscount = product.discountedPrice && parseFloat(product.discountedPrice) > 0;
                const displayPrice = hasDiscount ? parseFloat(product.discountedPrice) : parseFloat(product.price || product.originalPrice || 0);
                const originalPrice = parseFloat(product.originalPrice || product.price || 0);
                const discountPct = hasDiscount ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;

                // Stock status
                const isTracked = product.stock?.trackInventory;
                const isOutOfStock = isTracked && !product.stock?.isInStock;
                const isLowStock = product.stock?.isLowStock;
                const availableStock = product.stock?.availableStock;

                return (
                  <div key={id} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden group flex flex-col ${isOutOfStock ? 'opacity-80' : ''}`}>
                    <Link to={`/products/${id}`} className="block relative">
                      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                        {product.image ? (
                          <img src={product.image} alt={product.name}
                            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isOutOfStock ? 'grayscale' : ''}`} />
                        ) : (
                          <div className="text-5xl text-gray-200">📦</div>
                        )}

                        {/* Out of stock overlay */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="bg-white text-gray-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow">
                              Out of Stock
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {hasDiscount && discountPct > 0 && !isOutOfStock && (
                          <div className="bg-[#E53935] text-white text-[9px] font-black px-2 py-0.5 rounded">
                            -{discountPct}%
                          </div>
                        )}
                        {isLowStock && !isOutOfStock && (
                          <div className="bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-0.5 rounded">
                            Only {availableStock} left!
                          </div>
                        )}
                      </div>

                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
                        {product.category}
                      </div>
                    </Link>

                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-bold text-sm leading-tight mb-1 line-clamp-2 text-gray-900 group-hover:text-[#FA5600] transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-gray-400 line-clamp-1 mb-2">{product.description}</p>

                      <div className="mt-auto">
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-lg font-black text-[#E53935]">₹{formatPrice(displayPrice)}</span>
                          {hasDiscount && (
                            <span className="text-xs text-gray-400 line-through">₹{formatPrice(originalPrice)}</span>
                          )}
                        </div>

                        <button
                          onClick={(e) => handleAddItem(e, { ...product, id })}
                          disabled={isRecentlyAdded || isOutOfStock}
                          className={cn(
                            "w-full py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                            isOutOfStock
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : isRecentlyAdded
                              ? "bg-green-500 text-white"
                              : "bg-[#FA5600] text-white hover:bg-[#E04A00]"
                          )}>
                          {isOutOfStock ? 'Out of Stock' : isRecentlyAdded ? (
                            <span className="flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Added</span>
                          ) : (
                            <span>+ Add {quantityInCart > 0 && `(${quantityInCart})`}</span>
                          )}
                        </button>
                      </div>
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
