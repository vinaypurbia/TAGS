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
    const inventory = db.collection('inventory');
    const movements = db.collection('stockMovements');
    const products = db.collection('products');

    // ─────────────────────────────────────────────
    // GET /api/inventory
    // ?productId=xxx  → single product stock
    // ?lowStock=true  → only low stock items
    // (no query)      → all inventory with product info joined
    // ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const { productId, lowStock, movements: showMovements } = req.query;

      // Get stock movements for a product
      if (showMovements && productId) {
        const logs = await movements
          .find({ productId })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray();
        return res.status(200).json(logs);
      }

      // Get single product inventory
      if (productId) {
        const item = await inventory.findOne({ productId });
        if (!item) {
          return res.status(200).json({
            productId,
            currentStock: 0,
            reservedStock: 0,
            availableStock: 0,
            lowStockAlert: 10,
            costPrice: 0,
            trackInventory: false
          });
        }
        return res.status(200).json(item);
      }

      // Get all inventory — join with product name & image
      const allInventory = await inventory.find({}).toArray();

      // Enrich with product details
      const enriched = await Promise.all(
        allInventory.map(async (item) => {
          try {
            const product = await products.findOne(
              { _id: new ObjectId(item.productId) },
              { projection: { name: 1, imageUrls: 1, category: 1 } }
            );
            return {
              ...item,
              productName: product?.name || 'Unknown Product',
              productImage: product?.imageUrls?.[0] || null,
              productCategory: product?.category || '',
            };
          } catch {
            return { ...item, productName: 'Unknown Product', productImage: null };
          }
        })
      );

      // Filter low stock only
      if (lowStock === 'true') {
        const low = enriched.filter(
          (i) => i.trackInventory && i.availableStock <= i.lowStockAlert
        );
        return res.status(200).json(low);
      }

      return res.status(200).json(enriched);
    }

    // ─────────────────────────────────────────────
    // POST /api/inventory
    // Create inventory entry for a product
    // Body: { productId, sku, currentStock, lowStockAlert, costPrice, unit }
    // ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const {
        productId,
        sku = '',
        currentStock = 0,
        lowStockAlert = 10,
        costPrice = 0,
        unit = 'pcs',
        trackInventory = true,
      } = req.body;

      if (!productId) return res.status(400).json({ error: 'productId is required' });

      // Check if already exists
      const existing = await inventory.findOne({ productId });
      if (existing) {
        return res.status(409).json({ error: 'Inventory entry already exists for this product. Use PUT to update.' });
      }

      const availableStock = Math.max(0, currentStock);

      const newEntry = {
        productId,
        sku,
        currentStock,
        reservedStock: 0,
        availableStock,
        lowStockAlert,
        costPrice,
        unit,
        trackInventory,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await inventory.insertOne(newEntry);

      // Log initial stock movement if stock > 0
      if (currentStock > 0) {
        await movements.insertOne({
          productId,
          type: 'in',
          quantity: currentStock,
          reason: 'initial_stock',
          referenceId: null,
          balanceBefore: 0,
          balanceAfter: currentStock,
          note: 'Initial stock setup',
          createdAt: new Date(),
        });
      }

      return res.status(201).json({ success: true, _id: result.insertedId });
    }

    // ─────────────────────────────────────────────
    // PUT /api/inventory
    // Three actions via body.action:
    //   "update"     → update settings (lowStockAlert, costPrice, sku etc.)
    //   "adjust"     → manual stock adjustment (add or remove)
    //   "reserve"    → reserve stock for an order
    //   "release"    → release reserved stock (order cancelled)
    //   "fulfill"    → fulfill reserved stock (order completed)
    // ─────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { action, productId } = req.body;

      if (!productId) return res.status(400).json({ error: 'productId is required' });

      const item = await inventory.findOne({ productId });
      if (!item) return res.status(404).json({ error: 'Inventory entry not found' });

      // ── Update settings ──
      if (action === 'update' || !action) {
        const { sku, lowStockAlert, costPrice, unit, trackInventory } = req.body;
        const updateFields = { updatedAt: new Date() };
        if (sku !== undefined) updateFields.sku = sku;
        if (lowStockAlert !== undefined) updateFields.lowStockAlert = Number(lowStockAlert);
        if (costPrice !== undefined) updateFields.costPrice = Number(costPrice);
        if (unit !== undefined) updateFields.unit = unit;
        if (trackInventory !== undefined) updateFields.trackInventory = trackInventory;

        await inventory.updateOne({ productId }, { $set: updateFields });
        return res.status(200).json({ success: true });
      }

      // ── Manual stock adjustment ──
      if (action === 'adjust') {
        const { quantity, note = '', reason = 'manual' } = req.body;
        const qty = Number(quantity);
        if (isNaN(qty)) return res.status(400).json({ error: 'quantity must be a number (positive=add, negative=remove)' });

        const balanceBefore = item.currentStock;
        const newStock = Math.max(0, item.currentStock + qty);
        const newAvailable = Math.max(0, item.availableStock + qty);

        await inventory.updateOne(
          { productId },
          { $set: { currentStock: newStock, availableStock: newAvailable, updatedAt: new Date() } }
        );

        await movements.insertOne({
          productId,
          type: qty >= 0 ? 'in' : 'out',
          quantity: Math.abs(qty),
          reason,
          referenceId: null,
          balanceBefore,
          balanceAfter: newStock,
          note,
          createdAt: new Date(),
        });

        return res.status(200).json({ success: true, newStock, newAvailable });
      }

      // ── Reserve stock (when order placed) ──
      if (action === 'reserve') {
        const { quantity, orderId } = req.body;
        const qty = Number(quantity);
        if (item.availableStock < qty) {
          return res.status(400).json({ error: 'Insufficient stock', available: item.availableStock });
        }

        await inventory.updateOne(
          { productId },
          {
            $set: {
              reservedStock: item.reservedStock + qty,
              availableStock: item.availableStock - qty,
              updatedAt: new Date(),
            },
          }
        );

        await movements.insertOne({
          productId,
          type: 'reserved',
          quantity: qty,
          reason: 'order_placed',
          referenceId: orderId || null,
          balanceBefore: item.availableStock,
          balanceAfter: item.availableStock - qty,
          note: `Reserved for order ${orderId || ''}`,
          createdAt: new Date(),
        });

        return res.status(200).json({ success: true });
      }

      // ── Release reserved stock (order cancelled) ──
      if (action === 'release') {
        const { quantity, orderId } = req.body;
        const qty = Number(quantity);

        await inventory.updateOne(
          { productId },
          {
            $set: {
              reservedStock: Math.max(0, item.reservedStock - qty),
              availableStock: item.availableStock + qty,
              updatedAt: new Date(),
            },
          }
        );

        await movements.insertOne({
          productId,
          type: 'returned',
          quantity: qty,
          reason: 'order_cancelled',
          referenceId: orderId || null,
          balanceBefore: item.availableStock,
          balanceAfter: item.availableStock + qty,
          note: `Released from cancelled order ${orderId || ''}`,
          createdAt: new Date(),
        });

        return res.status(200).json({ success: true });
      }

      // ── Fulfill (order shipped — remove from reserved & current) ──
      if (action === 'fulfill') {
        const { quantity, orderId } = req.body;
        const qty = Number(quantity);

        await inventory.updateOne(
          { productId },
          {
            $set: {
              currentStock: Math.max(0, item.currentStock - qty),
              reservedStock: Math.max(0, item.reservedStock - qty),
              updatedAt: new Date(),
            },
          }
        );

        await movements.insertOne({
          productId,
          type: 'out',
          quantity: qty,
          reason: 'sale',
          referenceId: orderId || null,
          balanceBefore: item.currentStock,
          balanceAfter: Math.max(0, item.currentStock - qty),
          note: `Fulfilled order ${orderId || ''}`,
          createdAt: new Date(),
        });

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // ─────────────────────────────────────────────
    // DELETE /api/inventory
    // Body: { productId }
    // ─────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { productId } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });

      await inventory.deleteOne({ productId });
      await movements.deleteMany({ productId }); // clean up logs too

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Inventory API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
