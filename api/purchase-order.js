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

// Auto-generate PO number: PO-2026-001
async function generatePONumber(db) {
  const year = new Date().getFullYear();
  const count = await db.collection('purchaseOrders').countDocuments();
  return `PO-${year}-${String(count + 1).padStart(3, '0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const orders = db.collection('purchaseOrders');
    const inventory = db.collection('inventory');
    const movements = db.collection('stockMovements');
    const cashFlow = db.collection('cashFlow');

    // ─────────────────────────────────────────────
    // GET /api/purchase-orders
    // ?id=xxx  → single PO
    // ?status=ordered → filter by status
    // ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const { id, status } = req.query;

      if (id) {
        const po = await orders.findOne({ _id: new ObjectId(id) });
        if (!po) return res.status(404).json({ error: 'Purchase order not found' });
        return res.status(200).json(po);
      }

      const filter = status ? { status } : {};
      const allOrders = await orders.find(filter).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(allOrders);
    }

    // ─────────────────────────────────────────────
    // POST /api/purchase-orders
    // Create a new PO
    // Body: { supplier, items: [{productId, productName, sku, quantity, costPrice}], notes, expectedDate }
    // ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { supplier, items, notes = '', expectedDate } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      // Calculate totals
      const enrichedItems = items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        costPrice: Number(item.costPrice),
        totalCost: Number(item.quantity) * Number(item.costPrice),
      }));

      const totalAmount = enrichedItems.reduce((sum, i) => sum + i.totalCost, 0);
      const poNumber = await generatePONumber(db);

      const newPO = {
        poNumber,
        supplier: supplier || { name: '', contact: '', email: '' },
        items: enrichedItems,
        status: 'draft',
        totalAmount,
        paidAmount: 0,
        dueAmount: totalAmount,
        notes,
        orderDate: null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        receivedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await orders.insertOne(newPO);
      return res.status(201).json({ success: true, _id: result.insertedId, poNumber });
    }

    // ─────────────────────────────────────────────
    // PUT /api/purchase-orders
    // Actions:
    //   "update"   → edit PO details (only if draft)
    //   "order"    → mark as ordered (draft → ordered)
    //   "receive"  → mark as received → AUTO adds stock to inventory
    //   "pay"      → record payment
    //   "cancel"   → cancel PO
    // ─────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, action } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const po = await orders.findOne({ _id: new ObjectId(id) });
      if (!po) return res.status(404).json({ error: 'Purchase order not found' });

      // ── Edit draft PO ──
      if (action === 'update' || !action) {
        if (po.status !== 'draft') {
          return res.status(400).json({ error: 'Only draft POs can be edited' });
        }
        const { supplier, items, notes, expectedDate } = req.body;
        const updateFields = { updatedAt: new Date() };
        if (supplier) updateFields.supplier = supplier;
        if (notes !== undefined) updateFields.notes = notes;
        if (expectedDate) updateFields.expectedDate = new Date(expectedDate);
        if (items) {
          const enrichedItems = items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            costPrice: Number(item.costPrice),
            totalCost: Number(item.quantity) * Number(item.costPrice),
          }));
          updateFields.items = enrichedItems;
          updateFields.totalAmount = enrichedItems.reduce((s, i) => s + i.totalCost, 0);
          updateFields.dueAmount = updateFields.totalAmount - po.paidAmount;
        }
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
        return res.status(200).json({ success: true });
      }

      // ── Mark as ordered ──
      if (action === 'order') {
        if (po.status !== 'draft') {
          return res.status(400).json({ error: 'PO is not in draft status' });
        }
        await orders.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'ordered', orderDate: new Date(), updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true });
      }

      // ── Mark as received → THIS IS THE AUTO-SYNC MAGIC ──
      // When you receive stock, inventory auto-updates → website shows new availability
      if (action === 'receive') {
        if (!['ordered', 'draft'].includes(po.status)) {
          return res.status(400).json({ error: 'PO cannot be received in current status' });
        }

        const receivedItems = req.body.receivedItems || po.items; // allow partial receive

        // Update inventory for each item
        for (const item of receivedItems) {
          const qty = Number(item.quantityReceived || item.quantity);
          if (qty <= 0) continue;

          const existing = await inventory.findOne({ productId: item.productId });

          if (existing) {
            // Update existing inventory
            const balanceBefore = existing.currentStock;
            const newStock = existing.currentStock + qty;
            const newAvailable = existing.availableStock + qty;

            await inventory.updateOne(
              { productId: item.productId },
              {
                $set: {
                  currentStock: newStock,
                  availableStock: newAvailable,
                  costPrice: Number(item.costPrice) || existing.costPrice,
                  updatedAt: new Date(),
                },
              }
            );

            // Log stock movement
            await movements.insertOne({
              productId: item.productId,
              type: 'in',
              quantity: qty,
              reason: 'purchase_order',
              referenceId: id,
              balanceBefore,
              balanceAfter: newStock,
              note: `Received from PO ${po.poNumber}`,
              createdAt: new Date(),
            });
          } else {
            // Create new inventory entry
            await inventory.insertOne({
              productId: item.productId,
              sku: item.sku || '',
              currentStock: qty,
              reservedStock: 0,
              availableStock: qty,
              lowStockAlert: 10,
              costPrice: Number(item.costPrice) || 0,
              unit: 'pcs',
              trackInventory: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            await movements.insertOne({
              productId: item.productId,
              type: 'in',
              quantity: qty,
              reason: 'purchase_order',
              referenceId: id,
              balanceBefore: 0,
              balanceAfter: qty,
              note: `First stock from PO ${po.poNumber}`,
              createdAt: new Date(),
            });
          }
        }

        // Mark PO as received
        await orders.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'received', receivedDate: new Date(), updatedAt: new Date() } }
        );

        // Auto-create cash flow expense entry
        await cashFlow.insertOne({
          type: 'expense',
          category: 'purchase',
          amount: po.totalAmount,
          description: `Purchase Order ${po.poNumber} — ${po.supplier?.name || 'Supplier'}`,
          referenceId: id,
          date: new Date(),
          createdAt: new Date(),
        });

        return res.status(200).json({ success: true, message: 'Stock updated across all products' });
      }

      // ── Record payment ──
      if (action === 'pay') {
        const { amount } = req.body;
        const paid = Number(amount);
        const newPaid = po.paidAmount + paid;
        const newDue = Math.max(0, po.totalAmount - newPaid);

        await orders.updateOne(
          { _id: new ObjectId(id) },
          { $set: { paidAmount: newPaid, dueAmount: newDue, updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true, paidAmount: newPaid, dueAmount: newDue });
      }

      // ── Cancel PO ──
      if (action === 'cancel') {
        if (po.status === 'received') {
          return res.status(400).json({ error: 'Cannot cancel a received PO' });
        }
        await orders.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'cancelled', updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // ─────────────────────────────────────────────
    // DELETE /api/purchase-orders
    // Only draft POs can be deleted
    // ─────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const po = await orders.findOne({ _id: new ObjectId(id) });
      if (!po) return res.status(404).json({ error: 'Purchase order not found' });
      if (po.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft POs can be deleted' });
      }

      await orders.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Purchase Orders API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
