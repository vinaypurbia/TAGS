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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const inventoryCol = db.collection('inventory');
    const productsCol = db.collection('products');

    // ── GET ───────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { action } = req.query;

      // ── BACKFILL DELIVERED ORDERS ─────────────────────────────────────────
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

            const alreadyDone = (inv.adjustmentLog || []).some(
              (l) => l.reason && l.reason.includes(orderRef)
            );
            if (alreadyDone) { skipped++; continue; }

            const qty = Number(item.quantity) || 1;
            const newStock = Math.max(0, (inv.currentStock || 0) - qty);
            const available = Math.max(0, newStock - (inv.reservedStock || 0));

            let stockStatus = 'in_stock';
            if (available === 0) stockStatus = 'out_of_stock';
            else if (available <= (inv.lowStockAlert || 5)) stockStatus = 'low_stock';

            await inventoryCol.updateOne(
              { productId: pid },
              {
                $set: { currentStock: newStock, availableStock: available, stockStatus, updatedAt: new Date() },
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
          message: `Backfill complete. ${totalDeducted} deduction(s) applied, ${skipped} skipped.`,
          totalDeducted, skipped, log,
        });
      }

      // ── BULK UPDATE lowStockAlert from 10 → 5 for all existing records ──
      if (action === 'fixAlerts') {
        const result = await inventoryCol.updateMany(
          { lowStockAlert: 10 },
          { $set: { lowStockAlert: 5, updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true, updated: result.modifiedCount });
      }

      // ── ENABLE ALL TRACKING ───────────────────────────────────────────────
      if (action === 'enableAll') {
        const allProducts = await productsCol.find({}).toArray();
        let created = 0, updated = 0;

        for (const p of allProducts) {
          const pid = p._id.toString();
          const existing = await inventoryCol.findOne({ productId: pid });

          if (existing) {
            if (existing.trackInventory === false) {
              await inventoryCol.updateOne(
                { productId: pid },
                { $set: { trackInventory: true, updatedAt: new Date() } }
              );
              updated++;
            }
          } else {
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
              stockStatus: 'out_of_stock',
              frontendStatus: 'normal',
              adjustmentLog: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            created++;
          }
        }

        return res.status(200).json({
          success: true,
          message: `Tracking enabled. ${created} records created, ${updated} records updated.`,
          created, updated, total: allProducts.length,
        });
      }

      // ── RECALCULATE ALL STOCK from received POs ───────────────────────────
      // GET /api/inventory?action=recalcFromPOs
      // Use this as a recovery tool if POs are deleted directly from DB
      if (action === 'recalcFromPOs') {
        const purchaseOrdersCol = db.collection('purchaseOrders');
        const receivedPOs = await purchaseOrdersCol.find({ status: 'received' }).toArray();

        // Build map: productId → total received qty across all remaining received POs
        const stockFromPOs = {};
        for (const po of receivedPOs) {
          const items = po.receivedItems || po.items || [];
          for (const item of items) {
            const pid = item.productId;
            const qty = Number(item.quantityReceived ?? item.quantity) || 0;
            stockFromPOs[pid] = (stockFromPOs[pid] || 0) + qty;
          }
        }

        const allInv = await inventoryCol.find({}).toArray();
        let updated = 0;
        const log = [];

        for (const inv of allInv) {
          const pid = inv.productId;
          const correctStock = stockFromPOs[pid] || 0;
          const reservedStock = inv.reservedStock || 0;
          const available = Math.max(0, correctStock - reservedStock);
          const alert = inv.lowStockAlert || 5;

          let stockStatus = 'in_stock';
          if (available === 0) stockStatus = 'out_of_stock';
          else if (available <= alert) stockStatus = 'low_stock';

          await inventoryCol.updateOne(
            { _id: inv._id },
            { $set: { currentStock: correctStock, availableStock: available, stockStatus, updatedAt: new Date() } }
          );
          updated++;
          log.push({ productId: pid, correctStock, available, stockStatus });
        }

        return res.status(200).json({
          success: true,
          message: `Recalculated stock for ${updated} products from ${receivedPOs.length} received POs.`,
          updated, log,
        });
      }

      // ── STOCK VISIBILITY PANEL ────────────────────────────────────────────
      if (action === 'visibilityPanel') {
        const allInventory = await inventoryCol
          .find({ trackInventory: true })
          .toArray();

        const enriched = await Promise.all(allInventory.map(async (inv) => {
          const product = await productsCol.findOne({ _id: new ObjectId(inv.productId) }).catch(() => null);

          const available = inv.availableStock || 0;
          const alert = inv.lowStockAlert || 5;
          let stockStatus = 'in_stock';
          if (available === 0) stockStatus = 'out_of_stock';
          else if (available <= alert) stockStatus = 'low_stock';

          if (stockStatus !== inv.stockStatus) {
            await inventoryCol.updateOne(
              { _id: inv._id },
              { $set: { stockStatus, updatedAt: new Date() } }
            );
          }

          return {
            productId: inv.productId,
            inventoryId: inv._id.toString(),
            productName: product?.name || 'Unknown',
            category: product?.category || '-',
            image: product?.image || '',
            price: product?.price || 0,
            currentStock: inv.currentStock || 0,
            availableStock: available,
            lowStockAlert: alert,
            stockStatus,
            frontendStatus: inv.frontendStatus || 'normal',
          };
        }));

        return res.status(200).json(enriched);
      }

      // ── FULL INVENTORY LIST (default) ─────────────────────────────────────
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
            lowStockAlert: stock.lowStockAlert || 5,
            costPrice: stock.costPrice || 0,
            unit: stock.unit || 'pcs',
            trackInventory: stock.trackInventory !== false,
            isInStock: (stock.availableStock || 0) > 0,
            isLowStock: stock.trackInventory && (stock.availableStock || 0) <= (stock.lowStockAlert || 5) && (stock.availableStock || 0) > 0,
            stockStatus: stock.stockStatus || 'in_stock',
            frontendStatus: stock.frontendStatus || 'normal',
            adjustmentLog: stock.adjustmentLog || [],
            updatedAt: stock.updatedAt,
          } : {
            sku: '',
            currentStock: 0,
            reservedStock: 0,
            availableStock: 0,
            lowStockAlert: 5,
            costPrice: 0,
            unit: 'pcs',
            trackInventory: false,
            isInStock: false,
            isLowStock: false,
            stockStatus: 'out_of_stock',
            frontendStatus: 'normal',
            adjustmentLog: [],
          }
        };
      });

      return res.status(200).json(result);
    }

    // ── POST: create or update inventory for a product ────────────────────────
    if (req.method === 'POST') {
      const { productId, sku, currentStock, lowStockAlert, costPrice, unit, trackInventory, reservedStock } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });

      const cs = Number(currentStock) || 0;
      const rs = Number(reservedStock) || 0;
      const available = Math.max(0, cs - rs);
      const alert = Number(lowStockAlert) || 5;
      const existing = await inventoryCol.findOne({ productId });

      let stockStatus = 'in_stock';
      if (available === 0) stockStatus = 'out_of_stock';
      else if (available <= alert) stockStatus = 'low_stock';

      const data = {
        sku: sku || '',
        currentStock: cs,
        reservedStock: rs,
        availableStock: available,
        lowStockAlert: alert,
        costPrice: Number(costPrice) || 0,
        unit: unit || 'pcs',
        trackInventory: trackInventory !== false,
        stockStatus,
        updatedAt: new Date(),
      };

      if (existing) {
        await inventoryCol.updateOne({ productId }, { $set: data });
        return res.status(200).json({ success: true, updated: true });
      } else {
        await inventoryCol.insertOne({
          productId, ...data,
          frontendStatus: 'normal',
          adjustmentLog: [],
          createdAt: new Date(),
        });
        return res.status(201).json({ success: true, created: true });
      }
    }

    // ── PUT: quick stock adjustment (+/-) ─────────────────────────────────────
    if (req.method === 'PUT') {
      const { productId, adjustment, reason } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });

      const existing = await inventoryCol.findOne({ productId });
      if (!existing) return res.status(404).json({ error: 'Inventory not found. Save inventory first.' });

      const newStock = Math.max(0, (existing.currentStock || 0) + (Number(adjustment) || 0));
      const available = Math.max(0, newStock - (existing.reservedStock || 0));

      let stockStatus = 'in_stock';
      if (available === 0) stockStatus = 'out_of_stock';
      else if (existing.trackInventory && available <= (existing.lowStockAlert || 5)) stockStatus = 'low_stock';

      await inventoryCol.updateOne(
        { productId },
        {
          $set: { currentStock: newStock, availableStock: available, stockStatus, updatedAt: new Date() },
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

      return res.status(200).json({ success: true, newStock, available, stockStatus });
    }

    // ── PATCH: update frontendStatus OR delete a specific adjustmentLog entry ─
    if (req.method === 'PATCH') {
      const { productId, frontendStatus, action, index } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required' });

      const existing = await inventoryCol.findOne({ productId });
      if (!existing) return res.status(404).json({ error: 'Inventory record not found' });

      // ── Delete a specific adjustment log entry by index ──────────────────
      if (action === 'deleteAdjustment') {
        const idx = Number(index);
        if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Valid index is required' });

        const log = existing.adjustmentLog || [];
        if (idx >= log.length) return res.status(400).json({ error: 'Index out of range' });

        log.splice(idx, 1);

        await inventoryCol.updateOne(
          { productId },
          { $set: { adjustmentLog: log, updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true });
      }

      // ── Update frontendStatus (Stock Visibility Control panel) ───────────
      const validStatuses = ['normal', 'low_stock', 'out_of_stock', 'hidden'];
      if (!validStatuses.includes(frontendStatus)) {
        return res.status(400).json({ error: `frontendStatus must be one of: ${validStatuses.join(', ')}` });
      }

      await inventoryCol.updateOne(
        { productId },
        { $set: { frontendStatus, updatedAt: new Date() } }
      );

      return res.status(200).json({ success: true, productId, frontendStatus });
    }

    // ── DELETE: remove inventory tracking ─────────────────────────────────────
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
