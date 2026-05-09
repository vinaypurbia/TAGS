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
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />
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
                  </div>

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
                                <div key={i} className="flex justify-between items-center text-xs px-3 py-1.5 bg-gray-50 rounded-lg">
                                  <span className={`font-black ${log.adjustment > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {log.adjustment > 0 ? '+' : ''}{log.adjustment} {product.stock.unit}
                                  </span>
                                  <span className="text-gray-500 flex-1 mx-3 truncate">{log.reason}</span>
                                  <span className="text-gray-400 shrink-0">{new Date(log.date).toLocaleDateString('en-IN')}</span>
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
