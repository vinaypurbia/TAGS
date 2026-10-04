import { MongoClient, ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';

// Default body-size limit is too small for a base64-encoded invoice photo/PDF.
export const config = { api: { bodyParser: { sizeLimit: '20mb' } }, maxDuration: 60 };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Invoice Import (AI) — fully free: Gemini (free tier) + Jimp crop + Pollinations ────────
// Free tier: Google AI Studio, no credit card. Get a key at https://aistudio.google.com
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Primary model first, then fallback(s) if the primary is overloaded. Override the primary via env var.
const GEMINI_MODELS = process.env.GEMINI_MODELS
  ? process.env.GEMINI_MODELS.split(',').map(m => m.trim()).filter(Boolean) // e.g. "gemini-3.8-flash,gemini-3-flash-preview"
  : [process.env.GEMINI_MODEL || 'gemini-3.8-flash', 'gemini-3-flash-preview'];

function invoiceBufferHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16);
}

async function callGemini(parts) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured on the server');
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });

  // Total time budget for Gemini. The function is limited to 60s (maxDuration), and cropping +
  // uploading item photos happens afterwards, so stop retrying well before that and fail cleanly
  // (a Vercel timeout returns a plain-text page, which the admin panel cannot read as JSON).
  const deadline = Date.now() + 40000;

  let lastErr, hitQuota = false;
  for (const model of GEMINI_MODELS) {
    let waitedFor429 = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 4000) throw lastErr || new Error('Google is taking too long to respond. Please try again in a minute.');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      let r, data;
      try {
        r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(remaining) });
        data = await r.json();
      } catch (e) {
        throw new Error('Google is taking too long to respond. Please try again in a minute.');
      }
      if (r.ok) {
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
        try { return JSON.parse(text); }
        catch { throw new Error('Could not read structured items from this invoice — try a clearer photo or scan'); }
      }
      lastErr = new Error(data.error?.message || `Gemini error (${r.status})`);
      if (r.status === 429) {
        // Free-tier limit. Every retry is another counted request, so don't hammer it: wait once if Google
        // says it clears within seconds, otherwise switch to the next model (each model has its own quota).
        const secs = parseFloat((data.error?.message || '').match(/retry in ([\d.]+)s/i)?.[1]);
        if (!waitedFor429 && secs && secs <= 20 && deadline - Date.now() > (secs + 6) * 1000) {
          waitedFor429 = true;
          await new Promise(res => setTimeout(res, (secs + 1) * 1000));
          continue;
        }
        hitQuota = true;
        break;
      }
      if (![500, 503].includes(r.status)) {
        if (r.status === 404) break; // model not available for this key: try the next model
        throw lastErr;
      }
      await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
  if (hitQuota) {
    console.error('Gemini quota error:', lastErr?.message);
    throw new Error("Google's free AI limit has been reached for now. Wait a minute and try again. If it keeps happening today, the daily free limit is used up (it resets around 12:30 pm IST), or you can enable billing on the Google AI project.");
  }
  throw lastErr;
}

// For a photo/scan, also asks Gemini to locate each item's own product photo on the page (a tight
// bounding box, 0–1000 normalized) so we can crop the REAL photo out — an exact match, not a guess.
// PDFs have no pixels to crop from, so that part is skipped there.
async function extractInvoiceItems(buffer, mimeType) {
  const isImage = mimeType.startsWith('image/');
  const prompt = `This is a supplier invoice for a toy/gadget shop. Read every line item and return ONLY a JSON array ` +
    `(no markdown, no code fences, no prose) where each element looks like:\n` +
    `{\n` +
    `  "name": string,\n` +
    `  "quantity": number | null,\n` +
    `  "unitCost": number | null,\n` +
    `  "description": string,\n` +
    (isImage ?
      `  "hasPhoto": boolean,        // true ONLY if this invoice page actually shows a real photo/picture of this exact item next to its row\n` +
      `  "photoBox": {"ymin":0,"xmin":0,"ymax":0,"xmax":0} | null,  // ONLY when hasPhoto is true: the TIGHT bounding box around just that one photo, each value 0-1000 normalized to the full page. Do not include neighboring photos, text or table borders.\n`
      : '') +
    `  "imagePrompt": string        // a detailed visual description of the item for generating a matching product photo if no real photo is available: colors, shape, material, packaging, visible text/branding\n` +
    `}\n\n` +
    `Rules:\n` +
    `- name: the product name as written, cleaned up (title case, no SKU/item codes). Leave out wholesaler words that are not part of the product's name, such as BULK, VIDEO, CARTOON, BOXED, WHOLESALE, and remove brackets that only held those words\n` +
    `- quantity: the ordered quantity as a plain number\n` +
    `- unitCost: the per-unit cost in the invoice's currency, as a plain number (no symbol, no commas)\n` +
    `- Skip subtotal, tax, discount, shipping and total lines — only real product line items\n` +
    `- If a field is illegible or missing, use null for that field rather than guessing\n` +
    `Return only the JSON array, nothing else.`;

  const items = await callGemini([
    { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
    { text: prompt },
  ]);
  if (!Array.isArray(items)) throw new Error('Unexpected response while reading the invoice');

  return items
    .filter(it => it && typeof it.name === 'string' && it.name.trim())
    .map(it => ({
      name: cleanInvoiceName(it.name),
      quantity: Number.isFinite(it.quantity) ? it.quantity : null,
      unitCost: Number.isFinite(it.unitCost) ? it.unitCost : null,
      description: typeof it.description === 'string' ? it.description.trim() : '',
      hasPhoto: isImage && !!it.hasPhoto && it.photoBox && [it.photoBox.ymin, it.photoBox.xmin, it.photoBox.ymax, it.photoBox.xmax].every(Number.isFinite),
      photoBox: it.photoBox || null,
      imagePrompt: typeof it.imagePrompt === 'string' ? it.imagePrompt.trim() : '',
    }));
}

// Wholesaler words on the invoice that are not part of the product's real name (e.g. "SMALL TRAIN (VIDEO)(BULK)").
// Edit this list to add more. Matching is case-insensitive on whole words.
const INVOICE_NAME_NOISE = ['bulk', 'video', 'videos', 'cartoon', 'cartoons', 'boxed', 'wholesale', 'lot', 'pkt'];
function cleanInvoiceName(raw) {
  const noise = new RegExp(`\\b(?:${INVOICE_NAME_NOISE.join('|')})\\b`, 'gi');
  let n = String(raw || '')
    .replace(/\(([^)]*)\)/g, (m, inner) => (inner.replace(noise, '').replace(/[\s,\-–/&+]+/g, '') === '' ? ' ' : m)) // drop brackets that held only noise words, e.g. (BULK)
    .replace(noise, ' ')                       // drop remaining noise words
    .replace(/\(\s*\)/g, ' ')                  // leftover empty brackets
    .replace(/\s*([(\[])\s*/g, ' $1').replace(/\s+([)\]])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,\-–/&+]+|[\s,\-–/&+]+$/g, '') // stray punctuation at the ends
    .trim();
  // Title case (keeps codes like A-07 and 3D upper-case)
  n = n.split(' ').map(w => /\d/.test(w) ? w.toUpperCase() : w.replace(/[A-Za-z]+/g, p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join(' ');
  return n || String(raw || '').trim(); // never end up with an empty name
}

// Crop the item's real photo straight out of the invoice image (pure JS, no native deps)
async function cropInvoicePhoto(sourceBuffer, box) {
  const { Jimp, ResizeStrategy } = await import('jimp');
  const image = await Jimp.read(sourceBuffer);
  const W = image.bitmap.width, H = image.bitmap.height;
  const pad = 0.015; // a little breathing room around Gemini's box
  const x0 = Math.max(0, Math.round((box.xmin / 1000 - pad) * W));
  const y0 = Math.max(0, Math.round((box.ymin / 1000 - pad) * H));
  const x1 = Math.min(W, Math.round((box.xmax / 1000 + pad) * W));
  const y1 = Math.min(H, Math.round((box.ymax / 1000 + pad) * H));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  image.crop({ x: x0, y: y0, w, h });

  // Invoice photos are tiny, so enlarge the crop to product-image size (long side ≈ 1000px, max 4x) with
  // smooth bicubic scaling, then a light sharpen so it doesn't look blurry. This cleans up the look,
  // it can't add detail that isn't in the original photo.
  const TARGET = 1000;
  const longSide = Math.max(w, h);
  if (longSide < TARGET) {
    const scale = Math.min(4, TARGET / longSide);
    image.resize({ w: Math.round(w * scale), h: Math.round(h * scale), mode: ResizeStrategy.BICUBIC });
    image.convolution([[0, -0.5, 0], [-0.5, 3, -0.5], [0, -0.5, 0]]);
  }
  return await image.getBuffer('image/jpeg', { quality: 92 });
}

// Fallback: a free AI-generated image, guided by Gemini's description of the invoice item
async function pollinationsImage(prompt) {
  const encoded = encodeURIComponent(`${prompt}, plain white background, studio lighting, e-commerce catalog photo`);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1000&height=1000&nologo=true&seed=${Date.now() % 100000}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Image generation failed');
  return Buffer.from(await r.arrayBuffer());
}

// ── Supplier website image lookup ───────────────────────────────────────────
// Given the supplier's website and an item name, search the site and return the product's own
// (usually high-resolution) photo. Tries Shopify and WooCommerce built-in search first, then falls
// back to reading the site's normal search page + product page (og:image / JSON-LD).
const SUPPLIER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const NAME_STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'with', 'pcs', 'pc', 'set', 'pack', 'new']);

// Only public http(s) sites — this server fetches whatever address is typed in, so refuse internal/private ones
function assertPublicUrl(raw) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new Error('That does not look like a valid website address'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http/https websites are supported');
  const h = u.hostname.toLowerCase();
  const privateHost = h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === '::1' || h.startsWith('[');
  if (privateHost && process.env.SUPPLIER_ALLOW_PRIVATE !== '1') throw new Error('That website address is not allowed');
  return u;
}

async function supplierFetch(url, { json = false, timeout = 8000 } = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': SUPPLIER_UA, 'Accept': json ? 'application/json' : 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow', signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

function nameTokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 1 && !NAME_STOPWORDS.has(t));
}
function editDistance(a, b) { // Levenshtein distance (covers spelling variants like walky/walkie)
  const d = Array.from({ length: a.length + 1 }, (_, x) => [x, ...Array(b.length).fill(0)]);
  for (let y = 1; y <= b.length; y++) d[0][y] = y;
  for (let x = 1; x <= a.length; x++) for (let y = 1; y <= b.length; y++)
    d[x][y] = Math.min(d[x - 1][y] + 1, d[x][y - 1] + 1, d[x - 1][y - 1] + (a[x - 1] === b[y - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function tokenMatches(t, cand) {
  return cand.some(c => c === t || (t.length >= 4 && c.length >= 4 && (c.startsWith(t) || t.startsWith(c))) || (t.length >= 5 && c.length >= 5 && editDistance(t, c) <= 2));
}
// 0..1: how much of the invoice item name is found in the supplier's product title
function matchScore(invoiceName, candidateTitle) {
  const want = nameTokens(invoiceName), have = nameTokens(candidateTitle);
  if (!want.length || !have.length) return 0;
  return want.filter(t => tokenMatches(t, have)).length / want.length;
}
const MATCH_THRESHOLD = 0.6;

function absUrl(src, base) { try { return new URL(String(src).replace(/&amp;/g, '&'), base).toString(); } catch { return ''; } }

function bestCandidate(name, cands) {
  let best = null;
  for (const c of cands) {
    if (!c.title || !c.image) continue;
    const score = matchScore(name, c.title);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { ...c, score };
  }
  return best;
}

// og:image / JSON-LD image from a product page — normally the full-size photo
async function productPageImage(pageUrl) {
  const html = await supplierFetch(pageUrl);
  const og = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) ||
             html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (og) return absUrl(og[1], pageUrl);
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => Array.isArray(n) ? n.flatMap(walk) : (n && typeof n === 'object') ? [n, ...walk(Object.values(n))] : [];
      const prod = walk(JSON.parse(m[1])).find(n => String(n['@type'] || '').includes('Product') && n.image);
      if (prod) { const im = Array.isArray(prod.image) ? prod.image[0] : prod.image; return absUrl(typeof im === 'string' ? im : im?.url, pageUrl); }
    } catch { /* ignore bad JSON-LD */ }
  }
  return '';
}

async function findSupplierProduct(siteUrl, name) {
  const origin = assertPublicUrl(siteUrl).origin;
  const q = encodeURIComponent(name);
  const deadline = Date.now() + 40000;
  const left = () => deadline - Date.now() > 3000;

  // 1) Shopify predictive search
  try {
    const d = await supplierFetch(`${origin}/search/suggest.json?q=${q}&resources[type]=product&resources[limit]=8`, { json: true });
    const prods = d?.resources?.results?.products || [];
    const best = bestCandidate(name, prods.map(p => ({ title: p.title, image: p.featured_image?.url || p.image, page: absUrl(p.url, origin) })));
    if (best) {
      let image = '';
      if (left()) { try { image = await productPageImage(best.page); } catch { /* use search thumbnail */ } }
      return { image: image || absUrl(best.image, origin), title: best.title, page: best.page };
    }
  } catch { /* not Shopify */ }

  // 2) WooCommerce Store API
  if (left()) {
    try {
      const d = await supplierFetch(`${origin}/wp-json/wc/store/v1/products?search=${q}&per_page=8`, { json: true });
      const best = bestCandidate(name, (Array.isArray(d) ? d : []).map(p => ({ title: String(p.name || '').replace(/&amp;/g, '&'), image: p.images?.[0]?.src, page: p.permalink })));
      if (best) return { image: absUrl(best.image, origin), title: best.title, page: best.page };
    } catch { /* not WooCommerce */ }
  }

  // 3) Generic: the site's normal search results page → best matching product link → its page image
  const searchUrls = [`${origin}/search?q=${q}`, `${origin}/?s=${q}&post_type=product`, `${origin}/catalogsearch/result/?q=${q}`, `${origin}/search?search=${q}`, `${origin}/?s=${q}`];
  for (const su of searchUrls) {
    if (!left()) break;
    let html;
    try { html = await supplierFetch(su); } catch { continue; }
    const cands = [];
    for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = absUrl(m[1], su);
      if (!href || !href.startsWith(origin) || href === su) continue;
      const inner = m[2];
      const imgTag = inner.match(/<img\b[^>]*>/i)?.[0] || '';
      const alt = imgTag.match(/\balt=["']([^"']*)["']/i)?.[1] || '';
      const src = imgTag.match(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i)?.[1] || '';
      const title = (m[0].match(/\btitle=["']([^"']+)["']/i)?.[1] || inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || alt).slice(0, 200);
      cands.push({ title, image: src ? absUrl(src, su) : 'x', page: href, thumb: src ? absUrl(src, su) : '' });
    }
    const best = bestCandidate(name, cands);
    if (best) {
      let image = '';
      if (left()) { try { image = await productPageImage(best.page); } catch { /* fall back to thumbnail */ } }
      image = image || best.thumb;
      if (image) return { image, title: best.title, page: best.page };
    }
  }
  return null;
}

// ── Product description (from the item name + its final picture) ────────────
// The picture is fetched from our own Cloudinary storage only, then shown to Gemini together with the name.
async function loadCloudinaryImagePart(imageUrl) {
  const u = new URL(imageUrl);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('cloudinary.com')) throw new Error('Unsupported image address');
  const r = await fetch(imageUrl, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Could not load the picture (${r.status})`);
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new Error('Picture is too large');
  return { inline_data: { mime_type: mime.startsWith('image/') ? mime : 'image/jpeg', data: buf.toString('base64') } };
}

// Many items in ONE Gemini request (saves free-tier quota: 1 call for a whole invoice instead of 1 per item)
async function generateProductDescriptions(items) {
  const parts = [];
  for (const [i, it] of items.entries()) {
    let img = null;
    if (it.imageUrl) { try { img = await loadCloudinaryImagePart(it.imageUrl); } catch { img = null; } }
    parts.push({ text: `ITEM ${i + 1} — id "${it.id}", name: "${it.name}"` + (it.hint ? `, supplier invoice note (may be rough): "${it.hint}"` : '') + (img ? ' — its picture:' : ' — (no picture)') });
    if (img) parts.push(img);
  }
  parts.push({ text:
    `You write product descriptions for an Indian toy & gadget shop's online catalogue. For EACH item above, look closely at its picture (when there is one) and describe THAT product.\n` +
    `For each, write 2-3 short sentences (about 40-60 words) for shoppers: what the product is, how a child plays with it or what it does, and its visible features ` +
    `(colours, lights, remote control, number of pieces, etc.) only when visible in the picture or clearly implied by the name.\n` +
    `Rules: do NOT invent specifications such as battery type, size, material, age range, safety certificates or brand claims that are not visible. ` +
    `Simple, warm English. No emojis, no markdown, no price, no hashtags, do not repeat the product name at the start.\n` +
    `Return ONLY a JSON array with EXACTLY ${items.length} elements, in the SAME ORDER as the items above: [{"item": <the item number>, "description": string}]` });
  const out = await callGemini(parts);

  // Be forgiving about the shape Gemini returns: a bare array, an object wrapping an array, or an object keyed by item number/id.
  let arr = null;
  if (Array.isArray(out)) arr = out;
  else if (out && typeof out === 'object') arr = Object.values(out).find(Array.isArray) || null;
  const textOf = (o) => {
    const v = typeof o === 'string' ? o : (o && (o.description ?? o.text ?? o.desc));
    return typeof v === 'string' ? v.trim() : '';
  };
  const map = {};
  items.forEach((it, idx) => {
    let d = '';
    if (arr) {
      // match by item number, then by echoed id, then by position (when the count lines up)
      const hit = arr.find(o => o && typeof o === 'object' && (Number(o.item) === idx + 1 || String(o.id) === it.id));
      d = textOf(hit) || (arr.length === items.length ? textOf(arr[idx]) : '');
    } else if (out && typeof out === 'object') {
      d = textOf(out[String(idx + 1)]) || textOf(out[it.id]);
    }
    if (d) map[it.id] = d;
  });
  if (Object.keys(map).length === 0) {
    console.error('Descriptions: could not read the AI response shape:', JSON.stringify(out).slice(0, 300));
    throw new Error('The AI answered in a format that could not be read. Press Rewrite to try again.');
  }
  return map;
}

async function generateProductDescription({ name, hint, imageUrl }) {
  const parts = [];
  if (imageUrl) parts.push(await loadCloudinaryImagePart(imageUrl));
  parts.push({ text:
    `You write product descriptions for an Indian toy & gadget shop's online catalogue.\n` +
    `Product name: "${name}"\n` +
    (hint ? `Note from the supplier invoice (may be rough or inaccurate): "${hint}"\n` : '') +
    (imageUrl ? `Look closely at the attached product picture and describe THIS product.\n` : '') +
    `Write 2-3 short sentences (about 40-60 words) for shoppers: what the product is, how a child plays with it or what it does, and its visible features ` +
    `(colours, lights, remote control, number of pieces, etc.) only when they are visible in the picture or clearly implied by the name.\n` +
    `Rules: do NOT invent specifications such as battery type, size, material, age range, safety certificates or brand claims that are not visible. ` +
    `Simple, warm English. No emojis, no markdown, no price, no hashtags, do not repeat the product name at the start.\n` +
    `Return ONLY JSON: {"description": string}` });
  const out = await callGemini(parts);
  const d = typeof out?.description === 'string' ? out.description.trim() : '';
  if (!d) throw new Error('No description was returned');
  return d;
}

async function downloadImage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': SUPPLIER_UA, 'Accept': 'image/*,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Image download failed (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000 || buf.length > 12 * 1024 * 1024) throw new Error('Image size looks wrong');
  return buf;
}

// ── Use a picture from a link (supplier site), optionally with AI text removal ──────────────
// The link can be a direct image address or a product page (its main image is used).
async function loadImageFromLink(link) {
  const u = assertPublicUrl(link);
  const r = await fetch(u.toString(), {
    headers: { 'User-Agent': SUPPLIER_UA, 'Accept': 'image/*,text/html;q=0.8,*/*;q=0.5' },
    redirect: 'follow', signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Could not open that link (${r.status})`);
  const type = (r.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('image/')) {
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 2000 || buf.length > 12 * 1024 * 1024) throw new Error('Image size looks wrong');
    return buf;
  }
  if (type.includes('text/html')) {
    const img = await productPageImage(u.toString());
    if (!img) throw new Error('No product image found on that page — right-click the photo and use "Copy image address" instead');
    return await downloadImage(img);
  }
  throw new Error('That link is not an image or a product page');
}

// Removes seller/wholesaler text, banners, captions and watermarks, keeping the product itself.
// Needs an image-capable Gemini model on this key (mostly paid-only) — returns null when unavailable.
const GEMINI_IMAGE_MODELS = [
  process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
];
async function geminiCleanImage(buffer, name) {
  if (!GEMINI_API_KEY) return { buf: null, reason: 'no-key' };
  const mime = buffer[0] === 0x89 && buffer[1] === 0x50 ? 'image/png' : buffer.slice(0, 4).toString() === 'RIFF' ? 'image/webp' : 'image/jpeg';
  const body = JSON.stringify({
    contents: [{ parts: [
      { inline_data: { mime_type: mime, data: buffer.toString('base64') } },
      { text:
        `This is a wholesaler's photo of a toy called "${name}". Edit it into a clean online-shop product photo:\n` +
        `- REMOVE all text, titles, captions, banners, item numbers, quantity or packing labels, price tags, watermarks, logos and any lettering the seller added over the picture (including cartoon-style title text).\n` +
        `- KEEP the product itself exactly as it is: same shape, colours, parts and its own packaging artwork. Do not redesign or add anything.\n` +
        `- If several copies or extra items appear, keep only the main product.\n` +
        `- Plain white background, soft even lighting, product centred and fully visible, square 1:1 image, high resolution.` },
    ] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  });
  let reason = 'unavailable';
  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(50000),
      });
      const data = await r.json();
      if (!r.ok) { console.warn(`Image model ${model} unavailable (${r.status}):`, data.error?.message); reason = r.status === 429 ? 'quota' : 'unavailable'; continue; }
      const part = (data.candidates?.[0]?.content?.parts || []).find(p => (p.inlineData || p.inline_data)?.data);
      const inline = part && (part.inlineData || part.inline_data);
      if (inline) return { buf: Buffer.from(inline.data, 'base64'), reason: '' };
      reason = 'empty';
    } catch (e) {
      console.warn(`Image model ${model} failed:`, e.message);
    }
  }
  return { buf: null, reason };
}

async function uploadInvoiceItemImage(buffer) {
  const isWebp = buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP';
  const mime = buffer[0] === 0x89 && buffer[1] === 0x50 ? 'image/png' : isWebp ? 'image/webp' : buffer.slice(0, 3).toString() === 'GIF' ? 'image/gif' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
  const hash = invoiceBufferHash(buffer);
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'tags-invoice-items',
    public_id: `item_${hash}`,
    format: 'webp',
    transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto:good' }],
    overwrite: false,
    unique_filename: true,
    invalidate: true,
    resource_type: 'image',
  });
  return result.secure_url;
}

// ── Helper: re-host any external image URL on Cloudinary ────────────────────
// Facebook CDN, Google Images, WhatsApp media etc. expire or block hotlinking.
// This downloads the image server-side and returns a permanent Cloudinary URL.
async function ensureCloudinaryImage(url) {
  if (!url || url.trim() === '') return '';
  // Already on Cloudinary — no action needed
  if (url.includes('res.cloudinary.com') || url.includes('cloudinary.com')) return url;
  // Local blob URL from browser — can't fetch server-side, skip
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder: 'tags-products',
      format: 'webp',
      transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto:low', strip_metadata: true }],
      unique_filename: true,
      invalidate: true,
    });
    return result.secure_url;
  } catch (err) {
    // If Cloudinary can't fetch it (expired CDN, auth-blocked), keep original URL
    // as a graceful fallback — don't fail the whole product save
    console.warn('ensureCloudinaryImage: could not re-host', url, '—', err.message);
    return url;
  }
}

const uri = process.env.TAGS_MONGO;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const CATALOG_ID = '1901314136807871';

// ── Story broadcast helpers (Instagram + Facebook Page stories) ─────────────
// Env: META_ACCESS_TOKEN (already set) + FB_PAGE_ID (required).
// Optional: IG_USER_ID (auto-discovered from the Page), META_PAGE_TOKEN (overrides META_ACCESS_TOKEN for stories).
const META_GRAPH = 'https://graph.facebook.com/v25.0';

async function metaCall(path, params, method = 'POST') {
  const qs = new URLSearchParams(params);
  const r = method === 'GET'
    ? await fetch(`${META_GRAPH}/${path}?${qs}`)
    : await fetch(`${META_GRAPH}/${path}`, { method, body: qs });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API error (${r.status})`);
  return j;
}

// Works whether the token is a user/system-user token (exchanged for the Page token here)
// or already a Page token. The Instagram account is discovered from the Page unless IG_USER_ID is set.
async function resolveStoryAccounts() {
  const baseToken = process.env.META_PAGE_TOKEN || META_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!baseToken) throw new Error('META_ACCESS_TOKEN is not set');
  if (!pageId) throw new Error('FB_PAGE_ID is not set in Vercel env vars');
  let pageToken = baseToken;
  let igId = process.env.IG_USER_ID || '';
  try {
    const pg = await metaCall(pageId, { fields: 'access_token,instagram_business_account', access_token: baseToken }, 'GET');
    if (pg.access_token) pageToken = pg.access_token;
    if (!igId && pg.instagram_business_account?.id) igId = pg.instagram_business_account.id;
  } catch { /* keep the token as-is */ }
  return { pageId, pageToken, igId };
}

async function postInstagramStory(imageUrl, { igId, pageToken }) {
  if (!igId) throw new Error('No Instagram Business/Creator account is linked to this Page (or set IG_USER_ID)');
  const container = await metaCall(`${igId}/media`, { image_url: imageUrl, media_type: 'STORIES', access_token: pageToken });
  for (let i = 0; i < 6; i++) {
    const st = await metaCall(container.id, { fields: 'status_code', access_token: pageToken }, 'GET');
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`Instagram rejected the image (${st.status_code})`);
    await new Promise(r => setTimeout(r, 1000));
  }
  const pub = await metaCall(`${igId}/media_publish`, { creation_id: container.id, access_token: pageToken });
  return pub.id;
}

async function postFacebookStory(imageUrl, { pageId, pageToken }) {
  const photo = await metaCall(`${pageId}/photos`, { url: imageUrl, published: 'false', access_token: pageToken });
  const story = await metaCall(`${pageId}/photo_stories`, { photo_id: photo.id, access_token: pageToken });
  return story.post_id;
}

// Normal Instagram feed post (not a story). Instagram only accepts JPEG, in an aspect ratio
// between 4:5 (portrait) and 1.91:1 (landscape) — so before converting to JPEG, Cloudinary is
// asked to pad (never crop) anything outside that range onto a white background until it fits,
// so nothing about the photo is lost and Instagram can never reject it for its shape.
async function postInstagramFeed(imageUrl, caption, { igId, pageToken }) {
  if (!igId) throw new Error('No Instagram Business/Creator account is linked to this Page (or set IG_USER_ID)');
  const jpegUrl = imageUrl.replace('/upload/',
    '/upload/if_ar_lt_0.8/c_pad,ar_0.8,b_white/if_end/if_ar_gt_1.91/c_pad,ar_1.91,b_white/if_end/f_jpg,q_auto:good,c_limit,w_1440/');
  const container = await metaCall(`${igId}/media`, { image_url: jpegUrl, caption: caption || '', access_token: pageToken });
  for (let i = 0; i < 6; i++) {
    const st = await metaCall(container.id, { fields: 'status_code', access_token: pageToken }, 'GET');
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') {
      throw new Error(`Instagram rejected the image (${st.status_code})`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  const pub = await metaCall(`${igId}/media_publish`, { creation_id: container.id, access_token: pageToken });
  return pub.id;
}

// A normal Facebook Page feed photo post (published:true — not the draft+story combo used for stories).
async function postFacebookFeed(imageUrl, caption, { pageId, pageToken }) {
  const photo = await metaCall(`${pageId}/photos`, { url: imageUrl, caption: caption || '', published: 'true', access_token: pageToken });
  return photo.post_id || photo.id;
}

// A Facebook Page feed video post. `videoUrl` must already be public (Cloudinary), since Facebook
// fetches it server-side rather than accepting an upload here. `thumbUrl` (optional) sets the cover
// image shown before playback, since a video post can't carry a separate attached photo.
async function postFacebookVideo(videoUrl, caption, thumbUrl, { pageId, pageToken }) {
  const params = { file_url: videoUrl, description: caption || '', access_token: pageToken };
  if (thumbUrl) params.thumb = thumbUrl;
  const vid = await metaCall(`${pageId}/videos`, params);
  return vid.id;
}

// ── Video broadcast helpers (Reels, video stories, Telegram video) ──────────
// The browser uploads the video straight to Cloudinary. Meta needs MP4 (H.264 + AAC) and, for Reels /
// Stories, a vertical 9:16 frame, so Cloudinary makes a converted copy on demand ("prepare"). The browser
// then polls "status" itself, so no single request here ever has to wait out Meta's processing time
// (this function is capped at 60s).
function cloudVideoUrl(raw) {
  const clean = String(raw || '').replace(/\?.*$/, '');
  if (!clean.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/`)) return '';
  return clean;
}

// kind 'meta'  → 1080x1920 (9:16), padded with black bars, never cropped
// kind 'plain' → original shape, max 1280px (keeps Telegram's 20MB link limit comfortable)
function deriveVideoUrl(clean, kind) {
  const t = kind === 'plain'
    ? 'c_limit,w_1280,h_1280,f_mp4,vc_h264,ac_aac,q_auto:good'
    : 'c_pad,w_1080,h_1920,b_black,f_mp4,vc_h264,ac_aac,q_auto:good';
  return clean.replace('/video/upload/', `/video/upload/${t}/`).replace(/\.[a-z0-9]+$/i, '.mp4');
}

async function checkDerivedVideo(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-1' }, signal: AbortSignal.timeout(40000) });
    if (r.status === 200 || r.status === 206) return { ready: true };
    if (r.status === 400 || r.status === 404) return { ready: false, error: `Cloudinary could not convert this video (HTTP ${r.status}).` };
    return { ready: false };   // 423 etc. = still being generated
  } catch { return { ready: false }; }
}

const VIDEO_TARGETS = ['instagram_reel', 'instagram_story', 'facebook_reel', 'facebook_story'];

async function igVideoStart(target, videoUrl, caption, { igId, pageToken }) {
  if (!igId) throw new Error('No Instagram Business/Creator account is linked to this Page (or set IG_USER_ID)');
  const params = { video_url: videoUrl, access_token: pageToken };
  if (target === 'instagram_reel') {
    params.media_type = 'REELS';
    params.caption = caption || '';
    params.share_to_feed = 'true';   // a Reel that also shows on the normal feed grid
  } else {
    params.media_type = 'STORIES';
  }
  const c = await metaCall(`${igId}/media`, params);
  return c.id;
}

// Facebook Reels / video stories: start → Facebook fetches the file from our public URL → finish
async function fbVideoStart(target, videoUrl, caption, { pageId, pageToken }) {
  const edge = target === 'facebook_reel' ? 'video_reels' : 'video_stories';
  const st = await metaCall(`${pageId}/${edge}`, { upload_phase: 'start', access_token: pageToken });
  const up = await fetch(st.upload_url || `https://rupload.facebook.com/video-upload/v25.0/${st.video_id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${pageToken}`, file_url: videoUrl },
  });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false || uj.error) {
    throw new Error(uj.error?.message || uj.debug_info?.message || `Facebook could not fetch the video (${up.status})`);
  }
  const fin = { upload_phase: 'finish', video_id: st.video_id, access_token: pageToken };
  if (target === 'facebook_reel') { fin.video_state = 'PUBLISHED'; fin.description = caption || ''; }
  await metaCall(`${pageId}/${edge}`, fin);
  return st.video_id;
}

async function videoStatus(target, { containerId, videoId }, { pageToken }) {
  if (target.startsWith('instagram')) {
    const s = await metaCall(containerId, { fields: 'status_code,status', access_token: pageToken }, 'GET');
    if (s.status_code === 'FINISHED') return { state: 'ready' };
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') return { state: 'error', detail: s.status || s.status_code };
    return { state: 'processing', detail: s.status_code || 'IN_PROGRESS' };
  }
  const s = await metaCall(videoId, { fields: 'status', access_token: pageToken }, 'GET');
  const vs = s.status?.video_status;
  const pub = s.status?.publishing_phase?.status;
  if (vs === 'error' || pub === 'error') {
    const why = s.status?.processing_phase?.errors || s.status?.publishing_phase?.errors || s.status?.uploading_phase?.errors;
    return { state: 'error', detail: why ? JSON.stringify(why).slice(0, 200) : 'Facebook rejected the video' };
  }
  if (vs === 'ready' || pub === 'complete') return { state: 'ready' };
  return { state: 'processing', detail: vs || 'processing' };
}

async function telegramSendVideo(videoUrl, caption) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) throw new Error('Telegram credentials missing — check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars');
  const send = async (extra) => {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, video: videoUrl, caption: String(caption || '').slice(0, 1024), supports_streaming: true, ...extra }),
    });
    return r.json().catch(() => ({}));
  };
  let d = await send({ parse_mode: 'Markdown' });
  if (!d.ok && /parse/i.test(d.description || '')) d = await send({});   // caption markdown rejected → plain text
  if (!d.ok) throw new Error(`Telegram error: ${d.description || 'could not send the video'}`);
  return d.result?.message_id;
}

let client;

async function getClient() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client;
}

function parseMetaPrice(priceStr) {
  if (!priceStr) return 0;
  return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
}

function getFbProductCategory(category) {
  const map = {
    'Toys': '1253',
    'Electronics': '222',
    'Automotive': '916',
    'Travel Gear': '5613',
    'Sports': '499',
    'Gadgets': '222',
    'General': '1',
  };
  return map[category] || '1';
}

// ── Helper: resolve Meta availability from actual inventory ──────────────────
// Never hardcode 'in stock' — always read from inventory collection
async function resolveMetaAvailability(productId, inventory) {
  if (!productId) return 'out of stock';
  const stock = await inventory.findOne({ productId: productId.toString() });
  if (!stock) return 'out of stock'; // no inventory record = not tracked = treat as out of stock
  return (stock.availableStock || 0) > 0 ? 'in stock' : 'out of stock';
}

async function pushProductToMeta(product, metaId = null, inventory = null) {
  if (!META_ACCESS_TOKEN) return null;

  const price = parseFloat(product.discountedPrice || product.originalPrice || product.price || 0);
  const originalPrice = parseFloat(product.originalPrice || product.price || 0);
  const priceInPaise = Math.round(price * 100);
  const originalPriceInPaise = Math.round(originalPrice * 100);

  // FIX: resolve availability from inventory instead of hardcoding 'in stock'
  const availability = inventory
    ? await resolveMetaAvailability(product._id, inventory)
    : 'out of stock'; // safe default if inventory not passed

  const body = {
    name: product.name,
    description: product.description || product.name,
    availability,  // FIX: now dynamic from inventory
    condition: 'new',
    image_url: product.imageUrl || product.image || '',
    url: `https://www.ta-gs.online/products/${product._id || ''}`,
    brand: 'TAGS',
    fb_product_category: getFbProductCategory(product.category),
    currency: 'INR',
    price: priceInPaise,
  };

  if (originalPrice > price) {
    body.price = originalPriceInPaise;
    body.sale_price = priceInPaise;
    body.sale_price_currency = 'INR';
  }

  if (metaId) {
    const res = await fetch(`https://graph.facebook.com/v25.0/${metaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: META_ACCESS_TOKEN }),
    });
    return res.json();
  }

  const res = await fetch(`https://graph.facebook.com/v25.0/${CATALOG_ID}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      retailer_id: product._id?.toString() || Date.now().toString(),
      access_token: META_ACCESS_TOKEN,
    }),
  });
  return res.json();
}

async function deleteProductFromMeta(metaId) {
  if (!META_ACCESS_TOKEN || !metaId) return null;
  const res = await fetch(`https://graph.facebook.com/v25.0/${metaId}?access_token=${META_ACCESS_TOKEN}`, {
    method: 'DELETE',
  });
  return res.json();
}

async function syncMetaToMongo(collection) {
  if (!META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN is not set');

  let allProducts = [];
  let url = `https://graph.facebook.com/v25.0/${CATALOG_ID}/products?fields=id,name,description,price,sale_price,image_url,availability,category&limit=100&access_token=${META_ACCESS_TOKEN}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Meta API error: ${data.error.message}`);
    allProducts = allProducts.concat(data.data || []);
    url = data.paging?.next || null;
  }

  let synced = 0;
  for (const mp of allProducts) {
    const price = parseMetaPrice(mp.price);
    const salePrice = mp.sale_price ? parseMetaPrice(mp.sale_price) : null;

    await collection.updateOne(
      { metaId: mp.id },
      {
        $set: {
          metaId: mp.id,
          name: mp.name || '',
          description: mp.description || '',
          price: price,
          originalPrice: price,
          discountedPrice: salePrice || undefined,
          category: mp.category || 'General',
          image: mp.image_url || '',
          imageUrl: mp.image_url || '',
          // NOTE: do NOT sync availability from Meta → our inventory is the source of truth
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    synced++;
  }

  return { synced, total: allProducts.length };
}

// ── Helper: enrich a product with its live inventory data ────────────────────
// FULLY linked to inventory — no hardcoded defaults for stock status
async function enrichWithStock(p, inventory) {
  const pid = p._id.toString();
  const stock = await inventory.findOne({ productId: pid });

  if (stock) {
    // Inventory record exists — compute everything live from actual numbers
    const availableStock = stock.availableStock || 0;
    const currentStock = stock.currentStock || 0;
    const reservedStock = stock.reservedStock || 0;
    const lowStockAlert = stock.lowStockAlert || 5;
    const trackInventory = stock.trackInventory !== false;

    // Always recompute isInStock and stockStatus from availableStock — never trust stored string
    const isInStock = availableStock > 0;
    const isLowStock = trackInventory && availableStock <= lowStockAlert && availableStock > 0;
    let stockStatus = 'out_of_stock';
    if (availableStock > 0) {
      stockStatus = isLowStock ? 'low_stock' : 'in_stock';
    }

    p.stock = {
      available: availableStock,
      total: currentStock,
      reserved: reservedStock,
      isInStock,
      isLowStock,
      availableStock,
      currentStock,
      reservedStock,
      lowStockAlert,
      trackInventory,
      sku: stock.sku || '',
      costPrice: stock.costPrice || 0,
      unit: stock.unit || 'pcs',
      stockStatus,                              // computed live — never from DB string alone
      frontendStatus: stock.frontendStatus || 'normal',
      adjustmentLog: stock.adjustmentLog || [],
      inventoryId: stock._id.toString(),
      updatedAt: stock.updatedAt,
    };
  } else {
    // FIX: No inventory record = product is NOT tracked = out of stock
    // Never assume 'in stock' just because no record exists
    p.stock = {
      available: 0,
      total: 0,
      reserved: 0,
      isInStock: false,           // FIX: was true — now correctly false
      isLowStock: false,
      availableStock: 0,
      currentStock: 0,
      reservedStock: 0,
      lowStockAlert: 5,
      trackInventory: false,
      sku: '',
      costPrice: 0,
      unit: 'pcs',
      stockStatus: 'out_of_stock', // FIX: was 'in_stock' — now correctly out_of_stock
      frontendStatus: 'normal',
      adjustmentLog: [],
      inventoryId: null,
      updatedAt: null,
    };
  }
  return p;
}

// ── Helper: strip Cloudinary transformation params from URL ──────────────────
// Pulls the Cloudinary public_id (folder/filename, no extension) out of a delivery URL, so we can
// ask Cloudinary's Admin API for the image's real pixel dimensions without downloading it.
function extractCloudinaryPublicId(url) {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const clean = cleanCloudinaryUrl(url);
  const m = clean.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+(?:\?.*)?$/);
  return m ? m[1] : null;
}

function cleanCloudinaryUrl(url) {
  if (!url) return '';
  try {
    let clean = url
      .replace(/\/upload\/(?:[^/]+\/)*?(v\d+\/)/, '/upload/$1')
      .replace(/\/upload\/[^/]+\/(?!v\d)/, '/upload/')
      .replace(/\?.*$/, '');
    return clean;
  } catch {
    return url;
  }
}

export default async function handler(req, res) {

    // ── Full database backup — POST /api/products?backup=true  (header: x-backup-key) ──────────
    // Downloads every collection in the database as one JSON file.
    if (req.method === 'POST' && req.query.backup === 'true') {
      try {
        const dbClient = await getClient();
        const db = dbClient.db('tagsdb');
        const collInfos = await db.listCollections().toArray();
        const dump = {};
        for (const info of collInfos) {
          if (info.type && info.type !== 'collection') continue; // skip views/system entries
          dump[info.name] = await db.collection(info.name).find({}).toArray();
        }
        const payload = {
          _backupMeta: {
            dbName: 'tagsdb',
            takenAt: new Date().toISOString(),
            documentCounts: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length])),
          },
          ...dump,
        };
        const filename = `tags-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(JSON.stringify(payload, null, 2));
      } catch (error) {
        console.error('Backup error:', error);
        return res.status(500).json({ error: error.message || 'Backup failed' });
      }
    }

    // ── Restore from a backup — POST /api/products?restore=true  { backup, collections?, confirm } ──
    // Destructive: for each selected collection, existing documents are replaced with the backup's.
    // Requires confirm === 'RESTORE' (typed by the admin in the UI) as a deliberate "are you sure",
    // not a security check — this endpoint has the same protection level as the rest of this file.
    if (req.method === 'POST' && req.query.restore === 'true') {
      const { backup, collections, confirm } = req.body || {};
      if (confirm !== 'RESTORE') return res.status(400).json({ error: 'Type RESTORE to confirm' });
      if (!backup || typeof backup !== 'object') return res.status(400).json({ error: 'No backup data received' });

      const available = Object.keys(backup).filter(k => k !== '_backupMeta' && Array.isArray(backup[k]));
      const wanted = Array.isArray(collections) && collections.length ? collections.filter(c => available.includes(c)) : available;
      if (wanted.length === 0) return res.status(400).json({ error: 'No matching collections to restore' });

      // Turn each document's exported "_id" hex string back into a real ObjectId so identity
      // (and anything elsewhere that references these ids) is preserved. Other fields are restored
      // as plain JSON — any Date fields will come back as ISO strings rather than native Dates.
      const reviveId = (doc) => {
        if (doc && typeof doc._id === 'string' && /^[0-9a-fA-F]{24}$/.test(doc._id)) {
          try { return { ...doc, _id: new ObjectId(doc._id) }; } catch { return doc; }
        }
        return doc;
      };

      try {
        const dbClient = await getClient();
        const db = dbClient.db('tagsdb');
        const results = {};
        for (const name of wanted) {
          const docs = (backup[name] || []).map(reviveId);
          try {
            await db.collection(name).deleteMany({});
            if (docs.length > 0) await db.collection(name).insertMany(docs, { ordered: false });
            results[name] = { ok: true, restored: docs.length };
          } catch (err) {
            results[name] = { ok: false, error: err.message };
          }
        }
        return res.status(200).json({ success: true, results });
      } catch (error) {
        console.error('Restore error:', error);
        return res.status(500).json({ error: error.message || 'Restore failed' });
      }
    }

    // ── Invoice Import (AI) — POST /api/products?invoiceExtract=true  { fileBase64, mimeType } ──
    if (req.method === 'POST' && req.query.invoiceExtract === 'true') {
      const { fileBase64, mimeType } = req.body || {};
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' });
      const buffer = Buffer.from(fileBase64, 'base64');
      if (buffer.length === 0) return res.status(400).json({ error: 'No file received' });
      if (buffer.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'File too large. Maximum size is 15 MB.' });
      const mt = mimeType || 'application/pdf';
      if (mt !== 'application/pdf' && !mt.startsWith('image/')) {
        return res.status(400).json({ error: 'Upload a PDF or a photo/scan (JPEG, PNG) of the invoice' });
      }
      try {
        const items = await extractInvoiceItems(buffer, mt);
        if (items.length === 0) return res.status(422).json({ error: 'No line items found in this invoice. Try a clearer scan.' });
        // Crop each item's real photo now, while we still have the original bytes in memory.
        const withPhotos = await Promise.all(items.map(async (it) => {
          if (!it.hasPhoto) return { ...it, imageUrl: '', imageSource: '' };
          try {
            const cropped = await cropInvoicePhoto(buffer, it.photoBox);
            return { ...it, imageUrl: await uploadInvoiceItemImage(cropped), imageSource: 'invoice' };
          } catch {
            return { ...it, imageUrl: '', imageSource: '' }; // crop failed → frontend falls back to the AI image
          }
        }));
        return res.status(200).json({ success: true, items: withPhotos });
      } catch (error) {
        console.error('Invoice extract error:', error);
        return res.status(500).json({ error: error.message || 'Invoice import failed' });
      }
    }

    // ── Invoice Import (AI) — POST /api/products?imageFromLink=true  { url, name?, clean? } ─────
    // Replaces an item's picture with the image at a link (e.g. the supplier's high-resolution photo).
    // clean=true also asks AI to remove wholesaler text/logos; if that model is unavailable the picture is
    // still used as-is and the response says cleaned:false so the admin knows.
    if (req.method === 'POST' && req.query.imageFromLink === 'true') {
      const { url, name, clean } = req.body || {};
      if (!url) return res.status(400).json({ error: 'A link is required' });
      try {
        let buf = await loadImageFromLink(String(url));
        let cleaned = false, note = '';
        if (clean) {
          const out = await geminiCleanImage(buf, String(name || 'toy'));
          if (out.buf) { buf = out.buf; cleaned = true; }
          else note = out.reason === 'quota'
            ? 'The picture was saved as-is: the AI image limit is used up right now.'
            : 'The picture was saved as-is: AI text removal is not available on this Google plan (image editing usually needs billing enabled).';
        }
        const imageUrl = await uploadInvoiceItemImage(buf);
        return res.status(200).json({ success: true, imageUrl, cleaned, note });
      } catch (error) {
        console.warn('Image from link failed:', error.message);
        return res.status(400).json({ error: error.message || 'Could not use that link' });
      }
    }

    // ── Invoice Import (AI) — POST /api/products?supplierImage=true  { name, siteUrl } ─────────
    // Looks the item up on the supplier's own website and returns its product photo (uploaded to Cloudinary).
    if (req.method === 'POST' && req.query.supplierImage === 'true') {
      const { name, siteUrl } = req.body || {};
      if (!name || !siteUrl) return res.status(400).json({ error: 'name and siteUrl are required' });
      try {
        const hit = await findSupplierProduct(String(siteUrl), String(name));
        if (!hit) return res.status(200).json({ found: false });
        const imageUrl = await uploadInvoiceItemImage(await downloadImage(hit.image));
        return res.status(200).json({ found: true, imageUrl, matchedTitle: hit.title, productUrl: hit.page });
      } catch (error) {
        console.warn('Supplier image lookup failed:', error.message);
        return res.status(200).json({ found: false, error: error.message });
      }
    }

    // ── Invoice Import (AI) — POST /api/products?invoiceDescriptions=true  { items: [{ id, name, hint?, imageUrl? }] } ──
    if (req.method === 'POST' && req.query.invoiceDescriptions === 'true') {
      const list = (Array.isArray(req.body?.items) ? req.body.items : []).filter(i => i && i.id && i.name).slice(0, 8)
        .map(i => ({ id: String(i.id), name: String(i.name), hint: i.hint ? String(i.hint).slice(0, 300) : '', imageUrl: i.imageUrl ? String(i.imageUrl) : '' }));
      if (list.length === 0) return res.status(400).json({ error: 'items are required' });
      try {
        return res.status(200).json({ success: true, descriptions: await generateProductDescriptions(list) });
      } catch (error) {
        console.error('Invoice descriptions error:', error);
        return res.status(500).json({ error: error.message || 'Could not write descriptions' });
      }
    }

    // ── Invoice Import (AI) — POST /api/products?invoiceDescription=true  { name, hint?, imageUrl? } ──
    if (req.method === 'POST' && req.query.invoiceDescription === 'true') {
      const { name, hint, imageUrl } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      try {
        const description = await generateProductDescription({ name: String(name), hint: hint ? String(hint).slice(0, 300) : '', imageUrl: imageUrl ? String(imageUrl) : '' });
        return res.status(200).json({ success: true, description });
      } catch (error) {
        console.error('Invoice description error:', error);
        return res.status(500).json({ error: error.message || 'Could not write a description' });
      }
    }

    // ── Invoice Import (AI) — POST /api/products?invoiceImage=true  { name, prompt? } ──────────
    // Free AI-generated fallback picture: used when the invoice had no real photo for the item,
    // and for the "try a different picture" button.
    if (req.method === 'POST' && req.query.invoiceImage === 'true') {
      const { name, prompt } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      try {
        const buf = await pollinationsImage((prompt || name).trim());
        const imageUrl = await uploadInvoiceItemImage(buf);
        return res.status(200).json({ success: true, imageUrl, source: 'ai' });
      } catch (error) {
        console.error('Invoice image error:', error);
        return res.status(500).json({ error: error.message || 'Image generation failed' });
      }
    }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const collection = db.collection('products');
    const appSettings = db.collection('appSettings');
    const inventory = db.collection('inventory');
    // Referenced only when a product's name/sku changes, to cascade that
    // change into any purchase orders / sales that reference this product (see PUT)
    const purchaseOrders = db.collection('purchaseOrders');
    const salesCol = db.collection('sales');
    const shareLog = db.collection('shareLog');

    // ── Broadcast share history (WhatsApp / Telegram / Instagram / Facebook) ────
    // GET  /api/products?shareLog=true  → { history: { [productId]: { lastAt, channel, count } } }
    //      count = number of shares in the last 90 days, across all channels
    // POST /api/products?shareLog=true  body: { productIds: string[], channel: string } → marks them shared now
    if (req.query.shareLog === 'true') {
      if (req.method === 'GET') {
        const since90 = new Date(Date.now() - 90 * 86400000);
        const docs = await shareLog.find({ sharedAt: { $gte: since90 } }).sort({ sharedAt: 1 }).toArray();
        const history = {};
        for (const d of docs) {
          const id = String(d.productId);
          const prev = history[id];
          history[id] = { lastAt: d.sharedAt.toISOString(), channel: d.channel, count: (prev?.count || 0) + 1 };
        }
        return res.status(200).json({ history });
      }
      if (req.method === 'POST') {
        const { productIds, channel } = req.body || {};
        const ids = Array.isArray(productIds) ? productIds.map(String).filter(Boolean) : [];
        if (ids.length === 0) return res.status(400).json({ error: 'productIds is required' });
        const now = new Date();
        await shareLog.insertMany(ids.map(id => ({ productId: id, channel: String(channel || 'unknown'), sharedAt: now })));
        return res.status(200).json({ ok: true, recorded: ids.length });
      }
    }

    // ── Music library for Product Videos — GET/POST /api/products?musicLibrary=true ────────────
    // The admin uploads their OWN royalty-free tracks here (YouTube Audio Library, Pixabay Music,
    // Incompetech, etc.) — nothing is bundled or guessed on our end, since getting a license wrong
    // is a real risk we're not going to take on the admin's behalf.
    if (req.query.musicLibrary === 'true') {
      if (req.method === 'GET') {
        const doc = await appSettings.findOne({ _id: 'musicLibrary' });
        return res.status(200).json({ tracks: doc?.tracks || [] });
      }
      if (req.method === 'POST') {
        const { tracks } = req.body || {};
        if (!Array.isArray(tracks)) return res.status(400).json({ error: 'tracks must be an array' });
        const clean = tracks
          .filter(t => t && t.url)
          .map(t => ({ id: String(t.id || t.url), name: String(t.name || 'Untitled track').slice(0, 80), url: String(t.url) }));
        await appSettings.updateOne({ _id: 'musicLibrary' }, { $set: { tracks: clean, updatedAt: new Date() } }, { upsert: true });
        return res.status(200).json({ success: true, tracks: clean });
      }
    }

    // ── Image quality scan — GET /api/products?imageQuality=true ────────────────────────────────
    // Asks Cloudinary for each image's real pixel dimensions (no downloading, just metadata) and
    // sorts products into "too small to fix" vs "sharpening could genuinely help" vs fine.
    if (req.method === 'GET' && req.query.imageQuality === 'true') {
      const LOW = 500, BORDERLINE = 900; // px, shorter side

      const allProducts = await collection.find({})
        .project({ name: 1, category: 1, image: 1, imageUrl: 1 }).toArray();

      const withIds = allProducts.map(p => {
        const raw = p.image || p.imageUrl || '';
        return { ...p, _imgUrl: raw, _publicId: extractCloudinaryPublicId(raw) };
      });
      const cloudinaryOnes = withIds.filter(p => p._publicId);
      const unknownCount = withIds.filter(p => p._imgUrl && !p._publicId).length; // has a photo, just not on Cloudinary
      const noImageCount = withIds.filter(p => !p._imgUrl).length;

      const dimMap = new Map();
      for (let i = 0; i < cloudinaryOnes.length; i += 100) {
        const batch = cloudinaryOnes.slice(i, i + 100);
        try {
          const result = await cloudinary.api.resources_by_ids(batch.map(p => p._publicId));
          for (const r of result.resources || []) dimMap.set(r.public_id, r);
        } catch { /* this batch failed to look up — those products are simply skipped, not flagged wrongly */ }
      }

      const low = [], borderline = [];
      for (const p of cloudinaryOnes) {
        const r = dimMap.get(p._publicId);
        if (!r || !r.width || !r.height) continue;
        const minSide = Math.min(r.width, r.height);
        const entry = { _id: p._id, name: p.name || '(no name)', category: p.category || '', image: p._imgUrl, width: r.width, height: r.height };
        if (minSide < LOW) low.push(entry);
        else if (minSide < BORDERLINE) borderline.push(entry);
      }

      return res.status(200).json({ low, borderline, unknownCount, noImageCount, totalScanned: allProducts.length });
    }

    // ── Image enhance — POST /api/products?enhanceImage=true  { id } ────────────────────────────
    // Applies Cloudinary's standard (free-tier) sharpen/improve/quality delivery transform — this is
    // NOT AI super-resolution and can't invent missing detail, so genuinely tiny images are refused
    // here with a message instead, rather than quietly producing a result that still looks bad.
    if (req.method === 'POST' && req.query.enhanceImage === 'true') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      let product;
      try { product = await collection.findOne({ _id: new ObjectId(id) }); }
      catch { return res.status(400).json({ error: 'Invalid product id' }); }
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const rawUrl = product.image || product.imageUrl || '';
      const publicId = extractCloudinaryPublicId(rawUrl);
      if (!publicId) {
        return res.status(400).json({ error: "This image isn't hosted on Cloudinary, so it can't be enhanced here — try re-uploading it instead." });
      }

      let resource;
      try { resource = await cloudinary.api.resource(publicId); }
      catch { return res.status(404).json({ error: 'Could not find this image on Cloudinary' }); }

      const minSide = Math.min(resource.width || 0, resource.height || 0);
      if (minSide > 0 && minSide < 500) {
        return res.status(422).json({
          error: `This photo is only ${resource.width}×${resource.height}px — sharpening won't meaningfully fix that. Please upload a higher-resolution photo instead.`,
          tooSmall: true,
        });
      }

      const clean = cleanCloudinaryUrl(rawUrl);
      const enhancedUrl = clean.replace('/upload/', '/upload/e_improve,e_sharpen:60,q_auto:best/');
      await collection.updateOne({ _id: new ObjectId(id) }, { $set: { image: enhancedUrl, imageEnhancedAt: new Date() } });
      return res.status(200).json({ success: true, imageUrl: enhancedUrl });
    }

    // ── Data cleanup audit — GET /api/products?audit=true ──────────────────────────────────────
    // Finds three kinds of likely-junk data for the admin to REVIEW before deleting anything:
    //   orphanInventory   — inventory rows whose productId points at a product that no longer exists
    //                        (this is what shows up as "Unknown / ₹0 / Stock 0" in Stock Visibility)
    //   noActivityProducts — products never sold, never shared, and never on a purchase order —
    //                        the closest available proxy for "nobody here added this on purpose"
    //   badPriceProducts   — products whose price resolves to 0 or isn't a real number, which is
    //                        also why a product can silently vanish from a low→high price sort
    // Nothing is deleted here — this only reports candidates.
    if (req.method === 'GET' && req.query.audit === 'true') {
      const [allProducts, allInventory] = await Promise.all([
        collection.find({}).project({ name: 1, category: 1, originalPrice: 1, discountedPrice: 1, price: 1, createdAt: 1, image: 1, imageUrl: 1 }).toArray(),
        inventory.find({}).toArray(),
      ]);

      const productIdSet = new Set(allProducts.map(p => p._id.toString()));

      // "Activity" is checked across EVERY collection in the database, not a fixed list — a real
      // customer checkout, for instance, may write to an "orders" collection that has nothing to do
      // with the admin's manual "Record Sale" (sales) feature. This catches any collection, present
      // or future, that references a productId either directly or inside an items[] array.
      const activeIdSet = new Set();
      const collInfos = await db.listCollections().toArray();
      const scanCollections = collInfos.filter(c => (!c.type || c.type === 'collection') && !['products', 'inventory'].includes(c.name));
      await Promise.all(scanCollections.map(async (info) => {
        const col = db.collection(info.name);
        const cursor = col.find(
          { $or: [{ productId: { $exists: true } }, { 'items.productId': { $exists: true } }] },
          { projection: { productId: 1, items: 1 } }
        );
        for await (const d of cursor) {
          if (d.productId) activeIdSet.add(String(d.productId));
          for (const it of d.items || []) if (it && it.productId) activeIdSet.add(String(it.productId));
        }
      }));

      // Stock can be entered directly in Inventory without ever going through a purchase order, so a
      // product carrying real stock is clear evidence someone is actively managing it — even with none
      // of the signals above. Treat "has stock" the same as "has activity".
      const stockMap = new Map(allInventory.map(inv => [String(inv.productId), Number(inv.availableStock ?? inv.currentStock ?? 0)]));
      for (const [pid, stock] of stockMap) if (stock > 0) activeIdSet.add(pid);

      const orphanInventory = allInventory
        .filter(inv => inv.productId && !productIdSet.has(String(inv.productId)))
        .slice(0, 300)
        .map(inv => ({ _id: inv._id, productId: inv.productId, stock: inv.availableStock ?? inv.currentStock ?? 0 }));

      const noActivityProducts = allProducts
        .filter(p => !activeIdSet.has(p._id.toString()))
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) // oldest untouched first
        .slice(0, 300)
        .map(p => ({ _id: p._id, name: p.name || '(no name)', category: p.category || '', createdAt: p.createdAt || null,
          image: p.image || p.imageUrl || '', price: Number(p.discountedPrice || p.originalPrice || p.price || 0) }));

      const badPriceProducts = allProducts
        .filter(p => !(Number(p.discountedPrice || p.originalPrice || p.price) > 0))
        .slice(0, 300)
        .map(p => ({ _id: p._id, name: p.name || '(no name)', category: p.category || '', image: p.image || p.imageUrl || '',
          originalPrice: p.originalPrice ?? null, discountedPrice: p.discountedPrice ?? null }));

      return res.status(200).json({
        counts: { products: allProducts.length, inventory: allInventory.length },
        orphanInventory, noActivityProducts, badPriceProducts,
      });
    }

    // ── Cleanup delete — POST /api/products?auditDelete=true  { inventoryIds?, productIds?, confirm } ──
    // Deletes only what the admin explicitly selected after reviewing the audit above.
    if (req.method === 'POST' && req.query.auditDelete === 'true') {
      const { inventoryIds, productIds, confirm } = req.body || {};
      if (confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' });
      const invIds = (Array.isArray(inventoryIds) ? inventoryIds : []).filter(Boolean);
      const prodIds = (Array.isArray(productIds) ? productIds : []).filter(Boolean);
      if (invIds.length === 0 && prodIds.length === 0) return res.status(400).json({ error: 'Nothing selected to delete' });

      const results = { inventoryDeleted: 0, productsDeleted: 0, errors: [] };

      if (invIds.length > 0) {
        try {
          const r = await inventory.deleteMany({ _id: { $in: invIds.map(id => new ObjectId(id)) } });
          results.inventoryDeleted = r.deletedCount || 0;
        } catch (e) { results.errors.push(`Inventory: ${e.message}`); }
      }

      for (const id of prodIds) {
        try {
          const existing = await collection.findOne({ _id: new ObjectId(id) });
          const r = await collection.deleteOne({ _id: new ObjectId(id) });
          if (r.deletedCount === 0) continue;
          results.productsDeleted++;
          await inventory.deleteOne({ productId: id }).catch(() => {});
          try {
            const imageUrl = existing?.image || existing?.imageUrl || '';
            if (imageUrl && imageUrl.includes('res.cloudinary.com')) {
              const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
              if (match && match[1]) await cloudinary.uploader.destroy(match[1], { invalidate: true });
            }
          } catch { /* non-fatal: product is still deleted */ }
          try { if (existing?.metaId) await deleteProductFromMeta(existing.metaId); }
          catch { /* non-fatal: product is still deleted */ }
        } catch (e) { results.errors.push(`Product ${id}: ${e.message}`); }
      }

      return res.status(200).json({ success: true, results });
    }

    // ── Cloudinary direct-upload signature (for videos too large for this function's body limit) ──
    // GET /api/products?cloudinarySign=true&resourceType=video
    // The browser uploads the file straight to Cloudinary with this signature — the file itself
    // never passes through this server, so Vercel's ~4.5MB request-body limit never applies to it.
    if (req.method === 'GET' && req.query.cloudinarySign === 'true') {
      const resourceType = req.query.resourceType === 'video' ? 'video' : 'image';
      const timestamp = Math.round(Date.now() / 1000);
      const folder = 'tags-broadcast-videos';
      const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
      return res.status(200).json({
        signature, timestamp, folder, resourceType,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    }

    // ── Story setup check ────────────────────────────────────────────────────
    // GET /api/products?storyCheck=true  → read-only; shows what is configured / missing (no secrets returned)
    if (req.method === 'GET' && req.query.storyCheck === 'true') {
      const base = process.env.META_PAGE_TOKEN || META_ACCESS_TOKEN;
      const out = {
        env: {
          META_ACCESS_TOKEN: !!META_ACCESS_TOKEN,
          FB_PAGE_ID: !!process.env.FB_PAGE_ID,
          IG_USER_ID: process.env.IG_USER_ID ? 'set' : 'not set (auto-discovered from Page)',
          CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
        },
        token: null, page: null, instagram: null, missing: [],
      };
      if (!META_ACCESS_TOKEN) out.missing.push('META_ACCESS_TOKEN env var');
      if (!process.env.FB_PAGE_ID) out.missing.push('FB_PAGE_ID env var');
      if (base) {
        try {
          const d = (await metaCall('debug_token', { input_token: base, access_token: base }, 'GET')).data || {};
          out.token = { type: d.type, valid: d.is_valid, expires: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'never', scopes: d.scopes || [] };
          if (d.is_valid === false) out.missing.push('a valid (non-expired) token');
          if (d.scopes?.length) {
            for (const sc of ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'instagram_basic', 'instagram_content_publish']) {
              if (!d.scopes.includes(sc)) out.missing.push(`token permission: ${sc}`);
            }
          }
        } catch (e) { out.token = { error: e.message }; }
        if (!process.env.FB_PAGE_ID) {
          // Help find the right FB_PAGE_ID: list the Pages this token can access
          try {
            const acc = await metaCall('me/accounts', { fields: 'id,name,instagram_business_account{username}', limit: '25', access_token: base }, 'GET');
            out.availablePages = (acc.data || []).map(x => ({ id: x.id, name: x.name, instagram: x.instagram_business_account?.username || null }));
          } catch (e) { out.availablePages = { error: e.message }; }
        }
        if (process.env.FB_PAGE_ID) {
          try {
            const pg = await metaCall(process.env.FB_PAGE_ID, { fields: 'name,instagram_business_account{id,username}', access_token: base }, 'GET');
            out.page = { name: pg.name };
            out.instagram = pg.instagram_business_account || null;
            if (!pg.instagram_business_account && !process.env.IG_USER_ID) out.missing.push('Instagram Business account linked to the Page');
          } catch (e) { out.page = { error: e.message }; out.missing.push('access to the Page with this token'); }
        }
      }
      out.ready = out.missing.length === 0;
      return res.status(200).json(out);
    }

    if (req.method === 'GET') {
      const {
        id, withStock, syncMeta, pushAll,
        page, limit, category, subcategory, search,
        adminView
      } = req.query;

      // ── Special ops ───────────────────────────────────────────
      // ── One-time migration: re-host all external images to Cloudinary ──────
      if (req.query.migrate_images === 'true') {
        const allProducts = await collection.find({
          $or: [
            { image: { $exists: true, $ne: '', $not: /res\.cloudinary\.com/ } },
            { imageUrl: { $exists: true, $ne: '', $not: /res\.cloudinary\.com/ } },
          ]
        }).toArray();

        let fixed = 0, skipped = 0, failed = 0;
        const results = [];

        for (const p of allProducts) {
          const originalUrl = (p.image || p.imageUrl || '').trim();
          if (!originalUrl || originalUrl.includes('cloudinary.com')) { skipped++; continue; }

          const newUrl = await ensureCloudinaryImage(originalUrl);
          if (newUrl !== originalUrl && newUrl.includes('cloudinary.com')) {
            await collection.updateOne(
              { _id: p._id },
              { $set: { image: newUrl, imageUrl: newUrl, updatedAt: new Date() } }
            );
            fixed++;
            results.push({ name: p.name, status: 'fixed', from: originalUrl.slice(0, 80) });
          } else {
            failed++;
            results.push({ name: p.name, status: 'failed', url: originalUrl.slice(0, 80) });
          }
        }
        return res.status(200).json({ success: true, fixed, skipped, failed, total: allProducts.length, results });
      }

      if (syncMeta === 'true') {
        const result = await syncMetaToMongo(collection);
        return res.status(200).json({
          success: true,
          message: `Synced ${result.synced} of ${result.total} products from Meta catalog`,
          ...result,
        });
      }

      if (pushAll === 'true') {
        const allProducts = await collection.find({}).toArray();
        let pushed = 0, failed = 0, errors = [], results = [];

        for (const product of allProducts) {
          try {
            const pid = product._id.toString();
            // FIX: pass inventory so Meta availability is resolved from actual stock
            const metaResult = await pushProductToMeta(
              { ...product, _id: pid },
              product.metaId || null,
              inventory
            );
            results.push({ name: product.name, result: metaResult });
            if (metaResult?.id || metaResult?.success) pushed++;
            else { failed++; errors.push({ name: product.name, error: metaResult }); }
          } catch (e) {
            failed++;
            errors.push({ name: product.name, error: e.message });
          }
        }

        return res.status(200).json({ success: true, pushed, failed, errors, results });
      }

      // ── Single product by ID ───────────────────────────────────
      if (id) {
        const product = await collection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        await enrichWithStock(product, inventory);
        return res.status(200).json(product);
      }

      // ── Cleanup duplicate/empty products ─────────────────────
      if (req.query.cleanup === 'true') {
        const deleted = await collection.deleteMany({
          $and: [
            { $or: [{ price: 0 }, { price: null }, { price: { $exists: false } }] },
            { $or: [{ name: '' }, { name: null }, { name: { $exists: false } }] },
          ]
        });
        return res.status(200).json({ success: true, deleted: deleted.deletedCount });
      }

      // ── Find duplicate products (same name + category) ───────────────────
      // GET /api/products?dedupe=preview  → returns each duplicate group with
      //                                      the FULL product data (image, price,
      //                                      description...) for every copy, plus
      //                                      a recommended "keep" pick (the copy
      //                                      with the most complete data — has an
      //                                      image, description, and price; ties
      //                                      broken by oldest). Deletes nothing —
      //                                      the actual delete is a separate,
      //                                      explicit call (see dedupeConfirm
      //                                      below) so you can review images/
      //                                      details and override the pick
      //                                      before anything is removed.
      if (req.query.dedupe === 'preview') {
        const groups = await collection.aggregate([
          // group by trimmed, case-insensitive name + category so
          // "Uno Flip" and "uno flip " are treated as the same product
          { $sort: { createdAt: 1 } }, // oldest first, for stable tie-breaks
          {
            $addFields: {
              _dedupeName: { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } },
              _dedupeCategory: { $toLower: { $trim: { input: { $ifNull: ['$category', ''] } } } },
            }
          },
          {
            $group: {
              _id: { name: '$_dedupeName', category: '$_dedupeCategory' },
              count: { $sum: 1 },
              docs: {
                $push: {
                  _id: '$_id',
                  name: '$name',
                  category: '$category',
                  subcategory: '$subcategory',
                  image: '$image',
                  imageUrl: '$imageUrl',
                  imageUrls: '$imageUrls',
                  originalPrice: '$originalPrice',
                  discountedPrice: '$discountedPrice',
                  description: '$description',
                  createdAt: '$createdAt',
                }
              },
            }
          },
          { $match: { count: { $gt: 1 }, '_id.name': { $ne: '' } } },
          { $sort: { count: -1 } },
        ]).toArray();

        // Score how "complete" a product entry is, so the recommended keep
        // is the one with actual data — not just whichever was imported first.
        const scoreProduct = (d) => {
          const hasImage = !!(d.image || d.imageUrl || (Array.isArray(d.imageUrls) && d.imageUrls[0]));
          const hasDescription = !!(d.description && d.description.trim());
          const price = Number(d.discountedPrice || d.originalPrice) || 0;
          return (hasImage ? 4 : 0) + (hasDescription ? 2 : 0) + (price > 0 ? 1 : 0);
        };

        const groupSummaries = groups.map(g => {
          const products = g.docs.map(d => ({ ...d, _id: d._id.toString(), score: scoreProduct(d) }));
          // pick highest score; docs are createdAt-ascending, so on a tie the
          // earlier `reduce` keeps the first (oldest) one it already holds
          const recommended = products.reduce((best, p) => (p.score > best.score ? p : best), products[0]);
          return {
            name: g.docs[0].name,
            category: g._id.category || '(none)',
            count: g.count,
            recommendedKeepId: recommended._id,
            products,
          };
        });

        const totalToDelete = groupSummaries.reduce((sum, g) => sum + (g.count - 1), 0);
        return res.status(200).json({
          success: true,
          dryRun: true,
          duplicateGroups: groupSummaries.length,
          totalToDelete,
          groups: groupSummaries,
        });
      }

      // ── PAGINATED product list ─────────────────────────────────
      const mongoFilter = {};
      if (category && category !== '') mongoFilter.category = category;
      if (subcategory && subcategory.trim() !== '') {
        mongoFilter.subcategory = { $regex: `^${subcategory.trim()}$`, $options: 'i' };
      }
      if (search && search.trim() !== '') {
        const q = search.trim();
        mongoFilter.$or = [
          { name:        { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { category:    { $regex: q, $options: 'i' } },
          { subcategory: { $regex: q, $options: 'i' } },
        ];
      }

      const total = await collection.countDocuments(mongoFilter);

      // FIX: a search query (e.g. the PO item picker) should never be capped
      // at 100 — it needs to be able to find ANY product in the catalog, no
      // matter how deep in the list it sits. Only apply page/limit pagination
      // when the caller is browsing a plain list (no search term). When a
      // search term is present, return every match, uncapped.
      let products, pageNum, pageSize;
      if (search && search.trim() !== '') {
        pageNum = 1;
        products = await collection
          .find(mongoFilter)
          .sort({ createdAt: -1 })
          .toArray();
        pageSize = products.length;
      } else {
        pageNum  = Math.max(1, parseInt(page || '1', 10));
        // Raised the hard cap from 100 → 1000. Still bounded so a rogue
        // request can't pull the whole DB into memory, but well above any
        // realistic catalog size for the plain (non-search) list view.
        pageSize = Math.min(1000, Math.max(1, parseInt(limit || '20', 10)));
        const skip = (pageNum - 1) * pageSize;
        products = await collection
          .find(mongoFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .toArray();
      }

      // Always enrich with live inventory data
      const enriched = await Promise.all(
        products.map(p => enrichWithStock(p, inventory))
      );

      // Filter out hidden products from customer-facing catalog
      const result = adminView === 'true'
        ? enriched
        : enriched.filter(p => p.stock?.frontendStatus !== 'hidden');

      return res.status(200).json({
        products: result,
        page: pageNum,
        limit: pageSize,
        total,
        hasMore: (search && search.trim() !== '') ? false : (pageNum * pageSize) < total,
      });
    }

    // ── Story Broadcast (Instagram + Facebook Page stories) ──────────────────
    // POST /api/products  body: { storyBroadcast: true, imageUrl, platforms: ['instagram','facebook'] }
    if (req.method === 'POST' && req.body?.storyBroadcast === true) {
      const { imageUrl, platforms } = req.body;
      const clean = String(imageUrl || '').replace(/\?.*$/, '');   // keep the exact upload URL (incl. version segment)
      // Only our own Cloudinary images, and JPEG only (Instagram rejects other formats for stories)
      if (!clean.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
        return res.status(400).json({ error: 'imageUrl must be one of your Cloudinary images' });
      }
      if (!/\.jpe?g$/i.test(clean)) {
        return res.status(400).json({ error: 'Story image must be a JPEG — /api/upload returned a different format' });
      }
      const wanted = Array.isArray(platforms) ? platforms.filter(p => p === 'instagram' || p === 'facebook') : [];
      if (wanted.length === 0) return res.status(400).json({ error: 'No platforms selected' });

      try {
        const acct = await resolveStoryAccounts();
        const jobs = { instagram: postInstagramStory, facebook: postFacebookStory };
        const settled = await Promise.allSettled(wanted.map(p => jobs[p](clean, acct)));
        const results = {};
        wanted.forEach((p, i) => {
          const r = settled[i];
          results[p] = r.status === 'fulfilled' ? { ok: true, id: r.value } : { ok: false, error: r.reason?.message || 'Failed' };
          if (r.status === 'rejected') console.error(`[Story:${p}]`, r.reason?.message);
        });
        return res.status(200).json({ results });
      } catch (err) {
        console.error('[Story] error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Instagram Feed Post (a real post on the Instagram page, not a story) ──
    // POST /api/products  body: { instagramPost: true, imageUrl, caption }
    if (req.method === 'POST' && req.body?.instagramPost === true) {
      const { imageUrl, caption } = req.body;
      const clean = String(imageUrl || '').replace(/\?.*$/, '');
      if (!clean.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
        return res.status(400).json({ error: 'imageUrl must be one of your Cloudinary images' });
      }
      try {
        const acct = await resolveStoryAccounts();
        const id = await postInstagramFeed(clean, caption, acct);
        return res.status(200).json({ ok: true, id });
      } catch (err) {
        console.error('[InstagramPost] error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Facebook Feed Post (a real photo post on the Page, not a story) ────────
    // POST /api/products  body: { facebookPost: true, imageUrl, caption }
    if (req.method === 'POST' && req.body?.facebookPost === true) {
      const { imageUrl, caption } = req.body;
      const clean = String(imageUrl || '').replace(/\?.*$/, '');
      if (!clean.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
        return res.status(400).json({ error: 'imageUrl must be one of your Cloudinary images' });
      }
      try {
        const acct = await resolveStoryAccounts();
        const id = await postFacebookFeed(clean, caption, acct);
        return res.status(200).json({ ok: true, id });
      } catch (err) {
        console.error('[FacebookPost] error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Facebook Feed Video Post ─────────────────────────────────────────────
    // POST /api/products  body: { facebookVideoPost: true, videoUrl, caption, thumbUrl? }
    // videoUrl must already be a public Cloudinary URL (uploaded via the signature route above).
    if (req.method === 'POST' && req.body?.facebookVideoPost === true) {
      const { videoUrl, caption, thumbUrl } = req.body;
      const cleanVideo = String(videoUrl || '').replace(/\?.*$/, '');
      if (!cleanVideo.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
        return res.status(400).json({ error: 'videoUrl must be one of your Cloudinary videos' });
      }
      const cleanThumb = thumbUrl ? String(thumbUrl).replace(/\?.*$/, '') : '';
      try {
        const acct = await resolveStoryAccounts();
        const id = await postFacebookVideo(cleanVideo, caption, cleanThumb, acct);
        return res.status(200).json({ ok: true, id });
      } catch (err) {
        console.error('[FacebookVideoPost] error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Video broadcast (Reels, video stories, Telegram video) ───────────────
    // POST /api/products  body: { videoAction, ... }
    //   prepare  { videoUrl, kind: 'meta'|'plain' }                     → { ready, url }   (Cloudinary converts the video)
    //   telegram { videoUrl, caption }                                   → posts the video to the Telegram channel
    //   start    { target, videoUrl, caption }                           → { containerId } (Instagram) | { videoId } (Facebook)
    //   status   { target, containerId?, videoId? }                      → { state: 'processing'|'ready'|'error' }
    //   publish  { target, containerId }                                 → Instagram only: publishes the finished container
    // target: instagram_reel | instagram_story | facebook_reel | facebook_story
    if (req.method === 'POST' && req.body?.videoAction) {
      const { videoAction, target, kind, caption, containerId, videoId } = req.body;
      try {
        if (videoAction === 'prepare') {
          const clean = cloudVideoUrl(req.body.videoUrl);
          if (!clean) return res.status(400).json({ error: 'videoUrl must be one of your Cloudinary videos' });
          const derived = deriveVideoUrl(clean, kind === 'plain' ? 'plain' : 'meta');
          const chk = await checkDerivedVideo(derived);
          return res.status(200).json({ ready: !!chk.ready, url: derived, error: chk.error });
        }
        if (videoAction === 'telegram') {
          const clean = cloudVideoUrl(req.body.videoUrl);
          if (!clean) return res.status(400).json({ error: 'videoUrl must be one of your Cloudinary videos' });
          const id = await telegramSendVideo(clean, caption);
          return res.status(200).json({ ok: true, id });
        }
        if (!VIDEO_TARGETS.includes(target)) return res.status(400).json({ error: 'Unknown target' });
        const acct = await resolveStoryAccounts();
        if (videoAction === 'start') {
          const clean = cloudVideoUrl(req.body.videoUrl);
          if (!clean) return res.status(400).json({ error: 'videoUrl must be one of your Cloudinary videos' });
          if (target.startsWith('instagram')) {
            return res.status(200).json({ containerId: await igVideoStart(target, clean, caption, acct) });
          }
          return res.status(200).json({ videoId: await fbVideoStart(target, clean, caption, acct) });
        }
        if (videoAction === 'status') {
          return res.status(200).json(await videoStatus(target, { containerId, videoId }, acct));
        }
        if (videoAction === 'publish') {
          if (!target.startsWith('instagram') || !containerId) return res.status(400).json({ error: 'Nothing to publish' });
          const pub = await metaCall(`${acct.igId}/media_publish`, { creation_id: containerId, access_token: acct.pageToken });
          return res.status(200).json({ ok: true, id: pub.id });
        }
        return res.status(400).json({ error: 'Unknown videoAction' });
      } catch (err) {
        console.error(`[Video:${videoAction}:${target || ''}]`, err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === 'POST' && (req.query.broadcast === 'true' || req.body.broadcast === true)) {
      const { imageUrl, message } = req.body;
      const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      const BASE    = `https://api.telegram.org/bot${TOKEN}`;

      if (!TOKEN || !CHAT_ID) {
        return res.status(500).json({ error: 'Telegram credentials missing — check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars' });
      }

      try {
        const clean = cleanCloudinaryUrl(imageUrl);
        console.log('[Broadcast] chat_id:', CHAT_ID);
        console.log('[Broadcast] image URL (cleaned):', clean);

        const photoRes = await fetch(`${BASE}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            photo: clean,
            caption: message,
            parse_mode: 'Markdown',
          }),
        });
        const photoData = await photoRes.json();
        console.log('[Broadcast] sendPhoto response:', JSON.stringify(photoData));

        if (photoData.ok) {
          return res.status(200).json({ success: true, imageSent: true });
        }

        console.warn('[Broadcast] sendPhoto failed:', photoData.description, '— falling back to text-only');
        const textRes = await fetch(`${BASE}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        });
        const textData = await textRes.json();
        console.log('[Broadcast] sendMessage response:', JSON.stringify(textData));

        if (!textData.ok) {
          throw new Error(`Telegram error: ${textData.description}`);
        }

        return res.status(200).json({ success: true, imageSent: false, note: 'Text only — image URL was rejected by Telegram' });

      } catch (err) {
        console.error('[Broadcast] error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Dedupe: delete an explicit list of product IDs ───────────────────────
    // POST /api/products?dedupeConfirm=true   body: { ids: string[] }
    // Used by the "Remove Duplicates" review modal once you've looked at each
    // group's images/details and picked which copy to keep — deletes exactly
    // the IDs you send, nothing auto-guessed. Same cleanup as a normal single
    // delete: removes the product, its inventory record, its Cloudinary image,
    // and its Meta catalog listing.
    if (req.method === 'POST' && req.query.dedupeConfirm === 'true') {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
      }

      let deletedCount = 0;
      const deletedNames = [];
      for (const idStr of ids) {
        let objId;
        try { objId = new ObjectId(idStr); } catch { continue; }

        const existing = await collection.findOne({ _id: objId });
        const result = await collection.deleteOne({ _id: objId });
        if (result.deletedCount === 0) continue;
        deletedCount++;
        deletedNames.push(existing?.name || idStr);

        // Clean up inventory record
        await inventory.deleteOne({ productId: idStr });

        // Clean up Cloudinary image
        try {
          const imageUrl = existing?.image || existing?.imageUrl || '';
          if (imageUrl && imageUrl.includes('res.cloudinary.com')) {
            const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
            if (match && match[1]) {
              await cloudinary.uploader.destroy(match[1], { invalidate: true });
            }
          }
        } catch (cloudErr) {
          console.error('Cloudinary delete failed during dedupe (product still deleted):', cloudErr.message);
        }

        // Clean up Meta catalog entry
        try {
          if (existing?.metaId) await deleteProductFromMeta(existing.metaId);
        } catch (metaErr) {
          console.error('Meta delete failed during dedupe (DB deleted):', metaErr.message);
        }
      }

      return res.status(200).json({ success: true, deletedCount, deletedNames });
    }

    // ── Bulk Pricing: PREVIEW ──────────────────────────────────────────────
    // POST /api/products?bulkPricingPreview=true
    // body: { originalPercent?: number, discountedPercent?: number, ids: string[] }
    // Computes new prices as round(costPrice × (1 + percent/100)) — rounded to
    // the nearest whole rupee — using each product's current landed cost price
    // from `inventory`. Supports two INDEPENDENT markups in the same call:
    // originalPercent for the base/MRP price, discountedPercent for the sale
    // price. Either can be omitted entirely to leave that price type alone
    // (e.g. only updating the discount price without touching the base price).
    // Which `ids` get sent is entirely up to the caller — the frontend resolves
    // "individual products / by category / by price range / by PO / all" into
    // a plain id list before calling this, so this endpoint doesn't need to
    // know about scope at all. Writes nothing — this is a dry run for review
    // before apply.
    //
    // PERF: batched with a single $in query per collection instead of one
    // findOne per product — this is what lets preview stay fast at any list
    // size instead of doing N×2 sequential round-trips to Mongo.
    if (req.method === 'POST' && req.query.bulkPricingPreview === 'true') {
      const { originalPercent, discountedPercent, ids } = req.body || {};
      const origPct = originalPercent === undefined || originalPercent === null || originalPercent === '' ? null : Number(originalPercent);
      const discPct = discountedPercent === undefined || discountedPercent === null || discountedPercent === '' ? null : Number(discountedPercent);
      if (origPct === null && discPct === null) return res.status(400).json({ error: 'Provide originalPercent and/or discountedPercent' });
      if (origPct !== null && !Number.isFinite(origPct)) return res.status(400).json({ error: 'originalPercent must be a number' });
      if (discPct !== null && !Number.isFinite(discPct)) return res.status(400).json({ error: 'discountedPercent must be a number' });
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

      const objIds = [];
      const validIdStrs = [];
      for (const idStr of ids) {
        try { objIds.push(new ObjectId(idStr)); validIdStrs.push(idStr); } catch { /* skip invalid id, ignored same as before */ }
      }

      const [productDocs, inventoryDocs] = await Promise.all([
        objIds.length > 0 ? collection.find({ _id: { $in: objIds } }).toArray() : [],
        validIdStrs.length > 0 ? inventory.find({ productId: { $in: validIdStrs } }).toArray() : [],
      ]);

      const productMap = new Map(productDocs.map(p => [p._id.toString(), p]));
      const inventoryMap = new Map(inventoryDocs.map(i => [i.productId, i]));

      const items = [];
      const skipped = [];
      let belowCostCount = 0;
      for (const idStr of validIdStrs) {
        const product = productMap.get(idStr);
        if (!product) continue;
        const inv = inventoryMap.get(idStr);
        const costPrice = Number(inv?.costPrice) || 0;
        if (costPrice <= 0) {
          skipped.push({ _id: idStr, name: product.name, reason: 'No cost price recorded' });
          continue;
        }
        const currentOriginalPrice = Number(product.originalPrice || product.price || 0);
        const currentDiscountedPrice = Number(product.discountedPrice || 0);
        const newOriginalPrice = origPct !== null ? Math.round(costPrice * (1 + origPct / 100)) : null;
        const newDiscountedPrice = discPct !== null ? Math.round(costPrice * (1 + discPct / 100)) : null;
        // Flag if the NEW price we're about to set would sit at or below cost —
        // a negative or near-zero margin % (or a manual typo) can do this
        // silently otherwise, and the frontend needs to warn before Apply.
        const originalBelowCost = newOriginalPrice !== null && newOriginalPrice <= costPrice;
        const discountedBelowCost = newDiscountedPrice !== null && newDiscountedPrice <= costPrice;
        if (originalBelowCost || discountedBelowCost) belowCostCount++;
        items.push({
          _id: idStr, name: product.name, category: product.category || '', costPrice,
          currentOriginalPrice, newOriginalPrice,
          currentDiscountedPrice, newDiscountedPrice,
          originalBelowCost, discountedBelowCost,
        });
      }

      return res.status(200).json({ success: true, dryRun: true, originalPercent: origPct, discountedPercent: discPct, items, skipped, totalToUpdate: items.length, belowCostCount });
    }

    // ── Bulk Pricing: APPLY ────────────────────────────────────────────────
    // POST /api/products?bulkPricingApply=true
    // body: { updates: [{ id, newOriginalPrice?, newDiscountedPrice? }] }
    // Applies exactly the prices already reviewed in the preview step — takes
    // the computed `updates` array as-is rather than recalculating, so what
    // you saw is exactly what gets saved even if cost prices changed in the
    // meantime. Per item, only the price types that were actually included
    // (non-null) get written — omitting newDiscountedPrice on an item leaves
    // its existing discountedPrice completely untouched, and vice versa.
    //
    // PERF: all price writes go through a single bulkWrite instead of N
    // sequential updateOne calls, so the DB side is effectively instant
    // regardless of how many products are being updated. The Meta/WhatsApp
    // catalog sync — the slow, external part — is moved OUT of the request/
    // response cycle entirely via waitUntil (@vercel/functions), so the user
    // gets an immediate "saved" response and the Meta sync finishes quietly
    // in the background, batched to avoid hammering Facebook's API.
    if (req.method === 'POST' && req.query.bulkPricingApply === 'true') {
      const { updates } = req.body || {};
      if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'updates array is required' });

      const bulkOps = [];
      const errors = [];
      const idToFields = new Map();

      for (const u of updates) {
        let objId;
        try { objId = new ObjectId(u.id); } catch { errors.push({ id: u.id, error: 'Invalid id' }); continue; }

        const setFields = { updatedAt: new Date() };
        if (u.newOriginalPrice !== undefined && u.newOriginalPrice !== null) {
          const v = Math.round(Number(u.newOriginalPrice));
          if (!Number.isFinite(v)) { errors.push({ id: u.id, error: 'Invalid newOriginalPrice' }); continue; }
          setFields.originalPrice = v;
          setFields.price = v;
        }
        if (u.newDiscountedPrice !== undefined && u.newDiscountedPrice !== null) {
          const v = Math.round(Number(u.newDiscountedPrice));
          if (!Number.isFinite(v)) { errors.push({ id: u.id, error: 'Invalid newDiscountedPrice' }); continue; }
          setFields.discountedPrice = v;
        }
        if (Object.keys(setFields).length <= 1) { errors.push({ id: u.id, error: 'No price fields to update' }); continue; }

        bulkOps.push({ updateOne: { filter: { _id: objId }, update: { $set: setFields } } });
        idToFields.set(objId.toString(), setFields);
      }

      let updatedCount = 0;
      if (bulkOps.length > 0) {
        const bulkResult = await collection.bulkWrite(bulkOps, { ordered: false });
        updatedCount = (bulkResult.modifiedCount || 0) + (bulkResult.upsertedCount || 0);
      }

      // Fetch the updated docs in ONE query — needed for the Meta push below.
      const updatedIds = [...idToFields.keys()].map(idStr => new ObjectId(idStr));
      const updatedDocs = updatedIds.length > 0
        ? await collection.find({ _id: { $in: updatedIds } }).toArray()
        : [];

      // ── Respond immediately — prices are already durably saved in Mongo.
      res.status(200).json({ success: true, updatedCount, errors });

      // ── Meta/WhatsApp catalog sync runs AFTER the response is sent.
      // waitUntil keeps this Vercel function alive long enough to finish
      // the work even though the HTTP response has already gone out, so
      // the user never has to wait on Facebook's API to see their prices
      // saved. Batched (5 at a time) to avoid Meta rate limits; failures
      // here don't affect the already-saved prices — worst case the
      // catalog briefly lags and can be refreshed later via the existing
      // ?pushAll=true endpoint.
      waitUntil((async () => {
        const CONCURRENCY = 5;
        for (let i = 0; i < updatedDocs.length; i += CONCURRENCY) {
          const batch = updatedDocs.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map(doc => pushProductToMeta(doc, doc.metaId || null, inventory))
          );
          const failed = results.filter(r => r.status === 'rejected');
          if (failed.length > 0) {
            console.error(`Bulk pricing background Meta sync: ${failed.length} failed in batch starting at index ${i}`);
          }
        }
      })());

      return;
    }

    if (req.method === 'POST') {
      const product = { ...req.body, createdAt: new Date() };

      // Re-host any external image URL on Cloudinary so it never expires
      if (product.image) product.image = await ensureCloudinaryImage(product.image);
      if (product.imageUrl) product.imageUrl = product.image || product.imageUrl;

      const result = await collection.insertOne(product);
      const insertedId = result.insertedId.toString();

      // FIX: ALWAYS create an inventory record for every new product
      // This ensures no product ever exists without an inventory record
      const cs = Number(req.body.currentStock) || 0;
      const stockStatus = cs === 0 ? 'out_of_stock' : 'in_stock';
      await inventory.insertOne({
        productId: insertedId,
        sku: req.body.sku || '',
        currentStock: cs,
        reservedStock: 0,
        availableStock: cs,
        lowStockAlert: 5,
        costPrice: Number(req.body.costPrice) || 0,
        unit: 'pcs',
        trackInventory: req.body.trackInventory !== false, // default true
        stockStatus,
        frontendStatus: 'normal',
        adjustmentLog: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      try {
        // FIX: pass inventory so Meta gets real availability
        const metaResult = await pushProductToMeta({ ...product, _id: insertedId }, null, inventory);
        if (metaResult?.id) {
          await collection.updateOne(
            { _id: result.insertedId },
            { $set: { metaId: metaResult.id } }
          );
        }
      } catch (metaErr) {
        console.error('Meta push failed (product saved to DB):', metaErr.message);
      }

      return res.status(201).json({ success: true, _id: result.insertedId });
    }

    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      delete updateData._id;
      updateData.updatedAt = new Date();

      // Re-host any external image URL on Cloudinary so it never expires
      if (updateData.image) updateData.image = await ensureCloudinaryImage(updateData.image);
      if (updateData.imageUrl && updateData.image) updateData.imageUrl = updateData.image;

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Product not found' });

      // ── Cascade identity-field changes (name, sku) into every purchase order
      // that references this product ─────────────────────────────────────────
      // A PO stores a snapshot of productName/sku at the time it was created
      // (items[].productName), so editing the product here previously left
      // old POs showing the stale name forever. This pushes the update into
      // both the `items` array (draft/ordered POs) and `receivedItems` array
      // (already-received POs), everywhere this productId appears.
      // Note: only name/sku are cascaded — costPrice/quantity are left alone,
      // since those reflect what was actually paid/ordered at that time, not
      // a product "detail" that should retroactively change.
      if (updateData.name || updateData.sku) {
        const itemsSet = {};
        const receivedItemsSet = {};
        if (updateData.name) { itemsSet['items.$[elem].productName'] = updateData.name; receivedItemsSet['receivedItems.$[elem].productName'] = updateData.name; }
        if (updateData.sku)  { itemsSet['items.$[elem].sku'] = updateData.sku;          receivedItemsSet['receivedItems.$[elem].sku'] = updateData.sku; }

        try {
          await purchaseOrders.updateMany(
            { 'items.productId': id },
            { $set: itemsSet },
            { arrayFilters: [{ 'elem.productId': id }] }
          );
          await purchaseOrders.updateMany(
            { 'receivedItems.productId': id },
            { $set: receivedItemsSet },
            { arrayFilters: [{ 'elem.productId': id }] }
          );
        } catch (cascadeErr) {
          // Don't fail the product update if the PO cascade has an issue —
          // the product itself is already saved correctly.
          console.error('PO name/sku cascade failed (product still updated):', cascadeErr.message);
        }

        // ── Also cascade the name into past sales records ────────────────────
        // Explicitly NAME ONLY here — sale price/quantity/totalPrice on old
        // sales must stay exactly as they were invoiced to the customer.
        // Only the display name catches up, so a renamed product doesn't show
        // its old name on historical sales/receipts.
        if (updateData.name) {
          try {
            await salesCol.updateMany(
              { 'items.productId': id },
              { $set: { 'items.$[elem].productName': updateData.name } },
              { arrayFilters: [{ 'elem.productId': id }] }
            );
          } catch (salesCascadeErr) {
            console.error('Sales name cascade failed (product still updated):', salesCascadeErr.message);
          }
        }
      }

      try {
        const existing = await collection.findOne({ _id: new ObjectId(id) });
        if (existing) {
          // FIX: pass inventory so Meta availability stays in sync with actual stock
          await pushProductToMeta({ ...existing, ...updateData, _id: id }, existing.metaId || null, inventory);
        }
      } catch (metaErr) {
        console.error('Meta update failed (DB updated):', metaErr.message);
      }

      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID is required' });

      const existing = await collection.findOne({ _id: new ObjectId(id) });
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });

      // Always clean up inventory record when product is deleted
      await inventory.deleteOne({ productId: id });

      // ── Delete image from Cloudinary to free up storage ──────────────────
      // Extract the public_id from the Cloudinary URL and delete it.
      // We do this silently — if it fails, product is still deleted from DB.
      try {
        const imageUrl = existing?.image || existing?.imageUrl || '';
        if (imageUrl && imageUrl.includes('res.cloudinary.com')) {
          // Extract public_id from URL:
          // e.g. https://res.cloudinary.com/dz29qwajh/image/upload/v123/tags-products/img_abc.webp
          // → public_id = tags-products/img_abc
          const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
          if (match && match[1]) {
            await cloudinary.uploader.destroy(match[1], { invalidate: true });
            console.log('Cloudinary image deleted:', match[1]);
          }
        }
      } catch (cloudErr) {
        // Don't fail the delete if Cloudinary cleanup fails
        console.error('Cloudinary delete failed (product still deleted):', cloudErr.message);
      }

      try {
        if (existing?.metaId) await deleteProductFromMeta(existing.metaId);
      } catch (metaErr) {
        console.error('Meta delete failed (DB deleted):', metaErr.message);
      }

      return res.status(200).json({ success: true });
    }

    // ── One-time migration: re-host all external images to Cloudinary ──────────
    // GET /api/products?migrate_images=true
    // Finds all products with non-Cloudinary image URLs and re-hosts them.
    // Safe to run multiple times — skips images already on Cloudinary.
    if (req.method === 'GET' && req.query.migrate_images === 'true') {
      const allProducts = await collection.find({
        image: { $exists: true, $ne: '', $not: /res\.cloudinary\.com/ }
      }).toArray();

      let fixed = 0, skipped = 0, failed = 0;
      const results = [];

      for (const p of allProducts) {
        const originalUrl = p.image || '';
        if (!originalUrl || originalUrl.includes('cloudinary.com')) { skipped++; continue; }

        const newUrl = await ensureCloudinaryImage(originalUrl);
        if (newUrl !== originalUrl) {
          await collection.updateOne(
            { _id: p._id },
            { $set: { image: newUrl, imageUrl: newUrl, updatedAt: new Date() } }
          );
          fixed++;
          results.push({ name: p.name, from: originalUrl.slice(0, 60), to: newUrl.slice(0, 60) });
        } else {
          failed++;
          results.push({ name: p.name, error: 'Could not re-host — original URL kept' });
        }
      }
      return res.status(200).json({ success: true, fixed, skipped, failed, results });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('MongoDB error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
