import { MongoClient, ObjectId } from 'mongodb';

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

async function pushProductToMeta(product, metaId = null) {
  if (!META_ACCESS_TOKEN) return null;

  const price = parseFloat(product.discountedPrice || product.originalPrice || product.price || 0);
  const originalPrice = parseFloat(product.originalPrice || product.price || 0);
  const priceInPaise = Math.round(price * 100);
  const originalPriceInPaise = Math.round(originalPrice * 100);

  const body = {
    name: product.name,
    description: product.description || product.name,
    availability: 'in stock',
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
          availability: mp.availability || 'in stock',
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

// ── Helper: enrich a product with its stock data ──────────────────────────────
// FIX: now returns frontendStatus and stockStatus so frontend can act on them
async function enrichWithStock(p, inventory) {
  const pid = p._id.toString();
  const stock = await inventory.findOne({ productId: pid });
  p.stock = stock
    ? {
        available: stock.availableStock,
        total: stock.currentStock,
        reserved: stock.reservedStock,
        isInStock: stock.availableStock > 0,
        isLowStock: stock.trackInventory && stock.availableStock <= stock.lowStockAlert && stock.availableStock > 0,
        availableStock: stock.availableStock,
        lowStockAlert: stock.lowStockAlert || 10,
        trackInventory: stock.trackInventory,
        sku: stock.sku,
        costPrice: stock.costPrice || 0,
        stockStatus: stock.stockStatus || 'in_stock',
        frontendStatus: stock.frontendStatus || 'normal',  // FIX: returned to frontend
      }
    : {
        available: null,
        isInStock: true,
        trackInventory: false,
        stockStatus: 'in_stock',
        frontendStatus: 'normal',
      };
  return p;
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
        adminView  // FIX: ?adminView=true skips hidden filter (for admin panel)
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
            const metaResult = await pushProductToMeta(
              { ...product, _id: pid },
              product.metaId || null
            );
            results.push({ name: product.name, metaResponse: metaResult });
            if (metaResult?.error) {
              failed++;
              errors.push({ name: product.name, error: metaResult.error.message });
            } else {
              if (metaResult?.id) {
                await collection.updateOne(
                  { _id: product._id },
                  { $set: { metaId: metaResult.id } }
                );
              }
              pushed++;
            }
          } catch (err) {
            failed++;
            errors.push({ name: product.name, error: err.message });
          }
        }

        return res.status(200).json({
          success: true,
          message: `Pushed ${pushed} of ${allProducts.length} products to Meta/WhatsApp catalog`,
          pushed, failed, total: allProducts.length,
          errors: errors.length > 0 ? errors : undefined,
          results,
        });
      }

      // ── Single product by ID ───────────────────────────────────
      if (id) {
        const product = await collection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        await enrichWithStock(product, inventory);
        return res.status(200).json(product);
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

      // FIX: Always enrich with stock now (needed to read frontendStatus for filtering)
      // adminView=true skips the hidden filter so admin sees everything
      const enriched = await Promise.all(
        products.map(p => enrichWithStock(p, inventory))
      );

      // FIX: Filter out hidden products from customer-facing catalog
      // adminView=true bypasses this so the admin panel always sees all products
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
    if (req.method === 'POST' && req.query.broadcast === 'true') {
      const { imageUrl, message } = req.body;
      const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      const BASE    = `https://api.telegram.org/bot${TOKEN}`;

      // Clean Cloudinary URL — remove transformation params so Telegram can fetch it
      const cleanImageUrl = (url) => {
        if (!url) return '';
        try {
          // Remove Cloudinary transformations between /upload/ and the filename
          // e.g. /upload/w_800,h_800,c_limit,q_auto/v123/filename.jpg → /upload/v123/filename.jpg
          let clean = url.replace(/\/upload\/(?:[^/]+\/)+(?=v\d+\/)/, '/upload/');
          // If no version number, just strip everything between /upload/ and the filename
          clean = clean.replace(/\/upload\/[a-z0-9_,]+\/(?!v\d)/, '/upload/');
          // Force jpg extension for webp/avif
          clean = clean.replace(/\.(webp|avif)(\?.*)?$/, '.jpg');
          return clean;
        } catch {
          return url;
        }
      };

      try {
        let imageSent = false;
        if (imageUrl) {
          const clean = cleanImageUrl(imageUrl);
          console.log('Sending image URL to Telegram:', clean);

          const pr = await fetch(`${BASE}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, photo: clean }),
          });
          const pd = await pr.json();

          if (pd.ok) {
            imageSent = true;
            await new Promise(r => setTimeout(r, 600));
          } else {
            // Log but don't fail — still send the text message
            console.warn('Telegram image failed:', pd.description, '| URL:', clean);
          }
        }

        const tr = await fetch(`${BASE}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        });
        const td = await tr.json();
        if (!td.ok) throw new Error(`Message error: ${td.description}`);

        return res.status(200).json({ success: true, imageSent });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === 'POST') {
      const product = { ...req.body, createdAt: new Date() };
      const result = await collection.insertOne(product);
      const insertedId = result.insertedId.toString();

      if (req.body.trackInventory) {
        const cs = Number(req.body.currentStock) || 0;
        // FIX: compute stockStatus on product creation
        const stockStatus = cs === 0 ? 'out_of_stock' : 'in_stock';
        await inventory.insertOne({
          productId: insertedId,
          sku: req.body.sku || '',
          currentStock: cs,
          reservedStock: 0,
          availableStock: cs,
          lowStockAlert: 10,
          costPrice: Number(req.body.costPrice) || 0,
          unit: 'pcs',
          trackInventory: true,
          stockStatus,
          frontendStatus: 'normal',   // FIX: default visibility
          adjustmentLog: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      try {
        const metaResult = await pushProductToMeta({ ...product, _id: insertedId });
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

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Product not found' });

      try {
        const existing = await collection.findOne({ _id: new ObjectId(id) });
        if (existing) {
          await pushProductToMeta({ ...existing, ...updateData, _id: id }, existing.metaId || null);
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

      // Also clean up inventory record
      await inventory.deleteOne({ productId: id });

      try {
        if (existing?.metaId) await deleteProductFromMeta(existing.metaId);
      } catch (metaErr) {
        console.error('Meta delete failed (DB deleted):', metaErr.message);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('MongoDB error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
