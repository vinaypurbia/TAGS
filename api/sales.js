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
    const cashflow = db.collection('cashflow');

    // GET - list sales with filters
    if (req.method === 'GET') {
      const { id, from, to, status, period } = req.query;

      if (id) {
        const sale = await salesCol.findOne({ _id: new ObjectId(id) });
        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        return res.status(200).json(sale);
      }

      const filter = {};
      if (status) filter.status = status;

      let fromDate, toDate;
      const now = new Date();
      if (period === 'today') {
        fromDate = new Date(new Date().setHours(0,0,0,0));
        toDate = new Date();
      } else if (period === 'week') {
        fromDate = new Date(new Date().setDate(now.getDate() - 7));
        toDate = new Date();
      } else if (period === 'month') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date();
      } else if (period === 'year') {
        fromDate = new Date(now.getFullYear(), 0, 1);
        toDate = new Date();
      } else {
        if (from) fromDate = new Date(from);
        if (to) toDate = new Date(to);
      }

      if (fromDate || toDate) {
        filter.date = {};
        if (fromDate) filter.date.$gte = fromDate;
        if (toDate) filter.date.$lte = toDate;
      }

      const sales = await salesCol.find(filter).sort({ date: -1 }).toArray();

      // Summary stats
      const totalRevenue = sales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
      const totalOrders = sales.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const pendingCount = sales.filter(s => s.status === 'pending').length;
      const confirmedCount = sales.filter(s => s.status === 'confirmed').length;

      return res.status(200).json({
        sales,
        summary: { totalRevenue, totalOrders, avgOrderValue, pendingCount, confirmedCount }
      });
    }

    // POST - record a new sale
    if (req.method === 'POST') {
      const {
        customerName, customerPhone, customerAddress,
        items, notes, paymentMode, status, orderId,
        discountAmount, taxAmount
      } = req.body;

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

      const result = await salesCol.insertOne({
        saleNumber,
        orderId: orderId || null,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        customerAddress: customerAddress || '',
        items: enrichedItems,
        subtotal,
        discountAmount: discount,
        taxAmount: tax,
        totalAmount,
        paymentMode: paymentMode || 'whatsapp',
        status: status || 'pending',
        notes: notes || '',
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const saleId = result.insertedId.toString();

      // Deduct stock for each item sold
      for (const item of enrichedItems) {
        if (!item.productId) continue;
        const inv = await inventory.findOne({ productId: item.productId });
        if (inv) {
          const newStock = Math.max(0, (inv.currentStock || 0) - item.quantity);
          const available = Math.max(0, newStock - (inv.reservedStock || 0));
          await inventory.updateOne(
            { productId: item.productId },
            { $set: { currentStock: newStock, availableStock: available, updatedAt: new Date() } }
          );
          await movements.insertOne({
            productId: item.productId,
            type: 'out',
            quantity: item.quantity,
            reason: 'sale',
            referenceId: saleId,
            balanceBefore: inv.currentStock,
            balanceAfter: newStock,
            note: `Sale ${saleNumber} — ${customerName || 'Customer'}`,
            createdAt: new Date(),
          });
        }
      }

      // Add income to cashflow
      await cashflow.insertOne({
        type: 'income',
        category: 'sales',
        amount: totalAmount,
        description: `Sale ${saleNumber} — ${customerName || 'Customer'}`,
        referenceId: saleId,
        referenceType: 'sale',
        date: new Date(),
        createdAt: new Date(),
      });

      return res.status(201).json({ success: true, _id: result.insertedId, saleNumber });
    }

    // PUT - update sale status
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

    // DELETE - cancel/delete a sale (restores stock)
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });

      const sale = await salesCol.findOne({ _id: new ObjectId(id) });
      if (!sale) return res.status(404).json({ error: 'Sale not found' });

      // Restore stock
      for (const item of sale.items) {
        if (!item.productId) continue;
        const inv = await inventory.findOne({ productId: item.productId });
        if (inv) {
          const newStock = (inv.currentStock || 0) + item.quantity;
          const available = Math.max(0, newStock - (inv.reservedStock || 0));
          await inventory.updateOne(
            { productId: item.productId },
            { $set: { currentStock: newStock, availableStock: available, updatedAt: new Date() } }
          );
          await movements.insertOne({
            productId: item.productId,
            type: 'in',
            quantity: item.quantity,
            reason: 'sale_cancelled',
            referenceId: id,
            balanceBefore: inv.currentStock,
            balanceAfter: newStock,
            note: `Sale Cancelled: ${sale.saleNumber}`,
            createdAt: new Date(),
          });
        }
      }

      // Remove from cashflow
      await cashflow.deleteOne({ referenceId: id, referenceType: 'sale' });
      await salesCol.deleteOne({ _id: new ObjectId(id) });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
