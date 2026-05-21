// ─────────────────────────────────────────────────────────────────────────────
// StockVisibilityPanel.tsx
// Drop this file into src/components/
// Then import and use inside AdminPanel.tsx in the Inventory section:
//
//   import { StockVisibilityPanel } from '../components/StockVisibilityPanel';
//   ...
//   {activeSection === 'inventory' && (
//     <>
//       <InventoryEmbed />
//       <StockVisibilityPanel />   ← add this below InventoryEmbed
//     </>
//   )}
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, AlertTriangle, Package, RefreshCw, Check } from 'lucide-react';

type FrontendStatus = 'normal' | 'low_stock' | 'out_of_stock' | 'hidden';
type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

interface StockItem {
  productId: string;
  inventoryId: string;
  productName: string;
  category: string;
  image: string;
  price: number;
  currentStock: number;
  availableStock: number;
  lowStockAlert: number;
  stockStatus: StockStatus;
  frontendStatus: FrontendStatus;
}

// What each option shows the customer
const STATUS_OPTIONS: {
  value: FrontendStatus;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Product shows as usual',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
  },
  {
    value: 'low_stock',
    label: 'Low Stock Badge',
    description: '"Only X left!" warning shown',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
  },
  {
    value: 'out_of_stock',
    label: 'Out of Stock',
    description: 'Shows greyed out with "Out of Stock" button',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
  {
    value: 'hidden',
    label: 'Hidden',
    description: 'Completely removed from customer catalog',
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
  },
];

function StockBadge({ stockStatus }: { stockStatus: StockStatus }) {
  if (stockStatus === 'out_of_stock')
    return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">OUT OF STOCK</span>;
  if (stockStatus === 'low_stock')
    return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">LOW STOCK</span>;
  return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">IN STOCK</span>;
}

export function StockVisibilityPanel() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);  // productId being saved
  const [saved, setSaved] = useState<string | null>(null);    // productId recently saved
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inventory?action=visibilityPanel');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItems(data);
    } catch {
      setError('Could not load stock data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateFrontendStatus = async (productId: string, frontendStatus: FrontendStatus) => {
    // Optimistic update
    setItems(prev =>
      prev.map(item => item.productId === productId ? { ...item, frontendStatus } : item)
    );
    setSaving(productId);
    setSaved(null);

    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, frontendStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setSaved(productId);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      // Revert on failure
      setError('Failed to save. Please try again.');
      load();
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-8 border-2 border-black p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5" />
          <h2 className="text-lg font-black uppercase tracking-tight">Stock Visibility Control</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 border-2 border-black bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-gray-50">
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5" />
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">Stock Visibility Control</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Control what customers see for low &amp; out-of-stock products
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-600 hover:text-black transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STATUS_OPTIONS.map(opt => (
            <div key={opt.value} className={`flex items-start gap-2 p-2 rounded border ${opt.bg} ${opt.border}`}>
              <div>
                <p className={`text-xs font-bold ${opt.color}`}>{opt.label}</p>
                <p className="text-xs text-gray-500 leading-tight">{opt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !error && (
        <div className="px-6 py-12 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500">All products are in stock</p>
          <p className="text-xs text-gray-400 mt-1">Low stock and out-of-stock products will appear here</p>
        </div>
      )}

      {/* Product rows */}
      <div className="divide-y divide-gray-100">
        {items.map(item => (
          <div key={item.productId} className="px-6 py-4">
            {/* Product info row */}
            <div className="flex items-center gap-3 mb-3">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.productName}
                  className="w-12 h-12 object-cover rounded border border-gray-200 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                  <StockBadge stockStatus={item.stockStatus} />
                  {saved === item.productId && (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-bold">
                      <Check className="w-3 h-3" /> Saved
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.category} &nbsp;·&nbsp;
                  Stock: <span className={item.availableStock === 0 ? 'text-red-600 font-bold' : 'text-amber-600 font-bold'}>
                    {item.availableStock}
                  </span>
                  {item.availableStock > 0 && ` / alert at ${item.lowStockAlert}`}
                  &nbsp;·&nbsp; ₹{item.price?.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Visibility toggle row */}
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => {
                const isSelected = item.frontendStatus === opt.value;
                const isSavingThis = saving === item.productId;
                return (
                  <button
                    key={opt.value}
                    onClick={() => !isSavingThis && updateFrontendStatus(item.productId, opt.value)}
                    disabled={isSavingThis}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold transition-all',
                      isSelected
                        ? `${opt.bg} ${opt.border} ${opt.color} border-2 shadow-sm`
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700',
                      isSavingThis ? 'opacity-50 cursor-wait' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {opt.label}
                  </button>
                );
              })}

              {/* Show/hide icon quick summary */}
              <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
                {item.frontendStatus === 'hidden'
                  ? <><EyeOff className="w-3.5 h-3.5" /> Hidden from catalog</>
                  : <><Eye className="w-3.5 h-3.5" /> Visible in catalog</>
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            Changes apply immediately to the customer-facing catalog. No page reload needed.
          </p>
        </div>
      )}
    </div>
  );
}
