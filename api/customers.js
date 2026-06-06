import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const uri = process.env.TAGS_MONGO;
const JWT_SECRET = process.env.JWT_SECRET || 'tags-customer-secret-2026';
const GMAIL_USER = 'tags.udr@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD; // Gmail App Password in Vercel env

let client;
async function getClient() {
  if (!client) { client = new MongoClient(uri); await client.connect(); }
  return client;
}

// Send OTP email via Gmail SMTP using fetch (no nodemailer needed)
async function sendOTPEmail(toEmail, otp, customerName) {
  // Use Gmail API via fetch with OAuth2 — simpler: use SMTP via nodemailer
  // Since nodemailer is not in package.json, use a simple fetch to a free SMTP relay
  // We'll use Gmail's SMTP via the smtp-relay approach with encoded credentials
  try {
    const subject = 'Your TAGS Login OTP';
    const body = `Hi ${customerName || 'there'},\n\nYour TAGS login OTP is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you didn't request this, ignore this email.\n\n— TAGS Team`;

    // Use Resend API (free tier: 3000 emails/month) if available, else fallback
    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'TAGS Store <onboarding@resend.dev>', to: toEmail, subject, text: body }),
      });
      return res.ok;
    }

    // Fallback: EmailJS public API (no backend needed)
    if (process.env.EMAILJS_SERVICE_ID) {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_TEMPLATE_ID,
          user_id: process.env.EMAILJS_PUBLIC_KEY,
          template_params: { to_email: toEmail, to_name: customerName || 'Customer', otp, reply_to: GMAIL_USER },
        }),
      });
      return res.ok;
    }

    return false;
  } catch (err) {
    console.error('OTP email error:', err);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const customers = db.collection('customers');
    const sales = db.collection('sales');
    const otps = db.collection('customerOTPs');

    const { module } = req.query;

    // ── AUTH MODULE ───────────────────────────────────────────────────────────
    if (module === 'auth') {
      const { action } = req.query;

      // ── REGISTER ──────────────────────────────────────────────────────────
      if (action === 'register' && req.method === 'POST') {
        const { name, phone, email, address, password } = req.body;
        if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
        if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const existing = await customers.findOne({ phone });
        if (existing?.passwordHash) return res.status(409).json({ error: 'Account already exists. Please login.' });

        const passwordHash = await bcrypt.hash(password, 10);

        let customerId;
        if (existing) {
          await customers.updateOne({ phone }, { $set: { name, email: email || '', address: address || '', passwordHash, updatedAt: new Date() } });
          customerId = existing._id.toString();
        } else {
          const result = await customers.insertOne({
            name, phone, email: email || '', address: address || '',
            whatsapp: phone, tags: [], passwordHash,
            createdAt: new Date(), updatedAt: new Date(),
          });
          customerId = result.insertedId.toString();
        }

        const token = jwt.sign({ customerId, phone, name }, JWT_SECRET, { expiresIn: '30d' });
        return res.status(201).json({ success: true, token, customer: { customerId, name, phone, email: email || '', address: address || '' } });
      }

      // ── LOGIN WITH PASSWORD ────────────────────────────────────────────────
      if (action === 'login' && req.method === 'POST') {
        const { phone, password } = req.body;
        if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

        const customer = await customers.findOne({ phone });
        if (!customer) return res.status(404).json({ error: 'No account found for this phone number.' });
        if (!customer.passwordHash) return res.status(400).json({ error: 'This account uses OTP login. Please use Email OTP.' });

        const valid = await bcrypt.compare(password, customer.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Incorrect password.' });

        const token = jwt.sign({ customerId: customer._id.toString(), phone: customer.phone, name: customer.name }, JWT_SECRET, { expiresIn: '30d' });
        return res.status(200).json({ success: true, token, customer: { customerId: customer._id.toString(), name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address || '' } });
      }

      // ── SEND OTP ──────────────────────────────────────────────────────────
      if (action === 'send-otp' && req.method === 'POST') {
        const { email, phone } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required for OTP login.' });

        // Find customer by phone or email
        const customer = await customers.findOne({ $or: [{ phone }, { email }] });
        if (!customer) return res.status(404).json({ error: 'No account found. Please register first.' });
        if (!customer.email) return res.status(400).json({ error: 'No email on this account. Please use password login.' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP (replace any existing)
        await otps.updateOne(
          { customerId: customer._id.toString() },
          { $set: { customerId: customer._id.toString(), otp, expiresAt, createdAt: new Date() } },
          { upsert: true }
        );

        const sent = await sendOTPEmail(customer.email, otp, customer.name);
        if (!sent) {
          // Return OTP in dev mode if email fails (remove in production)
          if (process.env.NODE_ENV === 'development') {
            return res.status(200).json({ success: true, devOtp: otp, message: 'Email not configured — OTP returned for dev.' });
          }
          return res.status(500).json({ error: 'Failed to send OTP email. Please try password login.' });
        }

        return res.status(200).json({ success: true, message: `OTP sent to ${customer.email}` });
      }

      // ── VERIFY OTP ────────────────────────────────────────────────────────
      if (action === 'verify-otp' && req.method === 'POST') {
        const { phone, email, otp } = req.body;
        if (!otp) return res.status(400).json({ error: 'OTP is required' });

        const customer = await customers.findOne({ $or: [{ phone }, { email }] });
        if (!customer) return res.status(404).json({ error: 'Account not found.' });

        const otpRecord = await otps.findOne({ customerId: customer._id.toString() });
        if (!otpRecord) return res.status(400).json({ error: 'No OTP requested. Please request a new one.' });
        if (new Date() > new Date(otpRecord.expiresAt)) return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        if (otpRecord.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP.' });

        // Delete OTP after use
        await otps.deleteOne({ customerId: customer._id.toString() });

        const token = jwt.sign({ customerId: customer._id.toString(), phone: customer.phone, name: customer.name }, JWT_SECRET, { expiresIn: '30d' });
        return res.status(200).json({ success: true, token, customer: { customerId: customer._id.toString(), name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address || '' } });
      }

      // ── VERIFY TOKEN ──────────────────────────────────────────────────────
      if (action === 'verify' && req.method === 'GET') {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ valid: false });
        const token = authHeader.replace('Bearer ', '');
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const customer = await customers.findOne({ _id: new ObjectId(decoded.customerId) });
          if (!customer) return res.status(401).json({ valid: false });
          return res.status(200).json({ valid: true, customer: { customerId: customer._id.toString(), name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address || '' } });
        } catch {
          return res.status(401).json({ valid: false });
        }
      }

      return res.status(400).json({ error: 'Invalid auth action' });
    }

    if (module === 'orders') {
      const ordersCol = db.collection('orders');
      const cashFlow = db.collection('cashFlow');
      const driverLoc = db.collection('driverLocations');

      if (req.method === 'GET') {
        const { customerId, orderId: oid, action, id } = req.query;

        // ── Driver location for customer tracking map ────────────────────────
        if (action === 'location' && oid) {
          const loc = await driverLoc.findOne({ orderId: oid });
          if (!loc) return res.status(404).json({ error: 'No location yet' });
          return res.status(200).json({ lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt });
        }

        // ── Single order by _id (TrackOrder + DriverDeliver pages) ──────────
        if (id) {
          let order = null;
          try { order = await ordersCol.findOne({ _id: new ObjectId(id) }); } catch {}
          if (!order) order = await ordersCol.findOne({ orderId: id });
          if (!order) return res.status(404).json({ error: 'Order not found' });
          return res.status(200).json(order);
        }

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
          paymentMode, amountCollected, collectedBy, collectorName,
          action, lat, lng, driverName, cashCollected, paymentCollectedMode,
        } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });

        // ── Driver saves GPS location ────────────────────────────────────────
        if (action === 'save_location') {
          if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
          let order = null;
          try { order = await ordersCol.findOne({ _id: new ObjectId(id) }); } catch {}
          if (!order) order = await ordersCol.findOne({ orderId: id });
          const locationKey = order?.orderId || id;
          await driverLoc.updateOne(
            { orderId: locationKey },
            { $set: { orderId: locationKey, lat: Number(lat), lng: Number(lng), updatedAt: new Date() } },
            { upsert: true }
          );
          return res.status(200).json({ success: true });
        }

        // ── Driver marks delivered (DriverDeliver page) ──────────────────────
        if (action === 'complete_delivery') {
          let order = null;
          try { order = await ordersCol.findOne({ _id: new ObjectId(id) }); } catch {}
          if (!order) order = await ordersCol.findOne({ orderId: id });
          if (!order) return res.status(404).json({ error: 'Order not found' });
          const locationKey = order?.orderId || id;
          const isCOD = ['cod', 'cash', 'whatsapp'].includes((order.paymentMode || '').toLowerCase());
          const paidAmt = Number(order.paidAmount || order.amountCollected || 0);
          const totalAmt = Number(order.totalAmount || 0);
          const cashDue = isCOD ? totalAmt : Math.max(0, totalAmt - paidAmt);
          const collectedAmt = Number(cashCollected || cashDue || 0);
          const collectMode = paymentCollectedMode || 'cash';
          const delivFields = {
            status: 'delivered', deliveredAt: new Date(), updatedAt: new Date(),
            paymentMode: collectMode, amountCollected: collectedAmt,
            collectedBy: 'delivery_boy', collectorName: driverName || '',
            paymentStatus: cashDue > 0 ? 'collected' : 'paid',
          };
          if (order.items?.length) {
            const inventoryCol = db.collection('inventory');
            const stockMovements = db.collection('stockMovements');
            let totalCOGS = 0;
            for (const item of order.items) {
              if (!item.productId) continue;
              const inv = await inventoryCol.findOne({ productId: item.productId });
              if (inv?.costPrice > 0) totalCOGS += inv.costPrice * (Number(item.quantity) || 1);
            }
            if (totalCOGS > 0) {
              await cashFlow.insertOne({
                type: 'expense', category: 'cogs', amount: totalCOGS,
                description: `Cost of goods – Order ${order.orderId || id}`,
                referenceId: id, referenceType: 'order_cogs',
                date: new Date(), createdAt: new Date(),
              });
            }
            for (const item of order.items) {
              if (!item.productId) continue;
              const qty = Number(item.quantity) || 1;
              const invDoc = await inventoryCol.findOne({ productId: item.productId, trackInventory: true });
              if (!invDoc) continue;
              await inventoryCol.updateOne(
                { productId: item.productId, trackInventory: true },
                { $inc: { availableStock: -qty, currentStock: -qty } }
              );
              await stockMovements.insertOne({
                productId: item.productId, productName: item.name || item.productName || '',
                type: 'sale', quantityChange: -qty,
                reason: `Order delivered – ${order.orderId || id}`,
                referenceId: id, referenceType: 'order_delivery',
                date: new Date(), createdAt: new Date(),
              });
            }
          }
          await ordersCol.updateOne({ _id: order._id }, { $set: delivFields });
          if (order.orderId) {
            await sales.updateOne({ orderId: order.orderId }, { $set: { status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() } });
          }
          await driverLoc.deleteOne({ orderId: locationKey });
          const waServerUrl = process.env.WA_SERVER_URL;
          if (waServerUrl && order.customerPhone) {
            const phone = order.customerPhone.replace(/[^0-9]/g, '');
            const custMsg = cashDue > 0
              ? `✅ Hello ${order.customerName}! Your order *${order.orderId}* has been delivered.\n\n💰 Cash collected: ₹${collectedAmt.toLocaleString('en-IN')}\n\nThank you for shopping with TAGS! 🛍️`
              : `✅ Hello ${order.customerName}! Your order *${order.orderId}* has been delivered.\n\nThank you for shopping with TAGS! 🛍️`;
            fetch(`${waServerUrl}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, message: custMsg }) }).catch(() => {});
          }
          if (waServerUrl && process.env.ADMIN_WHATSAPP_NUMBER) {
            const adminMsg = cashDue > 0
              ? `🚚 *Delivery Confirmed*\n\nOrder: *${order.orderId}*\nCustomer: ${order.customerName}\nDriver: ${driverName || 'Driver'}\n\n💵 *Collect ₹${collectedAmt.toLocaleString('en-IN')} from driver*\nMode: ${collectMode}`
              : `🚚 *Delivery Confirmed*\n\nOrder: *${order.orderId}*\nCustomer: ${order.customerName}\nDriver: ${driverName || 'Driver'}\n\n✅ Fully paid in advance.`;
            fetch(`${waServerUrl}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.ADMIN_WHATSAPP_NUMBER, message: adminMsg }) }).catch(() => {});
          }
          if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            try {
              const webpush = await import('web-push');
              webpush.default.setVapidDetails(`mailto:${process.env.ADMIN_EMAIL || 'admin@yourdomain.com'}`, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
              const allSubs = await db.collection('pushSubscriptions').find({ adminId: { $not: /^driver-/ } }).toArray();
              const pushBody = cashDue > 0 ? `Collect ₹${collectedAmt.toLocaleString('en-IN')} from ${driverName || 'driver'} (${collectMode})` : `Order delivered to ${order.customerName}. Fully paid.`;
              const payload = JSON.stringify({ title: `🚚 Delivered: ${order.orderId}`, body: pushBody, orderId: id });
              await Promise.allSettled(allSubs.map(sub => webpush.default.sendNotification(sub.subscription, payload).catch(() => {})));
            } catch (e) { console.error('Push error:', e.message); }
          }
          return res.status(200).json({ success: true, message: 'Delivery confirmed' });
        }

        const updateFields = { updatedAt: new Date() };
        if (status !== undefined) updateFields.status = status;
        if (notes !== undefined) updateFields.notes = notes;
        if (deliveryDate !== undefined) updateFields.deliveryDate = deliveryDate;
        if (whatsappMessage !== undefined) updateFields.whatsappMessage = whatsappMessage;

        // ── CONFIRM: write cashFlow immediately for online/already_paid orders ──
        // Logic: money is received at time of confirmation, not at delivery
        if (status === 'confirmed') {
          const confirmOrder = await ordersCol.findOne({ _id: new ObjectId(id) });
          if (confirmOrder) {
            const confirmPayMode = paymentMode || confirmOrder.paymentMode;
            const isOnlinePaid = confirmPayMode === 'already_paid' || confirmPayMode === 'online' || confirmPayMode === 'upi' || confirmPayMode === 'card';
            if (isOnlinePaid) {
              const confirmAmount = Number(amountCollected) || confirmOrder.totalAmount || 0;
              if (confirmAmount > 0) {
                await cashFlow.insertOne({
                  type: 'income',
                  category: 'sales',
                  amount: confirmAmount,
                  description: `Online payment confirmed – Order ${confirmOrder.orderId || id} (${confirmOrder.customerName})`,
                  referenceId: id,
                  referenceType: 'order_confirmed',
                  paymentMode: confirmPayMode,
                  orderId: confirmOrder.orderId || id,
                  date: new Date(),
                  createdAt: new Date(),
                });
              }
              updateFields.paymentStatus = 'paid';
              updateFields.paymentMode = confirmPayMode;
            }
          }
        }
        // ── END CONFIRM CASHFLOW ──────────────────────────────────────────────

        // ── DELIVERY: deduct stock + COGS only (no cashFlow for COD) ────────
        if (status === 'delivered') {
          updateFields.deliveredAt = new Date();
          if (paymentMode !== undefined) updateFields.paymentMode = paymentMode;
          if (amountCollected !== undefined) updateFields.amountCollected = Number(amountCollected) || 0;
          if (collectedBy !== undefined) updateFields.collectedBy = collectedBy;
          if (collectorName !== undefined) updateFields.collectorName = collectorName || null;
          updateFields.paymentStatus = paymentMode === 'already_paid' ? 'paid' : 'collected';

          const deliveredOrder = await ordersCol.findOne({ _id: new ObjectId(id) });
          if (deliveredOrder) {
            // ── COD: do NOT write cashFlow here ─────────────────────────────
            // For COD orders, cash is physically with the collector (delivery boy / owner).
            // CashFlow income entry is written only when admin clicks "Settle"
            // and confirms cash has been received. This keeps accounting accurate.
            // For already_paid/online orders, cashFlow was written on Confirm — skip here too.
            // ────────────────────────────────────────────────────────────────

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

              // ── REAL-TIME STOCK DEDUCTION ────────────────────────────────
              const stockMovements = db.collection('stockMovements');
              for (const item of deliveredOrder.items) {
                if (!item.productId) continue;
                const qty = Number(item.quantity) || 1;
                const invDoc = await inventoryCol.findOne({ productId: item.productId, trackInventory: true });
                if (!invDoc) continue;
                await inventoryCol.updateOne(
                  { productId: item.productId, trackInventory: true },
                  { $inc: { availableStock: -qty, currentStock: -qty } }
                );
                await stockMovements.insertOne({
                  productId: item.productId,
                  productName: item.name || item.productName || '',
                  type: 'sale',
                  quantityChange: -qty,
                  reason: `Order delivered – ${deliveredOrder.orderId || id}`,
                  referenceId: id,
                  referenceType: 'order_delivery',
                  date: new Date(),
                  createdAt: new Date(),
                });
              }
              // ── END STOCK DEDUCTION ────────────────────────────────────
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
