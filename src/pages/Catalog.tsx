import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ChevronRight, Check, SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

const PAGE_SIZE = 20;

interface FilterState {
  subcategory: string;
  priceMin: string;
  priceMax: string;
  discount: string;
  inStock: boolean;
  sort: string;
}

const DEFAULT_FILTERS: FilterState = {
  subcategory: '',
  priceMin: '',
  priceMax: '',
  discount: '',
  inStock: false,
  sort: 'newest',
};

function FilterSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center mb-3 group">
        <span className="text-xs font-black uppercase tracking-widest text-gray-700 group-hover:text-[#FA5600] transition-colors">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && children}
    </div>
  );
}

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const searchQuery    = searchParams.get('search') || '';

  const { items, addItem } = useCart();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // ── Paginated product state ───────────────────────────────
  const [products, setProducts]     = useState<any[]>([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState('');

  const [categories, setCategories]             = useState<{ name: string; _id: string }[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<{ name: string; parentId: string }[]>([]);
  const [filters, setFilters]       = useState<FilterState>(DEFAULT_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Track what was last fetched so we know when to reset
  const lastFetchKey = useRef('');

  // ── Fetch categories (once) ───────────────────────────────
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const mains = data
          .filter(c => !c.parentId && c.name)
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        setCategories(mains);
        setAllSubcategories(data.filter(c => c.parentId && c.name));
      })
      .catch(() => {});
  }, []);

  // ── Build API URL for a given page ───────────────────────
  const buildUrl = useCallback((pageNum: number) => {
    const params = new URLSearchParams();
    params.set('withStock', 'true');
    params.set('page', String(pageNum));
    params.set('limit', String(PAGE_SIZE));
    if (categoryFilter) params.set('category', categoryFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    return `/api/products?${params.toString()}`;
  }, [categoryFilter, searchQuery]);

  // ── Initial / reset fetch when category or search changes ─
  useEffect(() => {
    const key = `${categoryFilter}||${searchQuery}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;

    setLoading(true);
    setProducts([]);
    setPage(1);
    setHasMore(false);
    setError('');

    fetch(buildUrl(1))
      .then(r => r.json())
      .then(data => {
        setProducts(data.products ?? []);
        setHasMore(data.hasMore ?? false);
        setTotal(data.total ?? 0);
        setPage(1);
      })
      .catch(() => setError('Failed to load products. Please refresh.'))
      .finally(() => setLoading(false));
  }, [categoryFilter, searchQuery, buildUrl]);

  // ── Load more (append next page) ─────────────────────────
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetch(buildUrl(nextPage))
      .then(r => r.json())
      .then(data => {
        setProducts(prev => [...prev, ...(data.products ?? [])]);
        setHasMore(data.hasMore ?? false);
        setTotal(data.total ?? 0);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, page, buildUrl]);

  // ── Reset subcategory filter when category changes ────────
  useEffect(() => {
    setFilters(f => ({ ...f, subcategory: '' }));
  }, [categoryFilter]);

  // ── Subcategories for current main category ───────────────
  const currentCatId = useMemo(() => {
    if (!categoryFilter) return null;
    return categories.find(c => c.name === categoryFilter)?._id || null;
  }, [categoryFilter, categories]);

  const subcategoriesForCurrent = useMemo(() => {
    if (!currentCatId) return [];
    return allSubcategories.filter(s => s.parentId === currentCatId);
  }, [currentCatId, allSubcategories]);

  // ── Price range from loaded products ─────────────────────
  const priceRange = useMemo(() => {
    const prices = products
      .map(p => parseFloat(p.discountedPrice || p.originalPrice || p.price || 0))
      .filter(n => !isNaN(n) && n > 0);
    if (!prices.length) return { min: 0, max: 5000 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);

  // ── Active filter count ───────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.subcategory)    count++;
    if (filters.priceMin)       count++;
    if (filters.priceMax)       count++;
    if (filters.discount)       count++;
    if (filters.inStock)        count++;
    if (filters.sort !== 'newest') count++;
    return count;
  }, [filters]);

  // ── Client-side filter + sort on loaded products ──────────
  // (category + search are handled server-side; remaining filters apply locally)
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (filters.subcategory) {
      result = result.filter(p =>
        (p.subcategory || p.subCategory || '') === filters.subcategory
      );
    }
    if (filters.priceMin !== '') {
      const min = parseFloat(filters.priceMin);
      result = result.filter(p =>
        parseFloat(p.discountedPrice || p.originalPrice || p.price || 0) >= min
      );
    }
    if (filters.priceMax !== '') {
      const max = parseFloat(filters.priceMax);
      result = result.filter(p =>
        parseFloat(p.discountedPrice || p.originalPrice || p.price || 0) <= max
      );
    }
    if (filters.discount) {
      const minDisc = parseInt(filters.discount);
      result = result.filter(p => {
        if (!p.discountedPrice || !p.originalPrice) return false;
        const disc = Math.round((1 - parseFloat(p.discountedPrice) / parseFloat(p.originalPrice)) * 100);
        return disc >= minDisc;
      });
    }
    if (filters.inStock) {
      result = result.filter(p => !p.stock?.trackInventory || p.stock?.isInStock);
    }

    switch (filters.sort) {
      case 'price_asc':
        result.sort((a, b) =>
          parseFloat(a.discountedPrice || a.originalPrice || a.price || 0) -
          parseFloat(b.discountedPrice || b.originalPrice || b.price || 0)
        );
        break;
      case 'price_desc':
        result.sort((a, b) =>
          parseFloat(b.discountedPrice || b.originalPrice || b.price || 0) -
          parseFloat(a.discountedPrice || a.originalPrice || a.price || 0)
        );
        break;
      case 'discount':
        result.sort((a, b) => {
          const da = a.discountedPrice && a.originalPrice
            ? Math.round((1 - parseFloat(a.discountedPrice) / parseFloat(a.originalPrice)) * 100) : 0;
          const db = b.discountedPrice && b.originalPrice
            ? Math.round((1 - parseFloat(b.discountedPrice) / parseFloat(b.originalPrice)) * 100) : 0;
          return db - da;
        });
        break;
      default:
        result.sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
    }

    return result;
  }, [products, filters]);

  // ── Handlers ──────────────────────────────────────────────
  const handleCategoryClick = (cat: string | null) => {
    if (cat) setSearchParams({ category: cat });
    else setSearchParams({});
  };

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const handleAddItem = (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock?.trackInventory && !product.stock?.isInStock) return;
    addItem(product);
    setAddedIds(prev => new Set(prev).add(product._id));
    setTimeout(() => {
      setAddedIds(prev => { const n = new Set(prev); n.delete(product._id); return n; });
    }, 1500);
  };

  const getItemQuantity = (id: string) => items.find(i => i.product.id === id)?.quantity || 0;

  const formatPrice = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? '0' : num.toLocaleString('en-IN');
  };

  const pageTitle = searchQuery
    ? `Search: "${searchQuery}"`
    : categoryFilter || 'All Products';

  // ── Filter Panel ──────────────────────────────────────────
  const FilterPanel = () => (
    <div className="space-y-0">

      <FilterSection title="Sort By">
        <div className="flex flex-col gap-1">
          {[
            { value: 'newest',     label: '🆕 Newest First' },
            { value: 'price_asc',  label: '💰 Price: Low to High' },
            { value: 'price_desc', label: '💸 Price: High to Low' },
            { value: 'discount',   label: '🏷️ Biggest Discount' },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => setFilter('sort', opt.value as FilterState['sort'])}
              className={cn(
                'text-left text-xs font-semibold px-3 py-2 rounded-lg transition-colors',
                filters.sort === opt.value
                  ? 'bg-[#FA5600] text-white'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-[#FA5600]'
              )}>
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {subcategoriesForCurrent.length > 0 && (
        <FilterSection title="Subcategory">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setFilter('subcategory', '')}
              className={cn(
                'text-left text-xs font-semibold px-3 py-2 rounded-lg transition-colors',
                !filters.subcategory ? 'bg-[#FA5600] text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-[#FA5600]'
              )}>
              All
            </button>
            {subcategoriesForCurrent.map(sub => (
              <button key={sub.name}
                onClick={() => setFilter('subcategory', sub.name)}
                className={cn(
                  'text-left text-xs font-semibold px-3 py-2 rounded-lg transition-colors',
                  filters.subcategory === sub.name
                    ? 'bg-[#FA5600] text-white'
                    : 'text-gray-600 hover:bg-orange-50 hover:text-[#FA5600]'
                )}>
                {sub.name}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title="Price Range">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { label: 'Under ₹100',  min: '',     max: '100'  },
            { label: '₹100–₹300',   min: '100',  max: '300'  },
            { label: '₹300–₹600',   min: '300',  max: '600'  },
            { label: '₹600–₹1000',  min: '600',  max: '1000' },
            { label: 'Above ₹1000', min: '1000', max: ''     },
          ].map(chip => {
            const active = filters.priceMin === chip.min && filters.priceMax === chip.max;
            return (
              <button key={chip.label}
                onClick={() => {
                  setFilter('priceMin', active ? '' : chip.min);
                  setFilter('priceMax', active ? '' : chip.max);
                }}
                className={cn(
                  'text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors',
                  active
                    ? 'bg-[#FA5600] text-white border-[#FA5600]'
                    : 'border-gray-200 text-gray-500 hover:border-[#FA5600] hover:text-[#FA5600]'
                )}>
                {chip.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">Min ₹</label>
            <input
              type="number"
              value={filters.priceMin}
              placeholder={String(priceRange.min)}
              onChange={e => setFilter('priceMin', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-[#FA5600] transition-colors"
            />
          </div>
          <div className="text-gray-300 font-bold text-sm mt-4">–</div>
          <div className="flex-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">Max ₹</label>
            <input
              type="number"
              value={filters.priceMax}
              placeholder={String(priceRange.max)}
              onChange={e => setFilter('priceMax', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-[#FA5600] transition-colors"
            />
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Discount" defaultOpen={false}>
        <div className="flex flex-col gap-1">
          {[
            { value: '',   label: 'Any Discount' },
            { value: '5',  label: '5% or more' },
            { value: '10', label: '10% or more' },
            { value: '20', label: '20% or more' },
            { value: '30', label: '30% or more' },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => setFilter('discount', opt.value)}
              className={cn(
                'text-left text-xs font-semibold px-3 py-2 rounded-lg transition-colors',
                filters.discount === opt.value
                  ? 'bg-[#FA5600] text-white'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-[#FA5600]'
              )}>
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Availability" defaultOpen={false}>
        <button
          onClick={() => setFilter('inStock', !filters.inStock)}
          className={cn(
            'flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg w-full text-left transition-colors',
            filters.inStock ? 'bg-[#FA5600] text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-[#FA5600]'
          )}>
          <span className={cn(
            'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
            filters.inStock ? 'bg-white border-white' : 'border-gray-300'
          )}>
            {filters.inStock && <Check className="w-2.5 h-2.5 text-[#FA5600]" />}
          </span>
          In Stock Only
        </button>
      </FilterSection>

      {activeFilterCount > 0 && (
        <button
          onClick={resetFilters}
          className="w-full mt-2 border-2 border-dashed border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 rounded-lg py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5">
          <X className="w-3 h-3" /> Reset All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-32 space-y-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-xs font-black uppercase tracking-widest mb-3 border-b border-gray-100 pb-2 text-gray-500">Categories</h3>
              <ul className="flex flex-col gap-1">
                <li>
                  <button onClick={() => handleCategoryClick(null)}
                    className={cn('w-full text-left px-3 py-2 rounded-lg font-bold text-xs tracking-widest transition-colors',
                      !categoryFilter ? 'bg-[#FA5600] text-white' : 'text-gray-700 hover:bg-orange-50 hover:text-[#FA5600]')}>
                    All Products
                  </button>
                </li>
                {categories.map(cat => (
                  <li key={cat._id}>
                    <button onClick={() => handleCategoryClick(cat.name)}
                      className={cn('w-full text-left px-3 py-2 rounded-lg font-bold text-xs tracking-widest transition-colors flex justify-between items-center',
                        categoryFilter === cat.name ? 'bg-[#FA5600] text-white' : 'text-gray-700 hover:bg-orange-50 hover:text-[#FA5600]')}>
                      {cat.name}
                      {categoryFilter === cat.name && <ChevronRight className="w-3 h-3" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="bg-[#FA5600] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <FilterPanel />
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">

          {/* Top bar */}
          <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter leading-none">{pageTitle}</h1>
              {categoryFilter && subcategoriesForCurrent.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    onClick={() => setFilter('subcategory', '')}
                    className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors',
                      !filters.subcategory ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-[#FA5600] hover:text-[#FA5600]')}>
                    All
                  </button>
                  {subcategoriesForCurrent.map(sub => (
                    <button key={sub.name}
                      onClick={() => setFilter('subcategory', sub.name)}
                      className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors',
                        filters.subcategory === sub.name ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-[#FA5600] hover:text-[#FA5600]')}>
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Show loaded count vs total */}
              <span className="text-gray-400 font-bold text-xs tracking-widest">
                {loading ? '...' : `${filteredProducts.length} of ${total}`}
              </span>

              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 hover:border-[#FA5600] hover:text-[#FA5600] transition-colors shadow-sm">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-[#FA5600] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
                )}
              </button>

              <div className="hidden lg:flex flex-col items-end gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sort By</span>
                <select
                  value={filters.sort}
                  onChange={e => setFilter('sort', e.target.value as FilterState['sort'])}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#FA5600] transition-colors cursor-pointer bg-white">
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                  <option value="discount">Top Discount</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.subcategory && (
                <span className="flex items-center gap-1 bg-orange-50 text-[#FA5600] border border-orange-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {filters.subcategory}
                  <button onClick={() => setFilter('subcategory', '')} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              )}
              {(filters.priceMin || filters.priceMax) && (
                <span className="flex items-center gap-1 bg-orange-50 text-[#FA5600] border border-orange-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  ₹{filters.priceMin || '0'} – ₹{filters.priceMax || '∞'}
                  <button onClick={() => { setFilter('priceMin', ''); setFilter('priceMax', ''); }} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filters.discount && (
                <span className="flex items-center gap-1 bg-orange-50 text-[#FA5600] border border-orange-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {filters.discount}%+ off
                  <button onClick={() => setFilter('discount', '')} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filters.inStock && (
                <span className="flex items-center gap-1 bg-orange-50 text-[#FA5600] border border-orange-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  In Stock
                  <button onClick={() => setFilter('inStock', false)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filters.sort !== 'newest' && (
                <span className="flex items-center gap-1 bg-orange-50 text-[#FA5600] border border-orange-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {{ price_asc: 'Price ↑', price_desc: 'Price ↓', discount: 'Top Discount' }[filters.sort] || ''}
                  <button onClick={() => setFilter('sort', 'newest')} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              )}
              <button onClick={resetFilters}
                className="text-[10px] font-bold text-red-400 hover:text-red-600 px-2 py-1 transition-colors">
                Clear all
              </button>
            </div>
          )}

          {/* Search notice */}
          {searchQuery && (
            <div className="mb-4 flex items-center gap-3">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-gray-900">{total}</span> results for{' '}
                <span className="font-bold text-[#FA5600]">"{searchQuery}"</span>
              </p>
              <button onClick={() => setSearchParams({})}
                className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 px-2 py-1 rounded-full transition-colors">
                ✕ Clear
              </button>
            </div>
          )}

          {/* Mobile category pills */}
          <div className="flex lg:hidden gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
            <button onClick={() => handleCategoryClick(null)}
              className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                !categoryFilter ? 'bg-[#FA5600] text-white' : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-[#FA5600]')}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat._id} onClick={() => handleCategoryClick(cat.name)}
                className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                  categoryFilter === cat.name ? 'bg-[#FA5600] text-white' : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-[#FA5600]')}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* ── PRODUCT GRID ── */}
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
              <p className="text-gray-400 text-xs mb-4">Try adjusting your filters or search terms</p>
              <button onClick={() => { resetFilters(); if (searchQuery) setSearchParams({}); }}
                className="text-[#FA5600] font-bold text-sm hover:underline">
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                  const id = product._id?.toString() || product.id;
                  const isRecentlyAdded = addedIds.has(id);
                  const quantityInCart  = getItemQuantity(id);
                  const hasDiscount     = product.discountedPrice && parseFloat(product.discountedPrice) > 0;
                  const displayPrice    = hasDiscount ? parseFloat(product.discountedPrice) : parseFloat(product.price || product.originalPrice || 0);
                  const originalPrice   = parseFloat(product.originalPrice || product.price || 0);
                  const discountPct     = hasDiscount ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;
                  const isTracked       = product.stock?.trackInventory;
                  const isOutOfStock    = isTracked && !product.stock?.isInStock;
                  const isLowStock      = product.stock?.isLowStock;
                  const availableStock  = product.stock?.availableStock;
                  const productImage    = product.imageUrls?.[0] || product.imageUrl || product.image || null;

                  return (
                    <div key={id}
                      className={cn('bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden group flex flex-col',
                        isOutOfStock && 'opacity-80')}>
                      <Link to={`/products/${id}`} className="block relative">
                        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                          {productImage ? (
                            <img src={productImage} alt={product.name}
                              className={cn('w-full h-full object-cover group-hover:scale-105 transition-transform duration-300',
                                isOutOfStock && 'grayscale')} />
                          ) : (
                            <div className="text-5xl text-gray-200">📦</div>
                          )}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="bg-white text-gray-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow">
                                Out of Stock
                              </span>
                            </div>
                          )}
                        </div>
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
                            onClick={e => handleAddItem(e, { ...product, id })}
                            disabled={isRecentlyAdded || isOutOfStock}
                            className={cn(
                              'w-full py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all',
                              isOutOfStock    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : isRecentlyAdded ? 'bg-green-500 text-white'
                              : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'
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

              {/* ── LOAD MORE ── */}
              {hasMore && (
                <div className="mt-10 flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Showing {products.length} of {total} products
                  </p>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 bg-[#FA5600] hover:bg-[#E04A00] disabled:bg-gray-300 text-white font-black uppercase text-sm tracking-widest py-3 px-10 rounded-full shadow-lg transition-all">
                    {loadingMore ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Load More (${total - products.length} remaining)`
                    )}
                  </button>
                </div>
              )}

              {/* End of results notice */}
              {!hasMore && products.length > 0 && products.length >= PAGE_SIZE && (
                <p className="mt-8 text-center text-xs text-gray-300 font-bold uppercase tracking-widest">
                  — All {total} products loaded —
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MOBILE FILTER DRAWER ── */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#FA5600]" />
                <h2 className="font-black text-sm uppercase tracking-widest">Filters & Sort</h2>
                {activeFilterCount > 0 && (
                  <span className="bg-[#FA5600] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
                )}
              </div>
              <button onClick={() => setMobileFiltersOpen(false)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <FilterPanel />
            </div>
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full bg-[#FA5600] text-white font-black py-3.5 rounded-xl text-sm uppercase tracking-widest hover:bg-[#E04A00] transition-colors">
                Show {filteredProducts.length} Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Catalog;
