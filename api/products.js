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
      const { id, withStock, syncMeta } = req.query;

      // ── Meta Sync ──────────────────────────────────────────────
      if (syncMeta === 'true') {
        const result = await syncMetaToMongo(collection);
        return res.status(200).json({
          success: true,
          message: `Synced ${result.synced} of ${result.total} products from Meta catalog`,
          ...result,
        });
      }

      // ── Single product by ID ───────────────────────────────────
      if (id) {
        const product = await collection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const stock = await inventory.findOne({ productId: id });
        product.stock = stock
          ? {
              available: stock.availableStock,
              total: stock.currentStock,
              reserved: stock.reservedStock,
              isInStock: stock.availableStock > 0,
              isLowStock: stock.trackInventory && stock.availableStock <= stock.lowStockAlert && stock.availableStock > 0,
              availableStock: stock.availableStock,
              trackInventory: stock.trackInventory,
              sku: stock.sku,
            }
          : { available: null, isInStock: true, trackInventory: false };

        return res.status(200).json(product);
      }

      // ── All products ───────────────────────────────────────────
      const products = await collection.find({}).sort({ createdAt: -1 }).toArray();

      if (withStock === 'true') {
        const enriched = await Promise.all(
          products.map(async (p) => {
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
                  trackInventory: stock.trackInventory,
                  sku: stock.sku,
                }
              : { available: null, isInStock: true, trackInventory: false };
            return p;
          })
        );
        return res.status(200).json(enriched);
      }

      return res.status(200).json(products);
    }

    if (req.method === 'POST') {
      const product = { ...req.body, createdAt: new Date() };
      const result = await collection.insertOne(product);

      if (req.body.trackInventory) {
        await inventory.insertOne({
          productId: result.insertedId.toString(),
          sku: req.body.sku || '',
          currentStock: 0,
          reservedStock: 0,
          availableStock: 0,
          lowStockAlert: 10,
          costPrice: Number(req.body.costPrice) || 0,
          unit: 'pcs',
          trackInventory: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
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
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('MongoDB error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
