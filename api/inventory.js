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
    const inventoryCol = db.collection('inventory');
    const productsCol = db.collection('products');

    // GET - all products with their inventory
    if (req.method === 'GET') {
      const { action } = req.query;

      // ── BULK ENABLE TRACKING ──────────────────────────────────────────
      // GET /api/inventory?action=enableAll
      // Creates inventory records for all products and enables trackInventory
      // ── BACKFILL FROM DELIVERED ORDERS ───────────────────────────────────
      // GET /api/inventory?action=backfillDelivered
      // Reads all delivered orders and deducts their quantities from inventory
      // Only deducts if the order hasn't already been backfilled (checks adjustmentLog)
      if (action === 'backfillDelivered') {
        const ordersCol = db.collection('orders');
        const deliveredOrders = await ordersCol.find({ status: 'delivered' }).toArray();

        let totalDeducted = 0;
        let skipped = 0;
        const log = [];

        for (const order of deliveredOrders) {
          if (!order.items?.length) continue;
          const orderRef = order.orderId || order._id.toString();

          for (const item of order.items) {
            const pid = item.productId;
            if (!pid) continue;

            const inv = await inventoryCol.findOne({ productId: pid });
            if (!inv || inv.trackInventory === false) { skipped++; continue; }

            // Check if this order was already deducted (avoid double deduction)
            const alreadyDone = (inv.adjustmentLog || []).some(
              (l) => l.reason && l.reason.includes(orderRef)
            );
            if (alreadyDone) { skipped++; continue; }

            const qty = Number(item.quantity) || 1;
            const newStock = Math.max(0, (inv.currentStock || 0) - qty);
            const available = Math.max(0, newStock - (inv.reservedStock || 0));

            await inventoryCol.updateOne(
              { productId: pid },
              {
                $set: { currentStock: newStock, availableStock: available, updatedAt: new Date() },
                $push: {
                  adjustmentLog: {
                    adjustment: -qty,
                    reason: `Backfill – Order ${orderRef} (${order.customerName})`,
                    date: order.deliveredAt || order.updatedAt || new Date(),
                    stockAfter: newStock,
                  }
                }
              }
            );
            totalDeducted++;
            log.push({ order: orderRef, product: item.productName || pid, qty: -qty, stockAfter: newStock });
          }
        }

        return res.status(200).json({
          success: true,
          message: `Backfill complete. ${totalDeducted} deduction(s) applied, ${skipped} skipped (already done or untracked).`,
          totalDeducted,
          skipped,
          log,
        });
      }

      if (action === 'enableAll') {
        const allProducts = await productsCol.find({}).toArray();
        let created = 0, updated = 0;

        for (const p of allProducts) {
          const pid = p._id.toString();
          const existing = await inventoryCol.findOne({ productId: pid });

          if (existing) {
            // Already exists — just enable tracking if it was off
            if (existing.trackInventory === false) {
              await inventoryCol.updateOne(
                { productId: pid },
                { $set: { trackInventory: true, updatedAt: new Date() } }
              );
              updated++;
            }
          } else {
            // No record yet — create one with tracking on, stock at 0
            await inventoryCol.insertOne({
              productId: pid,
              sku: '',
              currentStock: 0,
              reservedStock: 0,
              availableStock: 0,
              lowStockAlert: 5,
              costPrice: 0,
              unit: 'pcs',
              trackInventory: true,
              adjustmentLog: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            created++;
          }
        }

        return res.status(200).json({
          success: true,
          message: `Tracking enabled for all products. ${created} records created, ${updated} records updated.`,
          created,
          updated,
          total: allProducts.length,
        });
      }

      const allProducts = await productsCol.find({}).sort({ createdAt: -1 }).toArray();
      const allInventory = await inventoryCol.find({}).toArray();

      const inventoryMap = {};
      allInventory.forEach(item => { inventoryMap[item.productId] = item; });

      const result = allProducts.map(p => {
        const pid = p._id.toString();
        const stock = inventoryMap[pid];
        return {
          _id: pid,
          name: p.name,
          category: p.category,
          subCategory: p.subCategory,
          price: p.price,
          originalPrice: p.originalPrice,
          discountedPrice: p.discountedPrice,
          image: p.image,
          stock: stock ? {
            inventoryId: stock._id.toString(),
            sku: stock.sku || '',
            currentStock: stock.currentStock || 0,
            reservedStock: stock.reservedStock || 0,
            availableStock: stock.availableStock || 0,
            lowStockAlert: stock.lowStockAlert || 10,
            costPrice: stock.costPrice || 0,
            unit: stock.unit || 'pcs',
            trackInventory: stock.trackInventory !== false,
            isInStock: (stock.availableStock || 0) > 0,
            isLowStock: stock.trackInventory && (stock.availableStock || 0) <= (stock.lowStockAlert || 10) && (stock.availableStock || 0) > 0,
            adjustmentLog: stock.adjustmentLog || [],
            updatedAt: stock.updatedAt,
          } : {
            sku: '',
            currentStock: 0,
            reservedStock: 0,
            availableStock: 0,
            lowStockAlert: 10,
            costPrice: 0,
            unit: 'pcs',
            trackInventory: false,
            isInStock: false,
            isLowStock: false,
            adjustmentLog: [],
          }
        };
      });

      return res.status(200).json(result);
    }

    // POST - create or update inventory for a product
    if (req.method === 'POST') {
      const { productId, sku, currentStock, lowStockAlert, costPrice, unit, trackInventory, reservedStock } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });

      const available = Math.max(0, (Number(currentStock) || 0) - (Number(reservedStock) || 0));
      const existing = await inventoryCol.findOne({ productId });

      const data = {
        sku: sku || '',
        currentStock: Number(currentStock) || 0,
        reservedStock: Number(reservedStock) || 0,
        availableStock: available,
        lowStockAlert: Number(lowStockAlert) || 10,
        costPrice: Number(costPrice) || 0,
        unit: unit || 'pcs',
        trackInventory: trackInventory !== false,
        updatedAt: new Date(),
      };

      if (existing) {
        await inventoryCol.updateOne({ productId }, { $set: data });
        return res.status(200).json({ success: true, updated: true });
      } else {
        await inventoryCol.insertOne({ productId, ...data, adjustmentLog: [], createdAt: new Date() });
        return res.status(201).json({ success: true, created: true });
      }
    }

    // PUT - quick stock adjustment (+/-)
    if (req.method === 'PUT') {
      const { productId, adjustment, reason } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });

      const existing = await inventoryCol.findOne({ productId });
      if (!existing) return res.status(404).json({ error: 'Inventory not found. Save inventory first.' });

      const newStock = Math.max(0, (existing.currentStock || 0) + (Number(adjustment) || 0));
      const available = Math.max(0, newStock - (existing.reservedStock || 0));

      await inventoryCol.updateOne(
        { productId },
        {
          $set: { currentStock: newStock, availableStock: available, updatedAt: new Date() },
          $push: {
            adjustmentLog: {
              adjustment: Number(adjustment),
              reason: reason || 'Manual adjustment',
              date: new Date(),
              stockAfter: newStock,
            }
          }
        }
      );

      return res.status(200).json({ success: true, newStock, available });
    }

    // DELETE - remove inventory tracking
    if (req.method === 'DELETE') {
      const { productId } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });
      await inventoryCol.deleteOne({ productId });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Inventory error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
