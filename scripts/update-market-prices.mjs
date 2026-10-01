// scripts/update-market-prices.mjs
// Runs in GitHub Actions (NOT on Vercel), so it does not use one of your API function slots.
//
// For each product in MongoDB it looks for the same/similar item on Amazon.in and Meesho,
// keeps only confident matches, and saves the result on the product document as:
//   marketPrices: { amazon: {price,url,title,score}|null, meesho: {...}|null, checkedAt }
// Your existing /api/products already returns the whole document, so the website
// receives `product.marketPrices` with no API changes.
//
// Env vars (set as GitHub repo secrets):
//   TAGS_MONGO     same connection string you use on Vercel   (required)
//   SERPAPI_KEY    Amazon.in search results via SerpApi         (Amazon prices)
//   APIFY_TOKEN    runs a community Meesho scraper on Apify     (Meesho prices)
// Optional:
//   MEESHO_ACTOR   Apify actor id, default aadyantha~meesho-search-scrapper
//   REFRESH_DAYS   re-check a product only if older than this (default 3)
//   MAX_PER_RUN    products per run, keeps API cost bounded (default 40)
//   DRY_RUN=1      print matches, write nothing

import { MongoClient } from 'mongodb';

const {
  TAGS_MONGO, SERPAPI_KEY, APIFY_TOKEN,
  MEESHO_ACTOR = 'aadyantha~meesho-search-scrapper',
  REFRESH_DAYS = '3', MAX_PER_RUN = '40', DRY_RUN,
} = process.env;

if (!TAGS_MONGO) { console.error('TAGS_MONGO is not set'); process.exit(1); }
if (!SERPAPI_KEY && !APIFY_TOKEN) { console.error('Set SERPAPI_KEY and/or APIFY_TOKEN'); process.exit(1); }

// ── Matching ────────────────────────────────────────────────────────────────
const STOP = new Set(['bulk', 'toy', 'toys', 'the', 'a', 'an', 'and', 'of', 'for', 'with', 'pcs', 'pc', 'set', 'pack', 'new', 'kids', 'kid', 'india', 'made']);
const tokens = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ')
  .split(' ').filter(t => t && (t.length > 1 || /\d/.test(t)) && !STOP.has(t));

// Share of OUR product-name words that appear in the candidate's title (0..1)
function matchScore(ourName, candidateTitle) {
  const want = tokens(ourName), have = tokens(candidateTitle);
  if (want.length < 2 || !have.length) return 0; // one-word names are too generic to match safely
  const hit = want.filter(t => have.some(h => h === t || (t.length >= 4 && h.length >= 4 && (h.startsWith(t) || t.startsWith(h)))));
  return hit.length / want.length;
}

const MIN_SCORE = 0.8;        // at least 80% of our name's words must be in their title
const MIN_PRICE_RATIO = 0.5;  // ignore listings priced below half of ours (spare parts / lookalikes)
const MAX_PRICE_RATIO = 10;   // ...or above 10x ours (multi-packs / different item)

function pickBest(ourName, ourPrice, candidates) {
  let best = null;
  for (const c of candidates) {
    if (!c.title || !(c.price > 0)) continue;
    if (c.price < ourPrice * MIN_PRICE_RATIO || c.price > ourPrice * MAX_PRICE_RATIO) continue;
    const score = matchScore(ourName, c.title);
    if (score < MIN_SCORE) continue;
    if (!best || c.price < best.price) best = { price: c.price, url: c.url || '', title: c.title.slice(0, 160), score: Math.round(score * 100) / 100 };
  }
  return best; // cheapest confident match, or null
}

const toNumber = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const searchQuery = (name) => tokens(name).join(' ');

// ── Providers ───────────────────────────────────────────────────────────────
// Amazon.in via SerpApi's Amazon search engine (one request per product).
async function fetchAmazon(query) {
  const url = new URL('https://serpapi.com/search.json');
  url.search = new URLSearchParams({ engine: 'amazon', amazon_domain: 'amazon.in', k: query, api_key: SERPAPI_KEY }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`SerpApi ${r.status}`);
  const j = await r.json();
  if (j.error && !j.organic_results) throw new Error(`SerpApi: ${j.error}`);
  return (j.organic_results || []).map(x => ({ title: x.title, price: toNumber(x.extracted_price ?? x.price), url: x.link }));
}

// Meesho via an Apify actor. Queries are sent in chunks so each synchronous run stays under Apify's ~5 min limit.
// Returns Map<query, candidates[]>. If an actor names its fields differently, only this function needs adjusting.
async function fetchMeeshoBatch(queries) {
  const out = new Map();
  for (let i = 0; i < queries.length; i += 10) {
    const chunk = queries.slice(i, i + 10);
    const r = await fetch(`https://api.apify.com/v2/acts/${MEESHO_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=280`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_strings: chunk, max_results: 10 }),
      signal: AbortSignal.timeout(290000),
    });
    if (!r.ok) throw new Error(`Apify ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const items = await r.json();
    for (const it of Array.isArray(items) ? items : []) {
      const key = it.search_keyword || it.searchKeyword || it.query;
      if (!key) continue;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ title: it.title || it.name, price: toNumber(it.price ?? it.selling_price), url: it.url || it.product_url || it.productUrl || it.link || '' });
    }
  }
  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────
const client = new MongoClient(TAGS_MONGO);
await client.connect();
try {
  const col = client.db('tagsdb').collection('products');
  const cutoff = Date.now() - Number(REFRESH_DAYS) * 86400000;

  const due = (await col.find({}).project({ name: 1, price: 1, originalPrice: 1, discountedPrice: 1, marketPrices: 1 }).toArray())
    .map(p => ({ ...p, ourPrice: toNumber(p.discountedPrice || p.originalPrice || p.price) }))
    .filter(p => p.name && p.ourPrice > 0 && searchQuery(p.name))
    .filter(p => !p.marketPrices?.checkedAt || new Date(p.marketPrices.checkedAt).getTime() < cutoff)
    .sort((a, b) => new Date(a.marketPrices?.checkedAt || 0) - new Date(b.marketPrices?.checkedAt || 0))
    .slice(0, Number(MAX_PER_RUN));

  console.log(`${due.length} product(s) to check${DRY_RUN ? ' (dry run — nothing will be saved)' : ''}`);
  if (!due.length) process.exit(0);

  // Meesho: one batched call for all queries
  let meesho = null, meeshoErr = '';
  if (APIFY_TOKEN) {
    try { meesho = await fetchMeeshoBatch([...new Set(due.map(p => searchQuery(p.name)))]); }
    catch (e) { meeshoErr = e.message; console.error('Meesho lookup failed:', e.message); }
  }

  let saved = 0;
  for (const p of due) {
    const q = searchQuery(p.name);
    const prev = p.marketPrices || {};
    const next = { ...prev, checkedAt: new Date().toISOString() };

    if (SERPAPI_KEY) {
      try {
        const m = pickBest(p.name, p.ourPrice, await fetchAmazon(q));
        next.amazon = m ? { ...m, checkedAt: next.checkedAt } : null;
      } catch (e) { console.error(`  Amazon failed for "${p.name}":`, e.message); } // keep the previous Amazon value
    }
    if (meesho) {
      const m = pickBest(p.name, p.ourPrice, meesho.get(q) || []);
      next.meesho = m ? { ...m, checkedAt: next.checkedAt } : null;
    }

    console.log(`${p.name} (₹${p.ourPrice}) → Amazon: ${next.amazon ? `₹${next.amazon.price} [${next.amazon.title}]` : '—'} | Meesho: ${next.meesho ? `₹${next.meesho.price} [${next.meesho.title}]` : '—'}`);
    if (!DRY_RUN) {
      await col.updateOne({ _id: p._id }, { $set: { marketPrices: next } }); // deliberately no updatedAt / no Meta push
      saved++;
    }
  }
  console.log(`Done. Saved ${saved}.${meeshoErr ? ` (Meesho skipped: ${meeshoErr})` : ''}`);
} finally {
  await client.close();
}
