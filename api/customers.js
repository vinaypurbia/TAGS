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
    const customers = db.collection('customers');
    const sales = db.collection('sales');

    // ── ORDERS MODULE ─────────────────────────────────────────────────────────
    const { module } = req.query;
    if (module === 'orders') {
      const ordersCol = db.collection('orders');
      // FIX: unified collection name — cashFlow (camelCase) matches all other files
      const cashFlow = db.collection('cashFlow');

      if (req.method === 'GET') {
        const { customerId, orderId: oid } = req.query;
        const filter = {};
        if (customerId) filter.customerId = customerId;
        if (oid) filter.orderId = oid;
        const allOrders = await ordersCol.find(filter).sort({ createdAt: -1 }).toArray();
        return res.status(200).json({ orders: allOrders, total: allOrders.length });
      }

      if (req.method === 'POST') {
        const {
          orderId, customerName, customerPhone, customerEmail,
          deliveryAddress, items, totalAmount, status
        } = req.body;
        if (!customerPhone || !items?.length) {
          return res.status(400).json({ error: 'Phone and items required' });
        }

        const cu = await customers.findOneAndUpdate(
          { phone: customerPhone },
          {
            $set: { name: customerName, email: customerEmail || '', address: deliveryAddress || '', updatedAt: new Date() },
            $setOnInsert: { phone: customerPhone, tags: [], createdAt: new Date() },
          },
          { upsert: true, returnDocument: 'after' }
        );
        const customerId = (cu._id || cu.value?._id)?.toString();

        const result = await ordersCol.insertOne({
          orderId: orderId || `TAGSORD-${Date.now()}`,
          customerId, customerName, customerPhone,
          customerEmail: customerEmail || '',
          deliveryAddress: deliveryAddress || '',
          items, totalAmount: Number(totalAmount) || 0,
          status: status || 'pending',
          createdAt: new Date(), updatedAt: new Date(),
        });

        // Sync to sales collection so Sales module stays in sync
        // NOTE: stock is NOT deducted here — it is deducted when marked 'delivered'
        // This is the correct flow for WhatsApp orders (confirm first, deduct on delivery)
        await sales.insertOne({
          saleNumber: orderId || `SALE-${Date.now().toString().slice(-6)}`,
          orderId: orderId || result.insertedId.toString(),
          customerId,
          customerName, customerPhone,
          customerEmail: customerEmail || '',
          customerAddress: deliveryAddress || '',
          items: items.map(i => ({
            productId: i.productId || '',
            productName: i.productName || i.name || '',
            category: i.category || '',
            quantity: Number(i.quantity) || 1,
            price: Number(i.price) || 0,
            totalPrice: (Number(i.quantity) || 1) * (Number(i.price) || 0),
          })),
          subtotal: Number(totalAmount) || 0,
          discountAmount: 0, taxAmount: 0,
          totalAmount: Number(totalAmount) || 0,
          paymentMode: 'whatsapp',
          status: 'pending',
          notes: '',
          date: new Date(), createdAt: new Date(), updatedAt: new Date(),
        });

        return res.status(201).json({ success: true, _id: result.insertedId, customerId });
      }

      if (req.method === 'PUT') {
        const {
          id, status, notes, deliveryDate, whatsappMessage,
          paymentMode, amountCollected, collectedBy, collectorName
        } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });

        const updateFields = { updatedAt: new Date() };
        if (status !== undefined) updateFields.status = status;
        if (notes !== undefined) updateFields.notes = notes;
        if (deliveryDate !== undefined) updateFields.deliveryDate = deliveryDate;
        if (whatsappMessage !== undefined) updateFields.whatsappMessage = whatsappMessage;

        // ── DELIVERY: record payment in cashFlow only ─────────────────────
        // Stock is NOT auto-deducted — only manual adjustment or PO receipt changes stock
        if (status === 'delivered') {
          updateFields.deliveredAt = new Date();
          if (paymentMode !== undefined) updateFields.paymentMode = paymentMode;
          if (amountCollected !== undefined) updateFields.amountCollected = Number(amountCollected) || 0;
          if (collectedBy !== undefined) updateFields.collectedBy = collectedBy;
          if (collectorName !== undefined) updateFields.collectorName = collectorName || null;
          updateFields.paymentStatus = paymentMode === 'already_paid' ? 'paid' : 'collected';

          const deliveredOrder = await ordersCol.findOne({ _id: new ObjectId(id) });
          if (deliveredOrder) {
            // Record income in cashFlow when delivery is confirmed
            const collectedAmount = Number(amountCollected) || deliveredOrder.totalAmount || 0;
            if (collectedAmount > 0 && paymentMode !== 'already_paid') {
              await cashFlow.insertOne({
                type: 'income',
                category: 'delivery_collection',
                amount: collectedAmount,
                description: `Delivery collected – Order ${deliveredOrder.orderId || id} (${deliveredOrder.customerName})`,
                referenceId: id,
                referenceType: 'order_delivery',
                collectedBy: collectedBy || null,
                collectorName: collectorName || null,
                orderId: deliveredOrder.orderId || id,
                paymentMode: paymentMode || 'cash',
                date: new Date(),
                createdAt: new Date(),
              });
            }

            // Record COGS as expense using costPrice from inventory
            if (deliveredOrder.items?.length) {
              const inventoryCol = db.collection('inventory');
              let totalCOGS = 0;
              for (const item of deliveredOrder.items) {
                if (!item.productId) continue;
                const inv = await inventoryCol.findOne({ productId: item.productId });
                if (inv && inv.costPrice && inv.costPrice > 0) {
                  totalCOGS += inv.costPrice * (Number(item.quantity) || 1);
                }
              }
              if (totalCOGS > 0) {
                await cashFlow.insertOne({
                  type: 'expense',
                  category: 'cogs',
                  amount: totalCOGS,
                  description: `Cost of goods – Order ${deliveredOrder.orderId || id}`,
                  referenceId: id,
                  referenceType: 'order_cogs',
                  date: new Date(),
                  createdAt: new Date(),
                });
              }
            }
          }
        }

        await ordersCol.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

        // Sync status to sales collection
        if (status) {
          const order = await ordersCol.findOne({ _id: new ObjectId(id) });
          if (order?.orderId) {
            const salesSync = { status, updatedAt: new Date() };
            if (status === 'delivered' && paymentMode) {
              salesSync.paymentMode = paymentMode === 'already_paid' ? 'online' : paymentMode;
              salesSync.paymentStatus = paymentMode === 'already_paid' ? 'paid' : 'collected';
            }
            await sales.updateOne({ orderId: order.orderId }, { $set: salesSync });
          }
        }

        return res.status(200).json({ success: true });
      }

      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        await ordersCol.deleteOne({ _id: new ObjectId(id) });
        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── CUSTOMERS (non-orders) ────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { id, phone } = req.query;

      if (id) {
        const customer = await customers.findOne({ _id: new ObjectId(id) });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        const customerSales = await sales.find({ customerId: id }).sort({ date: -1 }).toArray();
        const totalSpend = customerSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
        return res.status(200).json({ ...customer, sales: customerSales, totalSpend, totalOrders: customerSales.length });
      }

      if (phone) {
        const customer = await customers.findOne({ phone });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        const customerSales = await sales.find({ customerId: customer._id.toString() }).sort({ date: -1 }).toArray();
        const totalSpend = customerSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
        return res.status(200).json({ ...customer, sales: customerSales, totalSpend, totalOrders: customerSales.length });
      }

      const allCustomers = await customers.find({}).sort({ createdAt: -1 }).toArray();

      const enriched = await Promise.all(allCustomers.map(async (c) => {
        const cid = c._id.toString();
        const customerSales = await sales.find({ customerId: cid }).toArray();
        const totalSpend = customerSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
        const lastOrder = customerSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return {
          ...c,
          totalOrders: customerSales.length,
          totalSpend,
          lastOrderDate: lastOrder?.date || null,
          lastOrderAmount: lastOrder?.totalAmount || 0,
        };
      }));

      enriched.sort((a, b) => b.totalSpend - a.totalSpend);

      const totalCustomers = enriched.length;
      const totalRevenue = enriched.reduce((s, c) => s + c.totalSpend, 0);
      const repeatCustomers = enriched.filter(c => c.totalOrders > 1).length;

      return res.status(200).json({
        customers: enriched,
        summary: { totalCustomers, totalRevenue, repeatCustomers }
      });
    }

    if (req.method === 'POST') {
      const { name, phone, whatsapp, email, address, notes } = req.body;
      if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

      const existing = await customers.findOne({ phone });
      if (existing) {
        await customers.updateOne(
          { phone },
          { $set: { name, whatsapp: whatsapp || existing.whatsapp || phone, email: email || existing.email, address: address || existing.address, notes: notes || existing.notes, updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true, _id: existing._id, updated: true });
      }

      const result = await customers.insertOne({
        name, phone,
        whatsapp: whatsapp || phone,
        email: email || '',
        address: address || '',
        notes: notes || '',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return res.status(201).json({ success: true, _id: result.insertedId, created: true });
    }

    if (req.method === 'PUT') {
      const { id, ...data } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });
      delete data._id;
      data.updatedAt = new Date();
      await customers.updateOne({ _id: new ObjectId(id) }, { $set: data });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });
      await customers.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Customers API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
