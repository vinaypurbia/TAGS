import { MongoClient, ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { waitUntil } from '@vercel/functions';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const collection = db.collection('products');
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
