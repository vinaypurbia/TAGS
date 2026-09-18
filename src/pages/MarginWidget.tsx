import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

interface MarginBlock {
  avgMarginPercent: number | null;
  stockWeightedMarginPercent: number | null;
  productsConsidered: number;
  anticipatedProfit: number;
}

interface MarginSummary {
  original: MarginBlock;
  discounted: MarginBlock;
  skippedNoCostPrice: number;
  totalProducts: number;
}

// Dashboard widget: average profit margin % across the catalog, for both the
// original (base) selling price and the discounted (sale) price, plus the
// rupee profit you'd anticipate if all current stock sold at those prices.
//
// Margin % here is markup-style — ((price − cost) / cost) × 100 — matching
// how prices are actually set elsewhere in the app (cost + margin%).
//
// Two numbers per price type:
//   - the big one is stock-weighted (weighted by availableStock), so it
//     reflects what you'd actually anticipate earning, not just an average
//     that treats a 2-unit item the same as a 200-unit item
//   - the smaller one is a plain unweighted average across products, shown
//     for reference
//
// Drop this into your Home/Dashboard page: <MarginWidget />
export function MarginWidget() {
  const [data, setData] = useState<MarginSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/inventory?action=marginSummary')
      .then(res => res.json())
      .then(json => { if (json.success) setData(json); else setError(true); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const fmtPct = (v: number | null) => v === null ? '—' : `${v >= 0 ? '' : ''}${v.toFixed(1)}%`;
  const fmtRupee = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <p className="text-xs text-gray-400 font-bold">Couldn't load margin data.</p>
      </div>
    );
  }

  const blocks: { label: string; block: MarginBlock }[] = [
    { label: 'Original Price', block: data.original },
    { label: 'Discounted Price', block: data.discounted },
  ];

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#FA5600] flex items-center justify-center">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-black text-gray-900">Profit Margin</p>
          <p className="text-[10px] text-gray-400 font-bold">Stock-weighted across {data.totalProducts - data.skippedNoCostPrice} priced product{data.totalProducts - data.skippedNoCostPrice !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {blocks.map(({ label, block }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
            {block.productsConsidered === 0 ? (
              <p className="text-xs text-gray-400 font-bold mt-1">
                {label === 'Discounted Price' ? 'No items currently on sale' : 'No priced items'}
              </p>
            ) : (
              <>
                <p className="text-2xl font-black text-[#FA5600]">{fmtPct(block.stockWeightedMarginPercent)}</p>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                  {fmtPct(block.avgMarginPercent)} simple avg · {block.productsConsidered} item{block.productsConsidered !== 1 ? 's' : ''}
                </p>
                <p className="text-xs font-black text-green-600 mt-1.5">
                  {fmtRupee(block.anticipatedProfit)} <span className="font-bold text-gray-400">anticipated</span>
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {data.skippedNoCostPrice > 0 && (
        <p className="text-[10px] text-gray-400 font-bold mt-3">
          {data.skippedNoCostPrice} product{data.skippedNoCostPrice !== 1 ? 's have' : ' has'} no cost price set and {data.skippedNoCostPrice !== 1 ? "aren't" : "isn't"} included above.
        </p>
      )}
    </div>
  );
}
