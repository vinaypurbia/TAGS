import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.TAGS_MONGO;
let client;
async function getClient() {
  if (!client) { client = new MongoClient(uri); await client.connect(); }
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED CASCADE DELETE UTILITY
// Call this from both sales.js AND orders.js when deleting.
// Pass the MongoDB db instance + either a saleId or orderId (or both).
//
// Flow:
//   deleteOrderCascade({ db, saleId })      ← called when deleting from Sales tab
//   deleteOrderCascade({ db, orderId })     ← called when deleting from Orders tab
//   deleteOrderCascade({ db, saleId, orderId }) ← called when both are known
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteOrderCascade({ db, saleId, orderId }) {
  const salesCol     = db.collection('sales');
  const ordersCol    = db.collection('orders');
  const cashFlow     = db.collection('cashFlow');
  const movements    = db.collection('stockMovements');
  const ledger       = db.collection('ledger');       // AP/AR — adjust name if different
  const customers    = db.collection('customers');

  const deleted = [];

  // ── 1. Resolve saleId and orderId if only one is provided ─────────────────

  let sale = null;
  let order = null;

  if (saleId) {
    sale = await salesCol.findOne({ _id: new ObjectId(saleId) });
    // If sale has an orderId string, find the order
    if (sale?.orderId && !orderId) {
      order = await ordersCol.findOne({ orderId: sale.orderId });
      if (!order && sale.orderId.length === 24) {
        try { order = await ordersCol.findOne({ _id: new ObjectId(sale.orderId) }); } catch {}
      }
    }
  }

  if (orderId && !order) {
    // orderId here is the MongoDB _id string of the order
    try { order = await ordersCol.findOne({ _id: new ObjectId(orderId) }); } catch {}
    // If we got the order but no saleId yet, find the linked sale
    if (order && !sale) {
      sale = await salesCol.findOne({
        $or: [
          { orderId: order.orderId },        // by orderId string field
          { orderId: order._id.toString() }  // by MongoDB _id string
        ]
      });
      if (sale) saleId = sale._id.toString();
    }
  }

  const resolvedSaleId  = saleId  || sale?._id?.toString();
  const resolvedOrderId = orderId || order?._id?.toString();

  // ── 2. Delete cashFlow entries linked to the SALE ─────────────────────────
  if (resolvedSaleId) {
    const r = await cashFlow.deleteMany({
      referenceId: resolvedSaleId,
      referenceType: { $in: ['sale', 'sale_cogs'] }
    });
    if (r.deletedCount > 0) deleted.push(`cashFlow (sale): ${r.deletedCount}`);
  }

  // ── 3. Delete cashFlow entries linked to the ORDER ────────────────────────
  if (resolvedOrderId) {
    const r = await cashFlow.deleteMany({
      referenceId: resolvedOrderId,
      referenceType: { $in: ['order_delivery', 'order_cogs'] }
    });
    if (r.deletedCount > 0) deleted.push(`cashFlow (order): ${r.deletedCount}`);
  }

  // ── 4. Delete stock movement records linked to the sale or order ──────────
  const movementFilter = { $or: [] };
  if (resolvedSaleId)  movementFilter.$or.push({ referenceId: resolvedSaleId });
  if (resolvedOrderId) movementFilter.$or.push({ referenceId: resolvedOrderId });
  if (movementFilter.$or.length > 0) {
    const r = await movements.deleteMany(movementFilter);
    if (r.deletedCount > 0) deleted.push(`stockMovements: ${r.deletedCount}`);
  }

  // ── 5. Delete AP/AR ledger entries ────────────────────────────────────────
  if (ledger) {
    const ledgerFilter = { $or: [] };
    if (resolvedSaleId)  ledgerFilter.$or.push({ referenceId: resolvedSaleId });
    if (resolvedOrderId) ledgerFilter.$or.push({ referenceId: resolvedOrderId });
    if (ledgerFilter.$or.length > 0) {
      const r = await ledger.deleteMany(ledgerFilter);
      if (r.deletedCount > 0) deleted.push(`ledger: ${r.deletedCount}`);
    }
  }

  // ── 6. Delete the ORDER ───────────────────────────────────────────────────
  if (order) {
    await ordersCol.deleteOne({ _id: order._id });
    deleted.push('order: 1');
  }

  // ── 7. Delete the SALE ────────────────────────────────────────────────────
  if (sale) {
    await salesCol.deleteOne({ _id: sale._id });
    deleted.push('sale: 1');
  }

  return { deleted };
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const salesCol     = db.collection('sales');
    const inventory    = db.collection('inventory');
    const movements    = db.collection('stockMovements');
    const cashFlow     = db.collection('cashFlow');
    const customers    = db.collection('customers');
    const ordersCol    = db.collection('orders');

    if (req.method === 'GET') {
      const { id, from, to, status, period } = req.query;

      if (id) {
        const sale = await salesCol.findOne({ _id: new ObjectId(id) });
        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        return res.status(200).json(sale);
      }

      const filter = {};
      if (status) filter.status = status;

      const now = new Date();
      let fromDate, toDate;
      if (period === 'today') { fromDate = new Date(new Date().setHours(0,0,0,0)); toDate = new Date(); }
      else if (period === 'week') { fromDate = new Date(new Date().setDate(now.getDate() - 7)); toDate = new Date(); }
      else if (period === 'month') { fromDate = new Date(now.getFullYear(), now.getMonth(), 1); toDate = new Date(); }
      else if (period === 'year') { fromDate = new Date(now.getFullYear(), 0, 1); toDate = new Date(); }
      else { if (from) fromDate = new Date(from); if (to) toDate = new Date(to); }

      if (fromDate || toDate) {
        filter.date = {};
        if (fromDate) filter.date.$gte = fromDate;
        if (toDate) filter.date.$lte = toDate;
      }

      const sales = await salesCol.find(filter).sort({ date: -1 }).toArray();
      const totalRevenue = sales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
      const totalOrders = sales.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const pendingCount = sales.filter(s => s.status === 'pending').length;
      const confirmedCount = sales.filter(s => s.status === 'confirmed').length;

      return res.status(200).json({ sales, summary: { totalRevenue, totalOrders, avgOrderValue, pendingCount, confirmedCount } });
    }

    if (req.method === 'POST') {
      const { customerName, customerPhone, customerAddress, items, notes, paymentMode, status, orderId, discountAmount, taxAmount, mixedCashAmount, mixedOtherMode, mixedOtherAmount } = req.body;
      if (!items || items.length === 0) return res.status(400).json({ error: 'Items required' });

      const enrichedItems = items.map(item => ({
        productId: item.productId || '',
        productName: item.productName || item.name || '',
        category: item.category || '',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        totalPrice: (Number(item.quantity) || 1) * (Number(item.price) || 0),
      }));

      const subtotal = enrichedItems.reduce((s, i) => s + i.totalPrice, 0);
      const discount = Number(discountAmount) || 0;
      const tax = Number(taxAmount) || 0;
      const totalAmount = subtotal - discount + tax;
      const saleNumber = `SALE-${Date.now().toString().slice(-6)}`;

      // Auto create or update customer record
      let customerId = null;
      if (customerPhone) {
        const existing = await customers.findOne({ phone: customerPhone });
        if (existing) {
          customerId = existing._id.toString();
          await customers.updateOne(
            { phone: customerPhone },
            { $set: { name: customerName || existing.name, address: customerAddress || existing.address, updatedAt: new Date() } }
          );
        } else if (customerName) {
          const result = await customers.insertOne({
            name: customerName, phone: customerPhone,
            email: '', address: customerAddress || '',
            notes: '', tags: [],
            createdAt: new Date(), updatedAt: new Date(),
          });
          customerId = result.insertedId.toString();
        }
      }

      // ── STOCK AVAILABILITY CHECK ──────────────────────────────────────────
      const stockErrors = [];
      for (const item of enrichedItems) {
        if (!item.productId) continue;
        const inv = await inventory.findOne({ productId: item.productId });
        const available = inv?.availableStock ?? null;
        if (available === null) continue;
        if (available === 0) {
          stockErrors.push(`"${item.productName}" is currently out of stock and unavailable for sale.`);
        } else if (available < item.quantity) {
          stockErrors.push(`"${item.productName}" has only ${available} unit${available !== 1 ? 's' : ''} available, but ${item.quantity} ${item.quantity !== 1 ? 'were' : 'was'} requested.`);
        }
      }
      if (stockErrors.length > 0) {
        return res.status(400).json({
          error: 'Sale could not be created due to insufficient stock.',
          stockErrors,
          message: stockErrors.join(' | '),
        });
      }
      // ─────────────────────────────────────────────────────────────────────

      const result = await salesCol.insertOne({
        saleNumber,
        customerId,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        customerAddress: customerAddress || '',
        items: enrichedItems, subtotal,
        discountAmount: discount, taxAmount: tax, totalAmount,
        paymentMode: paymentMode || 'whatsapp',
        ...(paymentMode === 'mixed' && { mixedCashAmount: Number(mixedCashAmount) || 0, mixedOtherMode: mixedOtherMode || 'upi', mixedOtherAmount: Number(mixedOtherAmount) || 0 }),
        status: status || 'pending',
        notes: notes || '',
        orderId: orderId || null,   // ← always store this so cascade delete can find the order
        date: new Date(), createdAt: new Date(), updatedAt: new Date(),
      });

      const saleId = result.insertedId.toString();

      // COGS calculation
      let totalCOGS = 0;
      for (const item of enrichedItems) {
        if (!item.productId) continue;
        const inv = await inventory.findOne({ productId: item.productId });
        if (inv && inv.costPrice && inv.costPrice > 0) {
          totalCOGS += inv.costPrice * item.quantity;
        }
      }

      // Record income in cashFlow — split entries for mixed payment
      if (paymentMode === 'mixed' && mixedCashAmount > 0) {
        const cashAmt  = Number(mixedCashAmount)  || 0;
        const otherAmt = Number(mixedOtherAmount) || 0;
        if (cashAmt > 0) await cashFlow.insertOne({
          type: 'income', category: 'sales',
          amount: cashAmt,
          paymentMode: 'cash',
          description: `Sale ${saleNumber} — Cash portion — ${customerName || 'Customer'}`,
          referenceId: saleId, referenceType: 'sale',
          date: new Date(), createdAt: new Date(),
        });
        if (otherAmt > 0) await cashFlow.insertOne({
          type: 'income', category: 'sales',
          amount: otherAmt,
          paymentMode: mixedOtherMode || 'upi',
          description: `Sale ${saleNumber} — ${(mixedOtherMode || 'upi').toUpperCase()} portion — ${customerName || 'Customer'}`,
          referenceId: saleId, referenceType: 'sale',
          date: new Date(), createdAt: new Date(),
        });
      } else {
        await cashFlow.insertOne({
          type: 'income', category: 'sales', amount: totalAmount,
          paymentMode: paymentMode || 'cash',
          description: `Sale ${saleNumber} — ${customerName || 'Customer'}`,
          referenceId: saleId, referenceType: 'sale',
          date: new Date(), createdAt: new Date(),
        });
      }

      if (totalCOGS > 0) {
        await cashFlow.insertOne({
          type: 'expense', category: 'cogs',
          amount: totalCOGS,
          description: `Cost of goods — Sale ${saleNumber}`,
          referenceId: saleId, referenceType: 'sale_cogs',
          date: new Date(), createdAt: new Date(),
        });
      }

      return res.status(201).json({ success: true, _id: result.insertedId, saleNumber, customerId });
    }

    if (req.method === 'PUT') {
      const { id, status, paymentMode, notes } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });
      const updateData = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (paymentMode) updateData.paymentMode = paymentMode;
      if (notes !== undefined) updateData.notes = notes;
      await salesCol.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
      return res.status(200).json({ success: true });
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    // Cascade-deletes: sale + linked order + all cashFlow + stockMovements + ledger
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });

      // Verify sale exists before cascade
      const sale = await salesCol.findOne({ _id: new ObjectId(id) });
      if (!sale) return res.status(404).json({ error: 'Sale not found' });

      const { deleted } = await deleteOrderCascade({ db, saleId: id });

      return res.status(200).json({ success: true, deleted });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
