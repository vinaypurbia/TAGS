import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle, XCircle, Search, ChevronDown, ChevronUp, Save, Plus, Minus } from 'lucide-react';

interface StockData {
  sku: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockAlert: number;
  costPrice: number;
  unit: string;
  trackInventory: boolean;
  isInStock: boolean;
  isLowStock: boolean;
  adjustmentLog: { adjustment: number; reason: string; date: string; stockAfter: number }[];
  updatedAt?: string;
}

interface ProductInventory {
  _id: string;
  name: string;
  category: string;
  subCategory?: string;
  price: number;
  originalPrice: number;
  discountedPrice?: number;
  image?: string;
  stock: StockData;
}

type FilterType = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock' | 'untracked';

export function InventoryEmbed() {
  const [products, setProducts] = useState<ProductInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, Partial<StockData>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [adjustmentValues, setAdjustmentValues] = useState<Record<string, string>>({});
  const [adjustmentReasons, setAdjustmentReasons] = useState<Record<string, string>>({});
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [bulkToggling, setBulkToggling] = useState(false);
  const [quickToggling, setQuickToggling] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingScope, setPricingScope] = useState<'all' | 'category' | 'range' | 'individual' | 'po'>('all');
  const [pricingPOs, setPricingPOs] = useState<any[]>([]);
  const [pricingPOsLoading, setPricingPOsLoading] = useState(false);
  const [pricingSelectedPOId, setPricingSelectedPOId] = useState('');
  const [pricingCategories, setPricingCategories] = useState<Set<string>>(new Set());
  const [pricingRangeField, setPricingRangeField] = useState<'cost' | 'selling'>('cost');
  const [pricingRangeMin, setPricingRangeMin] = useState('');
  const [pricingRangeMax, setPricingRangeMax] = useState('');
  const [pricingSelectedIds, setPricingSelectedIds] = useState<Set<string>>(new Set());
  const [pricingIndividualSearch, setPricingIndividualSearch] = useState('');
  const [originalPercent, setOriginalPercent] = useState('30');
  const [discountedPercent, setDiscountedPercent] = useState('');
  const [pricingPreview, setPricingPreview] = useState<{ items: any[]; skipped: any[] } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingApplying, setPricingApplying] = useState(false);

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      showMessage('Failed to load inventory.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInventory(); }, []);

  const showMessage = (text: string, type: string) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const getEdit = (id: string, product: ProductInventory) => {
    return editData[id] || {
      sku: product.stock.sku,
      currentStock: product.stock.currentStock,
      reservedStock: product.stock.reservedStock,
      lowStockAlert: product.stock.lowStockAlert,
      costPrice: product.stock.costPrice,
      unit: product.stock.unit,
      trackInventory: product.stock.trackInventory,
    };
  };

  const updateEdit = (id: string, field: string, value: any) => {
    setEditData(prev => ({ ...prev, [id]: { ...getEdit(id, products.find(p => p._id === id)!), [field]: value } }));
  };

  const handleSave = async (product: ProductInventory) => {
    setSaving(product._id);
    const data = getEdit(product._id, product);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product._id, ...data }),
      });
      if (!res.ok) throw new Error();
      setSaved(product._id);
      setTimeout(() => setSaved(null), 2500);
      showMessage(`✅ ${product.name} inventory saved!`, 'success');
      fetchInventory();
    } catch {
      showMessage('Failed to save. Please try again.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteAdjustment = async (product: ProductInventory, logIndex: number) => {
    if (!confirm('Delete this adjustment entry?')) return;
    // logIndex is from the reversed display — convert back to original array index
    const originalIndex = product.stock.adjustmentLog.length - 1 - logIndex;
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product._id, action: 'deleteAdjustment', index: originalIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showMessage('Adjustment entry deleted.', 'success');
      fetchInventory();
    } catch (err: any) {
      showMessage(err.message || 'Failed to delete.', 'error');
    }
  };

  const handleAdjustment = async (product: ProductInventory, type: 'add' | 'subtract') => {
    const val = parseInt(adjustmentValues[product._id] || '0');
    if (!val || val <= 0) { showMessage('Enter a valid quantity.', 'error'); return; }
    const adjustment = type === 'add' ? val : -val;
    const reason = adjustmentReasons[product._id] || 'Manual adjustment';

    setAdjusting(product._id);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product._id, adjustment, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showMessage(`✅ Stock ${type === 'add' ? 'added' : 'removed'}: ${val} ${product.stock.unit || 'pcs'}`, 'success');
      setAdjustmentValues(prev => ({ ...prev, [product._id]: '' }));
      setAdjustmentReasons(prev => ({ ...prev, [product._id]: '' }));
      fetchInventory();
    } catch (err: any) {
      showMessage(err.message || 'Adjustment failed.', 'error');
    } finally {
      setAdjusting(null);
    }
  };

  // Bulk enable/disable tracking on currently filtered products
  const bulkToggleTracking = async (enable: boolean) => {
    const targets = filtered.filter(p => p.stock.trackInventory !== enable);
    if (targets.length === 0) {
      showMessage(`All visible products already have tracking ${enable ? 'enabled' : 'disabled'}.`, 'error');
      return;
    }
    if (!confirm(`${enable ? 'Enable' : 'Disable'} tracking for ${targets.length} product(s)?`)) return;
    setBulkToggling(true);
    try {
      await Promise.all(targets.map(p =>
        fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: p._id,
            sku: p.stock.sku || '',
            currentStock: p.stock.currentStock || 0,
            reservedStock: p.stock.reservedStock || 0,
            lowStockAlert: p.stock.lowStockAlert || 5,
            costPrice: p.stock.costPrice || 0,
            unit: p.stock.unit || 'pcs',
            trackInventory: enable,
          }),
        })
      ));
      showMessage(`✅ Tracking ${enable ? 'enabled' : 'disabled'} for ${targets.length} product(s).`, 'success');
      fetchInventory();
    } catch {
      showMessage('Bulk update failed. Please try again.', 'error');
    } finally {
      setBulkToggling(false);
    }
  };

  // Quick toggle tracking for a single product from the row (no expand needed)
  const quickToggleTracking = async (product: ProductInventory) => {
    setQuickToggling(product._id);
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product._id,
          sku: product.stock.sku || '',
          currentStock: product.stock.currentStock || 0,
          reservedStock: product.stock.reservedStock || 0,
          lowStockAlert: product.stock.lowStockAlert || 5,
          costPrice: product.stock.costPrice || 0,
          unit: product.stock.unit || 'pcs',
          trackInventory: !product.stock.trackInventory,
        }),
      });
      showMessage(`✅ Tracking ${!product.stock.trackInventory ? 'enabled' : 'disabled'} for ${product.name}.`, 'success');
      fetchInventory();
    } catch {
      showMessage('Failed to toggle tracking.', 'error');
    } finally {
      setQuickToggling(null);
    }
  };

  // Backfill inventory from past delivered orders
  const backfillDelivered = async () => {
    if (!confirm('This will deduct quantities from all past delivered orders that have not been deducted yet. Continue?')) return;
    setBackfilling(true);
    try {
      const res = await fetch('/api/inventory?action=backfillDelivered');
      const data = await res.json();
      if (data.success) {
        showMessage(`✅ ${data.message}`, 'success');
        fetchInventory();
      } else {
        showMessage('Backfill failed.', 'error');
      }
    } catch {
      showMessage('Backfill failed. Please try again.', 'error');
    } finally {
      setBackfilling(false);
    }
  };

  // Bulk pricing: preview new original/discounted prices as cost price + markup %,
  // for whatever the current scope resolves to — nothing is saved yet.
  const previewBulkPricing = async () => {
    const origPct = originalPercent.trim() === '' ? null : Number(originalPercent);
    const discPct = discountedPercent.trim() === '' ? null : Number(discountedPercent);
    if (origPct === null && discPct === null) { showMessage('Enter at least one markup percentage.', 'error'); return; }
    if (origPct !== null && !Number.isFinite(origPct)) { showMessage('Original price markup % is invalid.', 'error'); return; }
    if (discPct !== null && !Number.isFinite(discPct)) { showMessage('Discounted price markup % is invalid.', 'error'); return; }

    const targets = pricingScopeTargets;
    if (targets.length === 0) { showMessage('No products match the selected scope.', 'error'); return; }

    setPricingLoading(true);
    setPricingPreview(null);
    try {
      const res = await fetch('/api/products?bulkPricingPreview=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalPercent: origPct, discountedPercent: discPct, ids: targets.map(p => p._id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPricingPreview({ items: data.items || [], skipped: data.skipped || [] });
    } catch (err: any) {
      showMessage(err.message || 'Failed to calculate prices.', 'error');
    } finally {
      setPricingLoading(false);
    }
  };

  // Apply exactly what was previewed — doesn't recompute, so what you saw is what gets saved.
  const applyBulkPricing = async () => {
    if (!pricingPreview || pricingPreview.items.length === 0) return;
    if (!confirm(`Update pricing for ${pricingPreview.items.length} product(s)? This cannot be undone automatically.`)) return;
    setPricingApplying(true);
    try {
      const res = await fetch('/api/products?bulkPricingApply=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: pricingPreview.items.map((it: any) => ({
            id: it._id,
            newOriginalPrice: it.newOriginalPrice,
            newDiscountedPrice: it.newDiscountedPrice,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const metaFailCount = data.metaErrors?.length || 0;
      if (metaFailCount > 0) {
        showMessage(`✅ Updated ${data.updatedCount} product(s). ⚠️ ${metaFailCount} failed to sync to WhatsApp/Facebook — DB price is correct, catalog may lag until next sync.`, 'error');
      } else {
        showMessage(`✅ Updated pricing for ${data.updatedCount} product(s) — synced to WhatsApp/Facebook catalog too.`, 'success');
      }
      setPricingPreview(null);
      setPricingOpen(false);
      setPricingSelectedIds(new Set());
      fetchInventory();
    } catch (err: any) {
      showMessage(err.message || 'Failed to apply prices.', 'error');
    } finally {
      setPricingApplying(false);
    }
  };


  // Stats
  const stats = {
    total: products.length,
    inStock: products.filter(p => p.stock.trackInventory && p.stock.isInStock).length,
    outOfStock: products.filter(p => p.stock.trackInventory && !p.stock.isInStock).length,
    lowStock: products.filter(p => p.stock.isLowStock).length,
    untracked: products.filter(p => !p.stock.trackInventory).length,
  };

  const filtered = products.filter(p => {
    const matchSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.stock.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchFilter =
      filter === 'all' ? true :
      filter === 'in_stock' ? (p.stock.trackInventory && p.stock.isInStock) :
      filter === 'out_of_stock' ? (p.stock.trackInventory && !p.stock.isInStock) :
      filter === 'low_stock' ? p.stock.isLowStock :
      filter === 'untracked' ? !p.stock.trackInventory : true;

    return matchSearch && matchFilter;
  });

  // Categories available for the "By Category" pricing scope — derived from
  // the currently searched/filtered list, so it stays relevant to what's on screen.
  const pricingAvailableCategories = Array.from(new Set(filtered.map(p => p.category).filter(Boolean))).sort();

  // Lazily loads received POs the first time the "By Purchase Order" scope is
  // opened. Only "received" POs matter here — a draft/ordered PO's items
  // haven't actually landed in inventory yet, so there's nothing real to price.
  const fetchPricingPOs = async () => {
    if (pricingPOs.length > 0 || pricingPOsLoading) return;
    setPricingPOsLoading(true);
    try {
      const res = await fetch('/api/purchase-orders');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.purchaseOrders || data.data || []);
      setPricingPOs(list.filter((po: any) => po.status === 'received'));
    } catch {
      showMessage('Could not load purchase orders.', 'error');
    } finally {
      setPricingPOsLoading(false);
    }
  };

  const selectedPO = pricingPOs.find(po => po._id === pricingSelectedPOId);
  // PO item productIds resolved against the current PO — used below to find
  // matching products in the full (unfiltered) list.
  const selectedPOProductIds = new Set((selectedPO?.receivedItems || selectedPO?.items || []).map((i: any) => i.productId).filter(Boolean));

  // Resolve the Bulk Price Update scope down to a plain product list, on top
  // of the existing search/filter above. "All Items" = everything currently
  // visible; category/range/individual narrow further from there. "By PO"
  // is resolved against the FULL product list (not the filtered/searched
  // one) — an active search or category tab in Stock Levels shouldn't
  // silently exclude items that genuinely belong to the chosen PO.
  const pricingScopeTargets: ProductInventory[] =
    pricingScope === 'all' ? filtered :
    pricingScope === 'category' ? filtered.filter(p => pricingCategories.has(p.category)) :
    pricingScope === 'range' ? filtered.filter(p => {
      const val = pricingRangeField === 'cost' ? (p.stock.costPrice || 0) : Number(p.discountedPrice || p.originalPrice || p.price || 0);
      const min = pricingRangeMin === '' ? -Infinity : Number(pricingRangeMin);
      const max = pricingRangeMax === '' ? Infinity : Number(pricingRangeMax);
      return val >= min && val <= max;
    }) :
    pricingScope === 'po' ? products.filter(p => selectedPOProductIds.has(p._id)) :
    /* individual */ filtered.filter(p => pricingSelectedIds.has(p._id));

  // Search box just for picking individual products in the pricing panel —
  // kept separate from the main search bar so narrowing your selection here
  // doesn't also change what's shown in the product list below.
  const pricingIndividualList = filtered.filter(p =>
    p.name?.toLowerCase().includes(pricingIndividualSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(pricingIndividualSearch.toLowerCase())
  );

  const getStockBadge = (p: ProductInventory) => {
    if (!p.stock.trackInventory) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">NOT TRACKED</span>;
    if (!p.stock.isInStock) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">OUT OF STOCK</span>;
    if (p.stock.isLowStock) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700">LOW STOCK</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">IN STOCK</span>;
  };

  return (
    <div className="space-y-6">

      {/* Message */}
      {message.text && (
        <div className={`p-3 rounded-xl text-center font-semibold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Products', value: stats.total, icon: Package, color: 'bg-blue-50 text-blue-600', filter: 'all' },
          { label: 'In Stock', value: stats.inStock, icon: CheckCircle, color: 'bg-green-50 text-green-600', filter: 'in_stock' },
          { label: 'Out of Stock', value: stats.outOfStock, icon: XCircle, color: 'bg-red-50 text-red-600', filter: 'out_of_stock' },
          { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'bg-yellow-50 text-yellow-600', filter: 'low_stock' },
        ].map(stat => (
          <button key={stat.label} onClick={() => setFilter(stat.filter as FilterType)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${filter === stat.filter ? 'border-[#FA5600] shadow-md' : 'border-gray-200 hover:border-[#FA5600]/50'} bg-white`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by product name, category or SKU..."
            className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as FilterType)}
          className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white">
          <option value="all">All ({stats.total})</option>
          <option value="in_stock">In Stock ({stats.inStock})</option>
          <option value="out_of_stock">Out of Stock ({stats.outOfStock})</option>
          <option value="low_stock">Low Stock ({stats.lowStock})</option>
          <option value="untracked">Not Tracked ({stats.untracked})</option>
        </select>
      </div>

      {/* Bulk Tracking Actions */}
      <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-gray-600">
            Bulk Tracking — {filtered.length} product{filtered.length !== 1 ? 's' : ''} visible
            {filter !== 'all' && <span className="text-[#FA5600] ml-1">(filtered)</span>}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Enable/disable applies to visible products · Backfill deducts past delivered orders</p>
        </div>
        <button
          onClick={() => bulkToggleTracking(true)}
          disabled={bulkToggling || backfilling}
          className="flex items-center gap-1.5 bg-[#FA5600] text-white text-xs font-black px-3 py-2 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-50 whitespace-nowrap">
          {bulkToggling ? '...' : '✓ Enable All'}
        </button>
        <button
          onClick={() => bulkToggleTracking(false)}
          disabled={bulkToggling || backfilling}
          className="flex items-center gap-1.5 bg-gray-200 text-gray-700 text-xs font-black px-3 py-2 rounded-xl hover:bg-gray-300 transition disabled:opacity-50 whitespace-nowrap">
          {bulkToggling ? '...' : '✕ Disable All'}
        </button>
        <button
          onClick={backfillDelivered}
          disabled={bulkToggling || backfilling}
          className="flex items-center gap-1.5 bg-blue-500 text-white text-xs font-black px-3 py-2 rounded-xl hover:bg-blue-600 transition disabled:opacity-50 whitespace-nowrap">
          {backfilling ? 'Backfilling...' : '↩ Sync Past Deliveries'}
        </button>
      </div>

      {/* Bulk Price Update */}
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-600">Bulk Price Update</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Sets price = cost price + margin %, rounded to the nearest ₹1</p>
          </div>
          <button onClick={() => { setPricingOpen(o => !o); setPricingPreview(null); }}
            className="text-xs bg-white border-2 border-gray-200 text-gray-700 font-black px-3 py-2 rounded-xl hover:border-[#FA5600] transition whitespace-nowrap">
            {pricingOpen ? '▲ Hide' : '💰 Set Margin %'}
          </button>
        </div>

        {pricingOpen && (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-4">

            {/* Scope selector */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Apply To</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {([
                  ['all', 'All Items'],
                  ['category', 'By Category'],
                  ['range', 'By Value Range'],
                  ['po', 'By Purchase Order'],
                  ['individual', 'Select Individually'],
                ] as const).map(([val, label]) => (
                  <button key={val} onClick={() => { setPricingScope(val); setPricingPreview(null); if (val === 'po') fetchPricingPOs(); }}
                    className={`text-xs font-black px-3 py-2 rounded-lg border-2 transition ${pricingScope === val ? 'bg-[#FA5600] border-[#FA5600] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-[#FA5600]/50'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Scoped within your current search/filter above — {filtered.length} product{filtered.length !== 1 ? 's' : ''} {filter !== 'all' || searchQuery ? 'match that' : 'total'}.
              </p>
            </div>

            {/* Category scope */}
            {pricingScope === 'category' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Categories</label>
                {pricingAvailableCategories.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold">No categories found in the current view.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pricingAvailableCategories.map(cat => {
                      const active = pricingCategories.has(cat);
                      return (
                        <button key={cat} onClick={() => {
                          setPricingCategories(prev => { const next = new Set(prev); active ? next.delete(cat) : next.add(cat); return next; });
                          setPricingPreview(null);
                        }}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition ${active ? 'bg-[#FA5600]/10 border-[#FA5600] text-[#FA5600]' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {active ? '✓ ' : ''}{cat}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Value range scope */}
            {pricingScope === 'range' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Based On</label>
                  <select value={pricingRangeField} onChange={e => { setPricingRangeField(e.target.value as 'cost' | 'selling'); setPricingPreview(null); }}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                    <option value="cost">Cost Price</option>
                    <option value="selling">Current Selling Price</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Min ₹</label>
                  <input type="number" value={pricingRangeMin} onChange={e => { setPricingRangeMin(e.target.value); setPricingPreview(null); }}
                    placeholder="0" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Max ₹</label>
                  <input type="number" value={pricingRangeMax} onChange={e => { setPricingRangeMax(e.target.value); setPricingPreview(null); }}
                    placeholder="No limit" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                </div>
              </div>
            )}

            {/* By Purchase Order scope */}
            {pricingScope === 'po' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1.5">Choose Received PO</label>
                {pricingPOsLoading ? (
                  <p className="text-xs text-gray-400 font-bold py-2">Loading purchase orders...</p>
                ) : pricingPOs.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold py-2">No received purchase orders found.</p>
                ) : (
                  <select value={pricingSelectedPOId} onChange={e => { setPricingSelectedPOId(e.target.value); setPricingPreview(null); }}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                    <option value="">Select a purchase order...</option>
                    {pricingPOs.map(po => (
                      <option key={po._id} value={po._id}>
                        {po.poNumber} — {po.supplier?.name || 'Unknown supplier'} ({(po.receivedItems || po.items || []).length} items, {po.date ? new Date(po.date).toLocaleDateString('en-IN') : ''})
                      </option>
                    ))}
                  </select>
                )}
                {selectedPO && (
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Only items from this PO that match a product in your catalog are included. New margin is based on each item's <span className="font-bold">current cost price in inventory</span>, not necessarily this PO's price (if cost has changed since receiving).
                  </p>
                )}
              </div>
            )}

            {/* Individual selection scope */}
            {pricingScope === 'individual' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500">Select Products ({pricingSelectedIds.size} selected)</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setPricingSelectedIds(new Set(pricingIndividualList.map(p => p._id))); setPricingPreview(null); }}
                      className="text-[10px] font-black text-[#FA5600] hover:underline">Select All Visible</button>
                    <button onClick={() => { setPricingSelectedIds(new Set()); setPricingPreview(null); }}
                      className="text-[10px] font-black text-gray-400 hover:underline">Clear</button>
                  </div>
                </div>
                <input type="text" value={pricingIndividualSearch} onChange={e => setPricingIndividualSearch(e.target.value)}
                  placeholder="Search to find products..." className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none mb-2" />
                <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-gray-100 rounded-lg p-2">
                  {pricingIndividualList.length === 0 ? (
                    <p className="text-xs text-gray-400 font-bold text-center py-3">No matches.</p>
                  ) : pricingIndividualList.map(p => {
                    const checked = pricingSelectedIds.has(p._id);
                    return (
                      <label key={p._id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => {
                          setPricingSelectedIds(prev => { const next = new Set(prev); checked ? next.delete(p._id) : next.add(p._id); return next; });
                          setPricingPreview(null);
                        }} className="accent-[#FA5600]" />
                        <span className="text-xs font-bold text-gray-700 flex-1 truncate">{p.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold">₹{(p.stock.costPrice || 0).toFixed(2)} cost</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs font-black text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
              {pricingScopeTargets.length} product{pricingScopeTargets.length !== 1 ? 's' : ''} in scope
            </p>

            {/* Percentages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Original Price Markup (%)</label>
                <input type="number" value={originalPercent} onChange={e => { setOriginalPercent(e.target.value); setPricingPreview(null); }}
                  placeholder="e.g. 30 — leave blank to skip" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Discounted Price Markup (%)</label>
                <input type="number" value={discountedPercent} onChange={e => { setDiscountedPercent(e.target.value); setPricingPreview(null); }}
                  placeholder="e.g. 15 — leave blank to skip" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 -mt-2">Both are optional but at least one is required — leave either blank to only update that one price type.</p>

            <button onClick={previewBulkPricing} disabled={pricingLoading}
              className="w-full bg-gray-800 text-white text-xs font-black px-4 py-2.5 rounded-xl hover:bg-gray-900 transition disabled:opacity-50">
              {pricingLoading ? 'Calculating...' : 'Preview Changes'}
            </button>

            {pricingPreview && (
              <div className="space-y-3">
                {pricingPreview.items.length > 0 ? (
                  <>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                      {pricingPreview.items.map((it: any) => (
                        <div key={it._id} className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-xs font-bold text-gray-700 truncate">{it.name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-[11px] font-black">
                            <span className="text-gray-400">Cost ₹{it.costPrice.toFixed(2)}</span>
                            {it.newOriginalPrice !== null && (
                              <span>Original: <span className="text-gray-400 line-through">₹{it.currentOriginalPrice.toFixed(2)}</span> → <span className="text-green-600">₹{it.newOriginalPrice.toFixed(2)}</span></span>
                            )}
                            {it.newDiscountedPrice !== null && (
                              <span>Discounted: <span className="text-gray-400 line-through">₹{it.currentDiscountedPrice.toFixed(2)}</span> → <span className="text-green-600">₹{it.newDiscountedPrice.toFixed(2)}</span></span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {pricingPreview.skipped.length > 0 && (
                      <p className="text-[11px] text-yellow-600 font-bold">⚠️ Skipping {pricingPreview.skipped.length} product(s) with no cost price set: {pricingPreview.skipped.map((s: any) => s.name).join(', ')}</p>
                    )}
                    <button onClick={applyBulkPricing} disabled={pricingApplying}
                      className="w-full bg-green-500 text-white text-xs font-black py-2.5 rounded-xl hover:bg-green-600 transition disabled:opacity-50">
                      {pricingApplying ? 'Applying...' : `✓ Apply to ${pricingPreview.items.length} Product(s)`}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 font-bold text-center py-2">No products in scope have a cost price set — nothing to update.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border-2 border-gray-200 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-bold">No products found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(product => {
            const isExpanded = expandedId === product._id;
            const edit = getEdit(product._id, product);
            const isSaving = saving === product._id;
            const isSaved = saved === product._id;
            const isAdjusting = adjusting === product._id;

            return (
              <div key={product._id} className={`bg-white rounded-xl border-2 transition-all ${isExpanded ? 'border-[#FA5600]' : 'border-gray-200'}`}>

                {/* Product Row */}
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : product._id)}>
                  {product.image && !brokenImages.has(product._id) ? (
                    <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
                      onError={() => setBrokenImages(prev => new Set(prev).add(product._id))} />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">📦</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm text-gray-900 truncate">{product.name}</p>
                      {getStockBadge(product)}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {product.category}{product.subCategory ? ` › ${product.subCategory}` : ''}
                      {product.stock.sku ? ` · SKU: ${product.stock.sku}` : ''}
                    </p>
                  </div>

                  {/* Stock numbers */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0 text-center">
                    <div>
                      <p className="text-lg font-black text-gray-900">{product.stock.trackInventory ? product.stock.availableStock : '—'}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">Available</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-500">{product.stock.trackInventory ? product.stock.currentStock : '—'}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">Total</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-green-600">{product.stock.costPrice > 0 ? `₹${product.stock.costPrice.toFixed(2)}` : '—'}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">Cost</p>
                    </div>
                  </div>

                  {/* Quick track toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); quickToggleTracking(product); }}
                    disabled={quickToggling === product._id}
                    title={product.stock.trackInventory ? 'Disable tracking' : 'Enable tracking'}
                    className={`shrink-0 w-10 h-5 rounded-full transition-colors relative ${product.stock.trackInventory ? 'bg-[#FA5600]' : 'bg-gray-300'} ${quickToggling === product._id ? 'opacity-50' : ''}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${product.stock.trackInventory ? 'left-5' : 'left-0.5'}`} />
                  </button>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-5">

                    {/* Toggle tracking */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-black text-gray-800">Track Inventory</p>
                        <p className="text-xs text-gray-500">Enable to manage stock levels for this product</p>
                      </div>
                      <button onClick={() => updateEdit(product._id, 'trackInventory', !edit.trackInventory)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${edit.trackInventory ? 'bg-[#FA5600]' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${edit.trackInventory ? 'left-6' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {edit.trackInventory && (
                      <>
                        {/* Stock fields */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Current Stock</label>
                            <input type="number" value={edit.currentStock ?? 0}
                              onChange={e => updateEdit(product._id, 'currentStock', parseInt(e.target.value) || 0)}
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Reserved</label>
                            <input type="number" value={edit.reservedStock ?? 0}
                              onChange={e => updateEdit(product._id, 'reservedStock', parseInt(e.target.value) || 0)}
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Low Stock Alert</label>
                            <input type="number" value={edit.lowStockAlert ?? 10}
                              onChange={e => updateEdit(product._id, 'lowStockAlert', parseInt(e.target.value) || 10)}
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">SKU</label>
                            <input type="text" value={edit.sku ?? ''}
                              onChange={e => updateEdit(product._id, 'sku', e.target.value)}
                              placeholder="e.g. TAGS-001"
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Cost Price (₹)</label>
                            <input type="number" value={edit.costPrice ?? 0}
                              onChange={e => updateEdit(product._id, 'costPrice', parseFloat(e.target.value) || 0)}
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Unit</label>
                            <select value={edit.unit ?? 'pcs'}
                              onChange={e => updateEdit(product._id, 'unit', e.target.value)}
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition bg-white">
                              <option value="pcs">pcs</option>
                              <option value="kg">kg</option>
                              <option value="box">box</option>
                              <option value="set">set</option>
                              <option value="pair">pair</option>
                            </select>
                          </div>
                        </div>

                        {/* Available stock calc */}
                        <div className="bg-orange-50 rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-500">Available Stock</p>
                            <p className="text-2xl font-black text-[#FA5600]">
                              {Math.max(0, (Number(edit.currentStock) || 0) - (Number(edit.reservedStock) || 0))} {edit.unit || 'pcs'}
                            </p>
                            <p className="text-xs text-gray-400">Current ({edit.currentStock}) − Reserved ({edit.reservedStock})</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-500">Selling Price</p>
                            <p className="text-lg font-black text-gray-900">₹{parseFloat(String(product.discountedPrice || product.price || 0)).toFixed(2)}</p>
                            {product.stock.costPrice > 0 && (
                              <p className="text-xs text-green-600 font-bold">
                                Margin: ₹{(parseFloat(String(product.discountedPrice || product.price || 0)) - product.stock.costPrice).toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Save button */}
                        <button onClick={() => handleSave(product)} disabled={isSaving}
                          className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition ${isSaved ? 'bg-green-500 text-white' : 'bg-[#FA5600] text-white hover:bg-[#E04A00]'} disabled:opacity-60`}>
                          {isSaved ? '✅ Saved!' : isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Inventory</>}
                        </button>

                        {/* Quick Adjustment */}
                        <div className="border-t border-gray-100 pt-4">
                          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Quick Stock Adjustment</p>
                          <div className="flex gap-2 mb-2">
                            <input type="number" min="1"
                              value={adjustmentValues[product._id] || ''}
                              onChange={e => setAdjustmentValues(prev => ({ ...prev, [product._id]: e.target.value }))}
                              placeholder="Qty"
                              className="w-24 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                            <input type="text"
                              value={adjustmentReasons[product._id] || ''}
                              onChange={e => setAdjustmentReasons(prev => ({ ...prev, [product._id]: e.target.value }))}
                              placeholder="Reason (e.g. Restock, Damaged)"
                              className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAdjustment(product, 'add')} disabled={isAdjusting}
                              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl hover:bg-green-600 transition disabled:opacity-60">
                              <Plus className="w-4 h-4" /> Add Stock
                            </button>
                            <button onClick={() => handleAdjustment(product, 'subtract')} disabled={isAdjusting}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl hover:bg-red-600 transition disabled:opacity-60">
                              <Minus className="w-4 h-4" /> Remove Stock
                            </button>
                          </div>
                        </div>

                        {/* Adjustment Log */}
                        {product.stock.adjustmentLog && product.stock.adjustmentLog.length > 0 && (
                          <div className="border-t border-gray-100 pt-4">
                            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Recent Adjustments</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {[...product.stock.adjustmentLog].reverse().slice(0, 10).map((log, i) => (
                                <div key={i} className="flex justify-between items-center text-xs px-3 py-1.5 bg-gray-50 rounded-lg group">
                                  <span className={`font-black shrink-0 ${log.adjustment > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {log.adjustment > 0 ? '+' : ''}{log.adjustment} {product.stock.unit}
                                  </span>
                                  <span className="text-gray-500 flex-1 mx-3 truncate">{log.reason}</span>
                                  <span className="text-gray-400 shrink-0 mr-2">{new Date(log.date).toLocaleDateString('en-IN')}</span>
                                  <button
                                    onClick={() => handleDeleteAdjustment(product, i)}
                                    className="shrink-0 w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 text-[10px] font-black"
                                    title="Delete this entry"
                                  >✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Save when not tracking (just to toggle off) */}
                    {!edit.trackInventory && (
                      <button onClick={() => handleSave(product)} disabled={isSaving}
                        className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gray-200 text-gray-600 hover:bg-gray-300 transition disabled:opacity-60">
                        {isSaving ? 'Saving...' : 'Save (Disable Tracking)'}
                      </button>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default InventoryEmbed;
