import { MongoClient, ObjectId } from 'mongodb';
import webpush from 'web-push';

const uri = process.env.TAGS_MONGO;
let client;
async function getClient() {
  if (!client) { client = new MongoClient(uri); await client.connect(); }
  return client;
}

// ─── Web Push setup ───────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.ADMIN_EMAIL || 'admin@yourdomain.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── WhatsApp helper (via whatsapp-web.js running on driver phone/server) ────
async function sendWhatsApp(phone, message) {
  try {
    const waServerUrl = process.env.WA_SERVER_URL; // e.g. http://localhost:3001
    if (!waServerUrl) return;
    await fetch(`${waServerUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    });
  } catch (e) {
    console.error('WhatsApp send failed:', e.message);
  }
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
    const cashFlow = db.collection('cashFlow');
    const customers = db.collection('customers');
    const ordersCol = db.collection('orders');
    const pushSubs = db.collection('pushSubscriptions');
    const driverLoc = db.collection('driverLocations');

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/sales
    // ?id=xxx           → single sale
    // ?action=location&orderId=xxx  → get driver's latest location for tracking
    // ?from=&to=&status=&period=    → filtered list
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { id, from, to, status, period, action, orderId } = req.query;

      // ── Driver location for customer tracking map ──
      if (action === 'location' && orderId) {
        const loc = await driverLoc.findOne(
          { orderId },
          { sort: { updatedAt: -1 } }
        );
        if (!loc) return res.status(404).json({ error: 'No location found' });
        return res.status(200).json({ lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt });
      }

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

      let totalCOGS = 0;
      for (const item of enrichedItems) {
        if (!item.productId) continue;
        const inv = await inventory.findOne({ productId: item.productId });
        if (inv && inv.costPrice && inv.costPrice > 0) {
          totalCOGS += inv.costPrice * item.quantity;
        }
      }

      if (paymentMode === 'mixed' && mixedCashAmount > 0) {
        const cashAmt  = Number(mixedCashAmount)  || 0;
        const otherAmt = Number(mixedOtherAmount) || 0;
        if (cashAmt > 0) await cashFlow.insertOne({
          type: 'income', category: 'sales', amount: cashAmt, paymentMode: 'cash',
          description: `Sale ${saleNumber} — Cash portion — ${customerName || 'Customer'}`,
          referenceId: saleId, referenceType: 'sale', date: new Date(), createdAt: new Date(),
        });
        if (otherAmt > 0) await cashFlow.insertOne({
          type: 'income', category: 'sales', amount: otherAmt, paymentMode: mixedOtherMode || 'upi',
          description: `Sale ${saleNumber} — ${(mixedOtherMode || 'upi').toUpperCase()} portion — ${customerName || 'Customer'}`,
          referenceId: saleId, referenceType: 'sale', date: new Date(), createdAt: new Date(),
        });
      } else {
        await cashFlow.insertOne({
          type: 'income', category: 'sales', amount: totalAmount, paymentMode: paymentMode || 'cash',
          description: `Sale ${saleNumber} — ${customerName || 'Customer'}`,
          referenceId: saleId, referenceType: 'sale', date: new Date(), createdAt: new Date(),
        });
      }

      if (totalCOGS > 0) {
        await cashFlow.insertOne({
          type: 'expense', category: 'cogs', amount: totalCOGS,
          description: `Cost of goods — Sale ${saleNumber}`,
          referenceId: saleId, referenceType: 'sale_cogs', date: new Date(), createdAt: new Date(),
        });
      }

      return res.status(201).json({ success: true, _id: result.insertedId, saleNumber, customerId });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/sales
    // Existing: { id, status, paymentMode, notes }
    // New delivery actions (action field):
    //   "driver_location"    → driver posts GPS coords
    //   "complete_delivery"  → driver marks delivered → WhatsApp + Web Push
    //   "push_subscribe"     → admin browser registers push subscription
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, action, status, paymentMode, notes } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });

      // ── Driver posts GPS location ──────────────────────────────────────────
      if (action === 'driver_location') {
        const { lat, lng } = req.body;
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
        await driverLoc.updateOne(
          { orderId: id },
          { $set: { orderId: id, lat: Number(lat), lng: Number(lng), updatedAt: new Date() } },
          { upsert: true }
        );
        return res.status(200).json({ success: true });
      }

      // ── Admin browser subscribes to Web Push ──────────────────────────────
      if (action === 'push_subscribe') {
        const { subscription, adminId } = req.body;
        if (!subscription) return res.status(400).json({ error: 'subscription required' });
        await pushSubs.updateOne(
          { adminId: adminId || 'default' },
          { $set: { adminId: adminId || 'default', subscription, updatedAt: new Date() } },
          { upsert: true }
        );
        return res.status(200).json({ success: true });
      }

      // ── Driver marks order as delivered ───────────────────────────────────
      if (action === 'complete_delivery') {
        const { cashCollected, paymentCollectedMode, driverName } = req.body;

        // Find the order — id could be a sale _id or an orderId string
        let orderDoc = null;
        try { orderDoc = await ordersCol.findOne({ _id: new ObjectId(id) }); } catch {}
        if (!orderDoc) orderDoc = await ordersCol.findOne({ orderId: id });

        // Also try sales collection (for POS sales)
        let saleDoc = null;
        try { saleDoc = await salesCol.findOne({ _id: new ObjectId(id) }); } catch {}

        const doc = orderDoc || saleDoc;
        if (!doc) return res.status(404).json({ error: 'Order not found' });

        const col = orderDoc ? ordersCol : salesCol;
        const docId = doc._id;

        // Mark delivered
        await col.updateOne(
          { _id: docId },
          { $set: { status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() } }
        );

        // Clean up driver location
        await driverLoc.deleteOne({ orderId: id });

        const customerPhone = doc.customerPhone || doc.phone || '';
        const customerName  = doc.customerName  || doc.name  || 'Customer';
        const orderRef      = doc.saleNumber    || doc.orderId || id;
        const totalAmt      = doc.totalAmount   || 0;
        const pMode         = doc.paymentMode   || 'paid';
        const isCOD         = ['cod', 'cash', 'partial'].includes((pMode || '').toLowerCase())
                              || doc.paymentType === 'cod';
        const partialPaid   = Number(doc.paidAmount || 0);
        const cashDue       = Number(cashCollected || (totalAmt - partialPaid) || 0);

        // ── WhatsApp to customer ──────────────────────────────────────────
        if (customerPhone) {
          let custMsg = '';
          if (isCOD) {
            custMsg = `✅ Hello ${customerName}! Your order *${orderRef}* has been delivered.\n\n`
              + `💰 Cash collected: ₹${cashDue.toLocaleString('en-IN')}\n\n`
              + `Thank you for shopping with us! 🛍️`;
          } else {
            custMsg = `✅ Hello ${customerName}! Your order *${orderRef}* has been delivered successfully.\n\n`
              + `Payment was received in advance. Thank you for shopping with us! 🛍️`;
          }
          await sendWhatsApp(customerPhone, custMsg);
        }

        // ── WhatsApp to admin ─────────────────────────────────────────────
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
        if (adminPhone) {
          let adminMsg = `🚚 *Delivery Confirmed*\n\n`
            + `Order: *${orderRef}*\n`
            + `Customer: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}\n`
            + `Driver: ${driverName || 'Driver'}\n`
            + `Time: ${new Date().toLocaleString('en-IN')}\n\n`;

          if (isCOD) {
            adminMsg += `💵 *Payment to collect from driver:*\n`
              + `Amount: ₹${cashDue.toLocaleString('en-IN')}\n`
              + `Mode: ${paymentCollectedMode || 'Cash'}\n\n`
              + `Please collect this amount from the delivery boy ${paymentCollectedMode === 'bank' ? 'via bank transfer' : 'in cash'}.`;
          } else if (partialPaid > 0 && partialPaid < totalAmt) {
            const remaining = totalAmt - partialPaid;
            adminMsg += `💳 Partial payment received:\n`
              + `Pre-paid: ₹${partialPaid.toLocaleString('en-IN')}\n`
              + `💵 *Remaining to collect from driver: ₹${remaining.toLocaleString('en-IN')}*\n`
              + `Mode: ${paymentCollectedMode || 'Cash'}`;
          } else {
            adminMsg += `✅ Fully paid in advance. No cash to collect.`;
          }

          await sendWhatsApp(adminPhone, adminMsg);
        }

        // ── Web Push to admin PC ──────────────────────────────────────────
        const allSubs = await pushSubs.find({}).toArray();
        if (allSubs.length > 0) {
          let pushTitle = `🚚 Delivered: ${orderRef}`;
          let pushBody  = '';

          if (isCOD) {
            pushBody = `Collect ₹${cashDue.toLocaleString('en-IN')} from ${driverName || 'driver'} (${paymentCollectedMode || 'cash'})`;
          } else if (partialPaid > 0 && partialPaid < totalAmt) {
            pushBody = `Partial — collect ₹${(totalAmt - partialPaid).toLocaleString('en-IN')} from ${driverName || 'driver'}`;
          } else {
            pushBody = `Order delivered to ${customerName}. Fully paid.`;
          }

          const payload = JSON.stringify({ title: pushTitle, body: pushBody, orderId: id });

          await Promise.allSettled(
            allSubs.map(sub =>
              webpush.sendNotification(sub.subscription, payload).catch(async (err) => {
                // Remove expired/invalid subscriptions
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await pushSubs.deleteOne({ _id: sub._id });
                }
              })
            )
          );
        }

        return res.status(200).json({ success: true, message: 'Delivery confirmed. Notifications sent.' });
      }

      // ── Original PUT logic (status/paymentMode/notes update) ──────────────
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

      const saleId = id;

      await cashFlow.deleteMany({
        referenceId: saleId,
        referenceType: { $in: ['sale', 'sale_cogs'] }
      });

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
        await cashFlow.deleteMany({
          referenceId: orderId,
          referenceType: { $in: ['order_delivery', 'order_cogs'] }
        });
        await movements.deleteMany({ referenceId: orderId });
        await ordersCol.deleteOne({ _id: linkedOrder._id });
      }

      await salesCol.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
