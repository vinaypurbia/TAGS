import { MongoClient, ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';

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
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
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

    if (req.method === 'GET') {
      const {
        id, withStock, syncMeta, pushAll,
        page, limit, category, subcategory, search,
        adminView
      } = req.query;

      // ── Special ops ───────────────────────────────────────────
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

      // ── PAGINATED product list ─────────────────────────────────
      const pageNum  = Math.max(1, parseInt(page  || '1',  10));
      const pageSize = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
      const skip     = (pageNum - 1) * pageSize;

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

      const products = await collection
        .find(mongoFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray();

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
        hasMore: skip + products.length < total,
      });
    }

    // ── Telegram Broadcast ───────────────────────────────────────────────────
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
