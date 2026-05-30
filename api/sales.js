import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.TAGS_MONGO;
let client;
async function getClient() {
  if (!client) { client = new MongoClient(uri); await client.connect(); }
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
    const salesCol = db.collection('sales');
    const inventory = db.collection('inventory');
    const movements = db.collection('stockMovements');
    // FIX: unified collection name — was 'cashflow' (lowercase), now matches cashflow.js and purchase-orders.js
    const cashFlow = db.collection('cashFlow');
    const customers = db.collection('customers');
    const ordersCol = db.collection('orders');

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
      // Validate every item has sufficient stock before creating the sale
      const stockErrors = [];
      for (const item of enrichedItems) {
        if (!item.productId) continue; // skip items without a productId (manual entries)
        const inv = await inventory.findOne({ productId: item.productId });
        const available = inv?.availableStock ?? null;

        if (available === null) continue; // inventory not tracked for this item — allow

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
        date: new Date(), createdAt: new Date(), updatedAt: new Date(),
      });

      const saleId = result.insertedId.toString();

      // Stock is NOT auto-deducted on sale — only manual adjustment or PO receipt changes stock
      // COGS is calculated from inventory costPrice for P&L accuracy
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

      // FIX: record COGS as expense so P&L profit = income - expenses is accurate
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

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });
      const sale = await salesCol.findOne({ _id: new ObjectId(id) });
      if (!sale) return res.status(404).json({ error: 'Sale not found' });

      const saleId = id; // string form of sale._id

      // 1. Delete cashflow entries created directly from this sale (income + COGS)
      await cashFlow.deleteMany({
        referenceId: saleId,
        referenceType: { $in: ['sale', 'sale_cogs'] }
      });

      // 2. Find the linked order — check orderMongoId first, then orderId string
      let linkedOrder = null;
      const orClauses = [];
      if (sale.orderMongoId) {
        try { orClauses.push({ _id: new ObjectId(sale.orderMongoId) }); } catch {}
      }
      if (sale.orderId) {
        orClauses.push({ orderId: sale.orderId });
        if (sale.orderId.length === 24) {
          try { orClauses.push({ _id: new ObjectId(sale.orderId) }); } catch {}
        }
      }
      if (orClauses.length > 0) {
        linkedOrder = await ordersCol.findOne({ $or: orClauses });
      }

      if (linkedOrder) {
        const orderId = linkedOrder._id.toString();
        // 3. Delete cashflow entries created when order was delivered (order_delivery + order_cogs)
        await cashFlow.deleteMany({
          referenceId: orderId,
          referenceType: { $in: ['order_delivery', 'order_cogs'] }
        });
        // 4. Delete stockMovements linked to the order
        await movements.deleteMany({ referenceId: orderId });
        // 5. Delete the order itself
        await ordersCol.deleteOne({ _id: linkedOrder._id });
      }

      // 6. Finally delete the sale
      await salesCol.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
