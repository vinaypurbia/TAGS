import { cn } from '../lib/utils';

export interface MarketOffer { price: number; url?: string; title?: string; checkedAt?: string }
export interface MarketPricesData { amazon?: MarketOffer | null; meesho?: MarketOffer | null; checkedAt?: string }

const MAX_AGE_DAYS = 14;               // hide prices older than this rather than show stale numbers
const ONLY_WHEN_WE_ARE_CHEAPER = true; // set false to also show marketplaces that are cheaper than you
const SOURCES = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'meesho', label: 'Meesho' },
] as const;

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function getOffers(mp: MarketPricesData | undefined, ourPrice: number) {
  if (!mp || !(ourPrice > 0)) return [];
  const now = Date.now();
  return SOURCES.flatMap(({ key, label }) => {
    const o = mp[key];
    if (!o || !(o.price > 0)) return [];
    const checked = new Date(o.checkedAt || mp.checkedAt || 0).getTime();
    if (!checked || now - checked > MAX_AGE_DAYS * 86400000) return [];
    if (ONLY_WHEN_WE_ARE_CHEAPER && o.price <= ourPrice) return [];
    return [{ label, price: o.price }];
  });
}

interface Props {
  marketPrices?: MarketPricesData;
  ourPrice: number;
  variant?: 'card' | 'detail';
}

export default function MarketPrices({ marketPrices, ourPrice, variant = 'card' }: Props) {
  const offers = getOffers(marketPrices, ourPrice);
  if (offers.length === 0) return null;

  const lowest = Math.min(...offers.map(o => o.price));
  const saving = lowest - ourPrice;
  const isCard = variant === 'card';

  return (
    <div className={cn('rounded-lg border border-dashed border-gray-200 bg-gray-50', isCard ? 'px-2 py-1.5 mb-2' : 'px-4 py-3')}>
      <div className={cn('font-black uppercase tracking-widest text-gray-400', isCard ? 'text-[8px] mb-0.5' : 'text-[10px] mb-1.5')}>
        Similar item elsewhere
      </div>
      {offers.map(o => (
        <div key={o.label} className={cn('flex items-center justify-between', isCard ? 'text-[10px]' : 'text-sm')}>
          <span className="text-gray-500">{o.label}</span>
          <span className="text-gray-500 line-through">{inr(o.price)}</span>
        </div>
      ))}
      {saving > 0 && (
        <div className={cn('font-black text-green-600 mt-0.5', isCard ? 'text-[10px]' : 'text-sm')}>
          You save {inr(saving)} with TAGS
        </div>
      )}
    </div>
  );
}
