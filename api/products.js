import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.TAGS_MONGO;
let client;

async function getClient() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client;
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
      const { id, withStock } = req.query;

      // Single product by ID
      if (id) {
        const product = await collection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // Always attach stock info to single product fetch
        const stock = await inventory.findOne({ productId: id });
        product.stock = stock
          ? {
              available: stock.availableStock,
              total: stock.currentStock,
              reserved: stock.reservedStock,
              isInStock: stock.availableStock > 0,
              lowStock: stock.trackInventory && stock.availableStock <= stock.lowStockAlert && stock.availableStock > 0,
              trackInventory: stock.trackInventory,
              sku: stock.sku,
            }
          : { available: null, isInStock: true, trackInventory: false };

        return res.status(200).json(product);
      }

      // All products
      const products = await collection.find({}).sort({ createdAt: -1 }).toArray();

      // Attach stock to every product if withStock=true (for admin panel)
      // On the public website, stock is fetched per-product to keep it fast
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
                  lowStock: stock.trackInventory && stock.availableStock <= stock.lowStockAlert && stock.availableStock > 0,
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

      // Auto-create inventory entry with 0 stock if trackInventory requested
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
