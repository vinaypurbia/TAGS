import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const uri = process.env.TAGS_MONGO;
const JWT_SECRET = process.env.TAGS_JWT_SECRET || 'tags-secret-change-in-prod';

let client;
async function getClient() {
  if (!client) { client = new MongoClient(uri); await client.connect(); }
  return client;
}

// ─── JWT helpers ──────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}
function getTokenFromReq(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}
function requireAuth(req, roles = []) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  if (roles.length && !roles.includes(decoded.role)) return null;
  return decoded;
}

// ─── ORDER STATUS EMAIL (reused from customers.js) ───────────────────────────
async function sendOrderEmail(toEmail, customerName, eventType, orderData) {
  if (!toEmail || !process.env.RESEND_API_KEY) return false;
  const { orderId, items = [], totalAmount = 0, deliveryAddress = '', trackUrl = '' } = orderData;
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const itemRows = items.map(i =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;color:#444;">${i.productName || i.name || 'Item'}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#444;">×${i.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#444;">${fmt((i.price || 0) * (i.quantity || 1))}</td></tr>`
  ).join('');
  const cfg = {
    out_for_delivery: {
      subject: `Out for Delivery 🚚 – ${orderId} | TAGS`,
      badge: '#7c3aed', badgeText: '🚚 Out for Delivery',
      headline: `Your order is on its way!`,
      body: `Hello ${customerName}! Your order is out for delivery. Our driver is heading to your location now.`,
      cta: trackUrl ? `<a href="${trackUrl}" style="display:inline-block;margin-top:16px;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;">Live Track Driver</a>` : '',
    },
  }[eventType];
  if (!cfg) return false;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="background:#1A1A1A;padding:28px 32px;text-align:center;"><span style="font-size:28px;font-weight:900;color:#fff;text-transform:uppercase;"><span style="color:#FA5600">T</span>AGS</span></td></tr><tr><td style="padding:24px 32px 0;text-align:center;"><span style="display:inline-block;background:${cfg.badge};color:#fff;font-weight:700;font-size:14px;padding:6px 18px;border-radius:999px;">${cfg.badgeText}</span></td></tr><tr><td style="padding:16px 32px 8px;text-align:center;"><h1 style="margin:0;font-size:22px;font-weight:800;color:#1A1A1A;">${cfg.headline}</h1><p style="margin:10px 0 0;font-size:15px;color:#555;">${cfg.body}</p></td></tr><tr><td style="padding:20px 32px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:10px;padding:14px 18px;"><tr><td style="font-size:13px;color:#888;font-weight:600;">ORDER ID</td><td style="font-size:13px;color:#1A1A1A;font-weight:800;text-align:right;">${orderId}</td></tr>${deliveryAddress ? `<tr><td style="font-size:13px;color:#888;font-weight:600;padding-top:6px;">DELIVER TO</td><td style="font-size:13px;color:#444;text-align:right;padding-top:6px;">${deliveryAddress}</td></tr>` : ''}<tr><td style="font-size:13px;color:#888;font-weight:600;padding-top:6px;">TOTAL</td><td style="font-size:15px;color:#FA5600;font-weight:900;text-align:right;padding-top:6px;">${fmt(totalAmount)}</td></tr></table></td></tr>${itemRows ? `<tr><td style="padding:20px 32px 0;"><p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;">Items</p><table width="100%" cellpadding="0" cellspacing="0">${itemRows}</table></td></tr>` : ''}${cfg.cta ? `<tr><td style="padding:24px 32px;text-align:center;">${cfg.cta}</td></tr>` : ''}<tr><td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #ebebeb;"><p style="margin:0;font-size:12px;color:#aaa;">TAGS Store &bull; ta-gs.online</p></td></tr></table></td></tr></table></body></html>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'TAGS Store <orders@ta-gs.online>', to: toEmail, subject: cfg.subject, html }),
    });
    if (!r.ok) { const d = await r.json(); console.error('Resend error:', d); return false; }
    return true;
  } catch (e) { console.error('sendOrderEmail failed:', e); return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { module } = req.query;

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');

    // ─── AUTH ─────────────────────────────────────────────────────
    if (module === 'auth') {
      const { action } = req.query;

      // Email + password login (all roles)
      if (action === 'login' && req.method === 'POST') {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = await db.collection('users').findOne({ email: email.toLowerCase(), active: true });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Support bcrypt hashed AND plain-text passwords (auto-migrate plain text to bcrypt)
        let valid = false;
        if (user.passwordHash && user.passwordHash.startsWith('$2')) {
          valid = await bcrypt.compare(password, user.passwordHash);
        } else {
          const storedPlain = user.passwordHash || user.password || '';
          valid = (password === storedPlain);
          if (valid) {
            // Migrate plain text → bcrypt immediately
            const newHash = await bcrypt.hash(password, 12);
            await db.collection('users').updateOne(
              { _id: user._id },
              { $set: { passwordHash: newHash }, $unset: { password: '' } }
            );
          }
        }

        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = signToken({ userId: user._id.toString(), name: user.name, email: user.email, role: user.role });
        await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
        return res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, allowedModules: user.allowedModules || [] } });
      }

      // PIN login (associate, cashier)
      if (action === 'pin' && req.method === 'POST') {
        const { pin } = req.body;
        if (!pin) return res.status(400).json({ error: 'PIN required' });
        const allPinUsers = await db.collection('users').find({ role: { $in: ['associate', 'cashier', 'delivery_boy'] }, active: true }).toArray();
        let matched = null;
        for (const u of allPinUsers) {
          if (u.pinHash && await bcrypt.compare(String(pin), u.pinHash)) { matched = u; break; }
        }
        if (!matched) return res.status(401).json({ error: 'Invalid PIN' });
        const token = signToken({ userId: matched._id.toString(), name: matched.name, role: matched.role });
        await db.collection('users').updateOne({ _id: matched._id }, { $set: { lastLogin: new Date() } });
        return res.status(200).json({ token, user: { id: matched._id, name: matched.name, role: matched.role, allowedModules: matched.allowedModules || [] } });
      }

      // Staff login by username + password — used by POS login page for all non-admin roles
      if (action === 'staff-login' && req.method === 'POST') {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        // username can be email or name
        const isEmail = username.includes('@');
        const user = await db.collection('users').findOne(
          isEmail
            ? { email: username.toLowerCase(), active: true }
            : { name: { $regex: new RegExp(`^${username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, active: true }
        );
        if (!user) return res.status(401).json({ error: 'Username not found or account inactive' });
        let valid = false;
        if (user.passwordHash && user.passwordHash.startsWith('$2')) {
          valid = await bcrypt.compare(password, user.passwordHash);
        } else {
          valid = (password === (user.passwordHash || user.password || ''));
          if (valid) {
            const newHash = await bcrypt.hash(password, 12);
            await db.collection('users').updateOne({ _id: user._id }, { $set: { passwordHash: newHash } });
          }
        }
        if (!valid) return res.status(401).json({ error: 'Incorrect password' });
        const token = signToken({ userId: user._id.toString(), name: user.name, email: user.email, role: user.role });
        await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
        return res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, allowedModules: user.allowedModules || [] } });
      }

      // Verify token
      if (action === 'verify' && req.method === 'GET') {
        const decoded = requireAuth(req);
        if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
        return res.status(200).json({ valid: true, user: decoded });
      }

      // Change password
      if (action === 'change-password' && req.method === 'POST') {
        const decoded = requireAuth(req);
        if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        const newHash = await bcrypt.hash(newPassword, 12);
        await db.collection('users').updateOne({ _id: user._id }, { $set: { passwordHash: newHash, updatedAt: new Date() } });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid auth action' });
    }

    // ─── USERS (admin only) ───────────────────────────────────────
    if (module === 'users') {
      const col = db.collection('users');

      if (req.method === 'GET') {
        const auth = requireAuth(req, ['admin']);
        if (!auth) return res.status(403).json({ error: 'Admin access required' });
        const users = await col.find({}, { projection: { passwordHash: 0, pinHash: 0 } }).sort({ createdAt: -1 }).toArray();
        return res.status(200).json(users);
      }

      if (req.method === 'POST') {
        const auth = requireAuth(req, ['admin']);
        if (!auth) return res.status(403).json({ error: 'Admin access required' });
        const { name, email, role, password } = req.body;
        if (!name || !role) return res.status(400).json({ error: 'Name and role required' });
        const validRoles = ['admin', 'manager', 'associate', 'cashier', 'delivery_boy'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

        // Role-based default module permissions
        const ROLE_DEFAULT_MODULES = {
          admin:        [],
          manager:      [],
          associate:    ['orders', 'sales', 'customers'],
          cashier:      ['sales', 'customers'],
          delivery_boy: ['orders'],
        };

        const { allowedModules } = req.body;
        const resolvedModules = Array.isArray(allowedModules) && allowedModules.length > 0
          ? allowedModules
          : (ROLE_DEFAULT_MODULES[role] || []);

        const doc = {
          name, role, active: true,
          createdAt: new Date(), updatedAt: new Date(), createdBy: auth.userId,
          allowedModules: resolvedModules,
        };

        // All roles require a password
        if (!password) return res.status(400).json({ error: 'Password is required for all users' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        doc.passwordHash = await bcrypt.hash(password, 10);

        if (['admin', 'manager'].includes(role)) {
          if (!email) return res.status(400).json({ error: 'Email required for admin/manager' });
          const exists = await col.findOne({ email: email.toLowerCase() });
          if (exists) return res.status(400).json({ error: 'Email already in use' });
          doc.email = email.toLowerCase();
        } else {
          if (email) doc.email = email.toLowerCase();
          if (req.body.phone) doc.phone = req.body.phone;
        }

        const result = await col.insertOne(doc);
        return res.status(201).json({ success: true, _id: result.insertedId });
      }

      if (req.method === 'PUT') {
        const auth = requireAuth(req, ['admin']);
        if (!auth) return res.status(403).json({ error: 'Admin access required' });
        const { id, name, email, role, active, password, allowedModules: updModules } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        const update = { updatedAt: new Date() };
        if (name) update.name = name;
        if (email) update.email = email.toLowerCase();
        if (role) update.role = role;
        if (typeof active === 'boolean') update.active = active;
        if (password && password.length >= 6) update.passwordHash = await bcrypt.hash(password, 10);
        if (Array.isArray(updModules)) update.allowedModules = updModules;
        await col.updateOne({ _id: new ObjectId(id) }, { $set: update });
        return res.status(200).json({ success: true });
      }

      if (req.method === 'DELETE') {
        const auth = requireAuth(req, ['admin']);
        if (!auth) return res.status(403).json({ error: 'Admin access required' });
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        // Soft delete — never hard delete
        await col.updateOne({ _id: new ObjectId(id) }, { $set: { active: false, updatedAt: new Date() } });
        return res.status(200).json({ success: true });
      }
    }

    // ─── SUPPLIERS ───────────────────────────────────────────────
    if (module === 'suppliers') {
      const col = db.collection('suppliers');
      if (req.method === 'GET') {
        const suppliers = await col.find({}).sort({ name: 1 }).toArray();
        return res.status(200).json(suppliers);
      }
      if (req.method === 'POST') {
        const { name, phone, email, address, gstin, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const result = await col.insertOne({ name, phone: phone || '', email: email || '', address: address || '', gstin: gstin || '', notes: notes || '', createdAt: new Date(), updatedAt: new Date() });
        return res.status(201).json({ success: true, _id: result.insertedId });
      }
      if (req.method === 'PUT') {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        delete data._id; data.updatedAt = new Date();
        await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
        return res.status(200).json({ success: true });
      }
      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        await col.deleteOne({ _id: new ObjectId(id) });
        return res.status(200).json({ success: true });
      }
    }

    // ─── EXPENSES ────────────────────────────────────────────────
    if (module === 'expenses') {
      const col = db.collection('expenses');
      const cashFlow = db.collection('cashFlow');

      if (req.method === 'GET') {
        const { from, to, period } = req.query;
        const filter = {};
        let fromDate, toDate;
        const now = new Date();
        if (period === 'today') { fromDate = new Date(new Date().setHours(0,0,0,0)); toDate = new Date(); }
        else if (period === 'week') { fromDate = new Date(now.setDate(now.getDate() - 7)); toDate = new Date(); }
        else if (period === 'month') { fromDate = new Date(now.getFullYear(), now.getMonth(), 1); toDate = new Date(); }
        else if (period === 'year') { fromDate = new Date(now.getFullYear(), 0, 1); toDate = new Date(); }
        else { if (from) fromDate = new Date(from); if (to) toDate = new Date(to); }
        if (fromDate || toDate) {
          filter.date = {};
          if (fromDate) filter.date.$gte = fromDate;
          if (toDate) filter.date.$lte = toDate;
        }
        const expenses = await col.find(filter).sort({ date: -1 }).toArray();
        return res.status(200).json(expenses);
      }
      if (req.method === 'POST') {
        const { category, amount, description, date, paymentMode, notes } = req.body;
        if (!amount || !category) return res.status(400).json({ error: 'Category and amount required' });
        const result = await col.insertOne({ category, amount: Number(amount), description: description || '', date: date ? new Date(date) : new Date(), paymentMode: paymentMode || 'cash', notes: notes || '', createdAt: new Date() });
        await cashFlow.insertOne({ type: 'expense', category, amount: Number(amount), description: description || category, date: date ? new Date(date) : new Date(), referenceId: result.insertedId.toString(), referenceType: 'expense', createdAt: new Date() });
        return res.status(201).json({ success: true, _id: result.insertedId });
      }
      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        await col.deleteOne({ _id: new ObjectId(id) });
        await cashFlow.deleteOne({ referenceId: id, referenceType: 'expense' });
        return res.status(200).json({ success: true });
      }
    }

    // ─── CASHFLOW ─────────────────────────────────────────────────
    if (module === 'cashflow') {
      const col = db.collection('cashFlow');

      if (req.method === 'GET') {
        const { from, to, type, period } = req.query;
        let fromDate, toDate;
        const now = new Date();
        if (period === 'today') { fromDate = new Date(new Date().setHours(0,0,0,0)); toDate = new Date(); }
        else if (period === 'week') { fromDate = new Date(now.setDate(now.getDate() - 7)); toDate = new Date(); }
        else if (period === 'month') { fromDate = new Date(now.getFullYear(), now.getMonth(), 1); toDate = new Date(); }
        else if (period === 'year') { fromDate = new Date(now.getFullYear(), 0, 1); toDate = new Date(); }
        else { if (from) fromDate = new Date(from); if (to) toDate = new Date(to); }
        const filter = {};
        if (fromDate || toDate) { filter.date = {}; if (fromDate) filter.date.$gte = fromDate; if (toDate) filter.date.$lte = toDate; }
        if (type) filter.type = type;
        const entries = await col.find(filter).sort({ date: -1 }).toArray();

        // ── ALL-TIME entries for cash position (no date filter) ──────────────
        const allEntries = await col.find({}).toArray();

        // Settled orderIds: delivery_collection only counts if admin has settled it
        const settledOrderIds = new Set(
          allEntries.filter(e => e.category === 'cash_settled' && e.orderId).map(e => e.orderId)
        );

        // ── PROPER 3-TIER P&L ────────────────────────────────────────────────
        // Excluded from P&L: financing (capital/loans), inventory_asset (PO balance payments),
        // advance_payment + supplier_payment (PO advance payments) — inventory cost is already
        // captured in cogs when goods are sold; counting PO payments again double-counts it.
        const PL_EXCLUDE = ['financing', 'inventory_asset', 'advance_payment', 'supplier_payment'];

        // Revenue = sales income only (filtered period)
        const revenue = entries
          .filter(e => e.type === 'income' && (e.category === 'sales' || (e.category === 'delivery_collection' && settledOrderIds.has(e.orderId))))
          .reduce((s, e) => s + e.amount, 0);

        // COGS = cost of goods sold per sale
        const cogs = entries
          .filter(e => e.type === 'expense' && e.category === 'cogs')
          .reduce((s, e) => s + e.amount, 0);

        // Gross Profit = Revenue - COGS
        const grossProfit = revenue - cogs;

        // Operating Expenses = all expenses except cogs and excluded categories
        const operatingExpense = entries
          .filter(e => e.type === 'expense' && e.category !== 'cogs' && !PL_EXCLUDE.includes(e.category))
          .reduce((s, e) => s + e.amount, 0);

        // Net Profit = Gross Profit - Operating Expenses
        const netProfit = grossProfit - operatingExpense;

        // Other income (non-sales, non-financing)
        const otherIncome = entries
          .filter(e => e.type === 'income' && e.category !== 'sales' && e.category !== 'delivery_collection' && !PL_EXCLUDE.includes(e.category))
          .reduce((s, e) => s + e.amount, 0);

        const operatingIncome = revenue + otherIncome;

        // ── CASH IN HAND: all-time cash/upi inflows - cash/upi outflows ─────
        // Exclude internal transfers (cash_settled, cash_handover, owner_deposit) from cash position
        const CASH_MODES = ['cash', 'upi', null, undefined, ''];
        const CASH_EXCLUDE_CATS = ['financing', 'cash_settled', 'cash_handover', 'owner_deposit'];
        const cashIn  = allEntries
          .filter(e => e.type === 'income'  && CASH_MODES.includes(e.paymentMode) && !CASH_EXCLUDE_CATS.includes(e.category) && (e.category !== 'delivery_collection' || settledOrderIds.has(e.orderId)))
          .reduce((s, e) => s + e.amount, 0);
        const cashOut = allEntries
          .filter(e => e.type === 'expense' && CASH_MODES.includes(e.paymentMode) && e.category !== 'financing' && e.category !== 'cogs')
          .reduce((s, e) => s + e.amount, 0);
        // Add financing cash inflows (opening capital cash portion) to cash position
        const finCashIn  = allEntries
          .filter(e => e.type === 'income'  && e.category === 'financing' && e.paymentMode === 'cash')
          .reduce((s, e) => s + e.amount, 0);
        const finCashOut = allEntries
          .filter(e => e.type === 'expense' && e.category === 'financing' && e.paymentMode === 'cash')
          .reduce((s, e) => s + e.amount, 0);
        const cashInHand = Math.max(0, cashIn + finCashIn - cashOut - finCashOut);

        // ── CASH AT BANK: all-time bank/card/neft inflows - outflows ────────
        const BANK_MODES = ['bank', 'card', 'neft', 'upi_bank'];
        const bankIn  = allEntries
          .filter(e => e.type === 'income'  && BANK_MODES.includes(e.paymentMode) && e.category !== 'financing')
          .reduce((s, e) => s + e.amount, 0);
        const bankOut = allEntries
          .filter(e => e.type === 'expense' && BANK_MODES.includes(e.paymentMode) && e.category !== 'financing' && e.category !== 'cogs')
          .reduce((s, e) => s + e.amount, 0);
        const finBankIn  = allEntries
          .filter(e => e.type === 'income'  && e.category === 'financing' && e.paymentMode === 'bank')
          .reduce((s, e) => s + e.amount, 0);
        const finBankOut = allEntries
          .filter(e => e.type === 'expense' && e.category === 'financing' && e.paymentMode === 'bank')
          .reduce((s, e) => s + e.amount, 0);
        const cashAtBank = Math.max(0, bankIn + finBankIn - bankOut - finBankOut);

        // Exclude internal transfer categories from visible entries
        const CF_HIDDEN = ['cogs', 'cash_settled', 'cash_handover', 'owner_deposit', 'delivery_collection'];
        return res.status(200).json({
          entries: entries.filter(e => !CF_HIDDEN.includes(e.category)),
          summary: {
            income:           operatingIncome,
            revenue,
            cogs,
            grossProfit,
            operatingExpense,
            expense:          operatingExpense,
            profit:           netProfit,
            netProfit,
            grossMargin:      revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
            netMargin:        revenue > 0 ? ((netProfit   / revenue) * 100).toFixed(1) : 0,
            cashInHand,
            cashAtBank,
          },
        });
      }
      if (req.method === 'POST') {
        const { type, category, amount, description, date, paymentMode, notes } = req.body;
        if (!type || !amount) return res.status(400).json({ error: 'Type and amount required' });
        const result = await col.insertOne({ type, category: category || 'other', amount: Number(amount), description: description || '', date: date ? new Date(date) : new Date(), paymentMode: paymentMode || 'cash', notes: notes || '', createdAt: new Date() });
        return res.status(201).json({ success: true, _id: result.insertedId });
      }
      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        await col.deleteOne({ _id: new ObjectId(id) });
        return res.status(200).json({ success: true });
      }
    }

    // ─── REPORTS ─────────────────────────────────────────────────
    if (module === 'reports') {
      if (req.method === 'GET') {
        const { type } = req.query;
        const inventory = db.collection('inventory');
        const products = db.collection('products');
        const cashFlow = db.collection('cashFlow');
        const movements = db.collection('stockMovements');

        if (type === 'stock-shortage') {
          const allInventory = await inventory.find({ trackInventory: true }).toArray();
          const shortage = allInventory.filter(i => i.availableStock <= i.lowStockAlert).sort((a, b) => a.availableStock - b.availableStock);
          const enriched = await Promise.all(shortage.map(async (inv) => {
            const product = await products.findOne({ _id: new ObjectId(inv.productId) }).catch(() => null);
            return { productId: inv.productId, productName: product?.name || 'Unknown', category: product?.category || '-', image: product?.image || '', sku: inv.sku, currentStock: inv.currentStock, availableStock: inv.availableStock, lowStockAlert: inv.lowStockAlert, isOutOfStock: inv.availableStock === 0, reorderNeeded: inv.lowStockAlert - inv.availableStock, frontendStatus: inv.frontendStatus || 'normal' };
          }));
          return res.status(200).json(enriched);
        }

        if (type === 'low-performing') {
          const salesData = await movements.find({ type: 'out', reason: { $in: ['sale', 'website_order'] } }).toArray();
          const salesMap = {};
          salesData.forEach(m => { if (!salesMap[m.productId]) salesMap[m.productId] = 0; salesMap[m.productId] += m.quantity; });
          const allProducts = await products.find({}).toArray();
          const withSales = allProducts.map(p => ({ productId: p._id.toString(), productName: p.name, category: p.category, image: p.image, price: p.price, totalSold: salesMap[p._id.toString()] || 0 })).sort((a, b) => a.totalSold - b.totalSold);
          return res.status(200).json(withSales.slice(0, 20));
        }

        if (type === 'best-selling') {
          const salesData = await movements.find({ type: 'out' }).toArray();
          const salesMap = {};
          salesData.forEach(m => { if (!salesMap[m.productId]) salesMap[m.productId] = 0; salesMap[m.productId] += m.quantity; });
          const allProducts = await products.find({}).toArray();
          const withSales = allProducts.map(p => ({ productId: p._id.toString(), productName: p.name, category: p.category, image: p.image, price: p.price, totalSold: salesMap[p._id.toString()] || 0 })).sort((a, b) => b.totalSold - a.totalSold);
          return res.status(200).json(withSales.slice(0, 20));
        }

        if (type === 'profit-margin') {
          const allInventory = await inventory.find({}).toArray();
          const invMap = {};
          allInventory.forEach(i => { invMap[i.productId] = i; });
          const allProducts = await products.find({}).toArray();
          const withMargin = allProducts.map(p => {
            const pid = p._id.toString(); const inv = invMap[pid];
            const sellingPrice = parseFloat(p.discountedPrice || p.price || 0);
            const costPrice = inv?.costPrice || 0; const margin = sellingPrice - costPrice;
            const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : null;
            return { productId: pid, productName: p.name, category: p.category, image: p.image, sellingPrice, costPrice, margin, marginPct: marginPct ? parseFloat(marginPct) : null };
          }).sort((a, b) => (b.margin || 0) - (a.margin || 0));
          return res.status(200).json(withMargin);
        }

        if (type === 'pnl') {
          const { from, to } = req.query;
          const dateFilter = {};
          if (from || to) { dateFilter.date = {}; if (from) dateFilter.date.$gte = new Date(from); if (to) dateFilter.date.$lte = new Date(to); }
          // Exclude from P&L: financing (capital/loans), inventory_asset (PO balance payments),
          // advance_payment + supplier_payment (PO advance/post-receive payments).
          // Inventory cost hits P&L only as cogs when goods are sold — not when purchased.
          const PL_EXCLUDE = ['financing', 'inventory_asset', 'advance_payment', 'supplier_payment'];
          const allCashFlow = await cashFlow.find({ ...dateFilter, category: { $nin: PL_EXCLUDE } }).toArray();

          const revenue          = allCashFlow.filter(e => e.type === 'income'  && e.category === 'sales').reduce((s, e) => s + e.amount, 0);
          const cogs             = allCashFlow.filter(e => e.type === 'expense' && e.category === 'cogs').reduce((s, e) => s + e.amount, 0);
          const grossProfit      = revenue - cogs;
          const operatingExpenses = allCashFlow.filter(e => e.type === 'expense' && e.category !== 'cogs').reduce((s, e) => s + e.amount, 0);
          const otherIncome      = allCashFlow.filter(e => e.type === 'income' && e.category !== 'sales' && e.category !== 'delivery_collection').reduce((s, e) => s + e.amount, 0);
          const netProfit        = grossProfit + otherIncome - operatingExpenses;
          const totalIncome      = revenue + otherIncome;
          const totalExpenses    = cogs + operatingExpenses;

          const byCategory = {};
          allCashFlow.forEach(e => {
            const key = `${e.type}:${e.category || 'other'}`;
            if (!byCategory[key]) byCategory[key] = { type: e.type, category: e.category || 'other', total: 0, count: 0 };
            byCategory[key].total += e.amount; byCategory[key].count += 1;
          });

          return res.status(200).json({
            revenue, cogs, grossProfit,
            operatingExpenses, otherIncome,
            income: totalIncome, expenses: totalExpenses,
            profit: netProfit, netProfit,
            grossMargin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
            netMargin:   revenue > 0 ? ((netProfit   / revenue) * 100).toFixed(1) : 0,
            breakdown: Object.values(byCategory),
          });
        }

        if (type === 'stock-valuation') {
          const allInventory = await inventory.find({}).toArray();
          let totalValue = 0; let totalRetailValue = 0;
          const enriched = await Promise.all(allInventory.map(async (inv) => {
            const product = await products.findOne({ _id: new ObjectId(inv.productId) }).catch(() => null);
            const costValue = (inv.currentStock || 0) * (inv.costPrice || 0);
            const retailValue = (inv.currentStock || 0) * parseFloat(product?.price || 0);
            totalValue += costValue; totalRetailValue += retailValue;
            return { productId: inv.productId, productName: product?.name || 'Unknown', category: product?.category || '-', currentStock: inv.currentStock, unit: inv.unit, costPrice: inv.costPrice, retailPrice: parseFloat(product?.price || 0), costValue, retailValue };
          }));
          return res.status(200).json({ items: enriched, totalCostValue: totalValue, totalRetailValue, potentialProfit: totalRetailValue - totalValue });
        }

        return res.status(400).json({ error: 'Invalid report type' });
      }
    }

    // ─── FINANCING ────────────────────────────────────────────────────────────
    // Handles: opening capital, capital infusion, loans, repayments, withdrawals.
    //
    // Rules:
    //   • Every financing entry writes a mirrored cashFlow entry so the ledger
    //     is always complete (referenceType: 'financing').
    //   • Editing rebuilds the cashFlow mirrors — no stale data possible.
    //   • Deleting cascades: removes cashFlow mirrors first, then source record.
    //   • P&L reports exclude category:'financing' so capital/loans don't inflate
    //     revenue or operating expenses. Financing has its own summary view.
    //
    // cashFlow direction by type:
    //   opening_capital / capital_infusion / loan_received → income
    //   loan_repayment / owner_withdrawal                  → expense
    if (module === 'financing') {
      const auth = requireAuth(req, ['admin', 'manager']);
      if (!auth) return res.status(403).json({ error: 'Access denied' });

      const finCol   = db.collection('financing');
      const cfCol    = db.collection('cashFlow');

      const INCOME_TYPES  = ['opening_capital', 'capital_infusion', 'loan_received'];
      const EXPENSE_TYPES = ['loan_repayment', 'owner_withdrawal'];
      const ALL_TYPES     = [...INCOME_TYPES, ...EXPENSE_TYPES];
      const TYPE_LABELS   = {
        opening_capital:  'Opening Capital',
        capital_infusion: 'Capital Infusion',
        loan_received:    'Loan Received',
        loan_repayment:   'Loan Repayment',
        owner_withdrawal: 'Owner Withdrawal',
      };

      // Writes cashFlow mirror(s) for a financing entry.
      // If amount is split across cash and bank, creates two entries.
      async function writeMirrors(finId, type, amount, cashAmt, bankAmt, source, date) {
        const cfType = INCOME_TYPES.includes(type) ? 'income' : 'expense';
        const desc   = `${TYPE_LABELS[type]}${source ? ' — ' + source : ''}`;
        if (cashAmt > 0 && bankAmt > 0) {
          await cfCol.insertOne({ type: cfType, category: 'financing', amount: cashAmt,
            paymentMode: 'cash', description: `${desc} (Cash)`,
            referenceId: finId, referenceType: 'financing', date, createdAt: new Date() });
          await cfCol.insertOne({ type: cfType, category: 'financing', amount: bankAmt,
            paymentMode: 'bank', description: `${desc} (Bank)`,
            referenceId: finId, referenceType: 'financing', date, createdAt: new Date() });
        } else {
          const paymentMode = bankAmt > 0 ? 'bank' : cashAmt > 0 ? 'cash' : 'other';
          await cfCol.insertOne({ type: cfType, category: 'financing', amount,
            paymentMode, description: desc,
            referenceId: finId, referenceType: 'financing', date, createdAt: new Date() });
        }
      }

      // GET — list entries + summary
      if (req.method === 'GET') {
        const { type, from, to } = req.query;
        const filter = {};
        if (type) filter.type = type;
        if (from || to) {
          filter.date = {};
          if (from) filter.date.$gte = new Date(from);
          if (to)   filter.date.$lte = new Date(to);
        }
        const entries = await finCol.find(filter).sort({ date: -1 }).toArray();
        const totalCapital    = entries.filter(e => INCOME_TYPES.includes(e.type)).reduce((s, e) => s + e.amount, 0);
        const totalWithdrawn  = entries.filter(e => EXPENSE_TYPES.includes(e.type)).reduce((s, e) => s + e.amount, 0);
        const totalLoans      = entries.filter(e => e.type === 'loan_received').reduce((s, e) => s + e.amount, 0);
        const totalRepaid     = entries.filter(e => e.type === 'loan_repayment').reduce((s, e) => s + e.amount, 0);
        return res.status(200).json({
          entries: entries.filter(e => e.category !== 'cogs'),
          summary: {
            totalCapital,
            totalWithdrawn,
            netCapital:      totalCapital - totalWithdrawn,
            totalCash:       entries.reduce((s, e) => s + (e.cashAmount || 0), 0),
            totalBank:       entries.reduce((s, e) => s + (e.bankAmount || 0), 0),
            totalLoans,
            totalRepaid,
            outstandingLoan: Math.max(0, totalLoans - totalRepaid),
          },
        });
      }

      // POST — create
      if (req.method === 'POST') {
        const { type, amount, cashAmount, bankAmount, source, date, notes } = req.body;
        if (!type || !ALL_TYPES.includes(type))
          return res.status(400).json({ error: `type must be one of: ${ALL_TYPES.join(', ')}` });
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
          return res.status(400).json({ error: 'amount must be a positive number' });
        const totalAmt  = Number(amount);
        const cashAmt   = Number(cashAmount) || 0;
        const bankAmt   = Number(bankAmount)  || 0;
        if (cashAmt + bankAmt > 0 && Math.abs(cashAmt + bankAmt - totalAmt) > 1)
          return res.status(400).json({ error: 'cashAmount + bankAmount must equal total amount' });
        const entryDate = date ? new Date(date) : new Date();
        const finResult = await finCol.insertOne({
          type, amount: totalAmt, cashAmount: cashAmt, bankAmount: bankAmt,
          source: source || '', notes: notes || '',
          date: entryDate, createdAt: new Date(), updatedAt: new Date(),
        });
        await writeMirrors(finResult.insertedId.toString(), type, totalAmt, cashAmt, bankAmt, source || '', entryDate);
        return res.status(201).json({ success: true, _id: finResult.insertedId });
      }

      // PUT — edit (rebuilds cashFlow mirrors to stay in sync)
      if (req.method === 'PUT') {
        const { id, type, amount, cashAmount, bankAmount, source, date, notes } = req.body;
        if (!id) return res.status(400).json({ error: 'id is required' });
        const existing = await finCol.findOne({ _id: new ObjectId(id) });
        if (!existing) return res.status(404).json({ error: 'Entry not found' });
        const newType   = type       || existing.type;
        const newAmount = amount     !== undefined ? Number(amount)     : existing.amount;
        const newCash   = cashAmount !== undefined ? Number(cashAmount) : existing.cashAmount;
        const newBank   = bankAmount !== undefined ? Number(bankAmount) : existing.bankAmount;
        const newSource = source     !== undefined ? source : existing.source;
        const newNotes  = notes      !== undefined ? notes  : existing.notes;
        const newDate   = date       ? new Date(date) : existing.date;
        await finCol.updateOne({ _id: new ObjectId(id) },
          { $set: { type: newType, amount: newAmount, cashAmount: newCash, bankAmount: newBank,
                    source: newSource, notes: newNotes, date: newDate, updatedAt: new Date() } });
        // Rebuild mirrors — wipe stale entries, write fresh
        await cfCol.deleteMany({ referenceId: id, referenceType: 'financing' });
        await writeMirrors(id, newType, newAmount, newCash, newBank, newSource, newDate);
        return res.status(200).json({ success: true });
      }

      // DELETE — cascade to cashFlow mirrors
      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'id is required' });
        const existing = await finCol.findOne({ _id: new ObjectId(id) });
        if (!existing) return res.status(404).json({ error: 'Entry not found' });
        await cfCol.deleteMany({ referenceId: id, referenceType: 'financing' });
        await finCol.deleteOne({ _id: new ObjectId(id) });
        return res.status(200).json({ success: true });
      }
    }


    // ─── AP/AR LEDGER (?module=ledger) ───────────────────────────────────────
    // Accounts Payable (suppliers) and Accounts Receivable (customers)
    // Handles: advance payments, partial payments, credit notes, running balances
    if (module === 'ledger') {
      const suppliersCol   = db.collection('suppliers');
      const ledgerCol      = db.collection('ledgerEntries');
      const cashFlow       = db.collection('cashFlow');

      if (req.method === 'GET') {
        const { partyType, partyId } = req.query;

        if (partyId) {
          const entries = await ledgerCol
            .find({ partyId, partyType: partyType || 'supplier' })
            .sort({ date: -1 })
            .toArray();

          let runningBalance = 0;
          const withBalance = entries.slice().reverse().map(e => {
            if (e.entryType === 'credit') runningBalance += e.amount;
            if (e.entryType === 'debit')  runningBalance -= e.amount;
            return { ...e, runningBalance };
          }).reverse();

          const totalCredit = entries.filter(e => e.entryType === 'credit').reduce((s, e) => s + e.amount, 0);
          const totalDebit  = entries.filter(e => e.entryType === 'debit').reduce((s, e)  => s + e.amount, 0);
          const netBalance  = totalCredit - totalDebit;

          return res.status(200).json({
            entries: withBalance,
            summary: { totalCredit, totalDebit, netBalance,
              status: netBalance > 0 ? 'payable' : netBalance < 0 ? 'receivable' : 'settled' }
          });
        }

        // All suppliers with AP balances
        const suppliers = await suppliersCol.find({}).toArray();
        const enriched = await Promise.all(suppliers.map(async (s) => {
          const sid = s._id.toString();
          const entries = await ledgerCol.find({ partyId: sid, partyType: 'supplier' }).toArray();
          const totalCredit = entries.filter(e => e.entryType === 'credit').reduce((sum, e) => sum + e.amount, 0);
          const totalDebit  = entries.filter(e => e.entryType === 'debit').reduce((sum, e)  => sum + e.amount, 0);
          const netBalance  = totalCredit - totalDebit;
          return { ...s, totalCredit, totalDebit, netBalance,
            status: netBalance > 0 ? 'payable' : netBalance < 0 ? 'receivable' : 'settled',
            lastActivity: entries[0]?.date || null };
        }));
        const totalPayable    = enriched.filter(s => s.netBalance > 0).reduce((s, e) => s + e.netBalance, 0);
        const totalReceivable = enriched.filter(s => s.netBalance < 0).reduce((s, e) => s + Math.abs(e.netBalance), 0);
        return res.status(200).json({ suppliers: enriched, summary: { totalPayable, totalReceivable } });
      }

      if (req.method === 'POST') {
        const { partyType = 'supplier', partyId, partyName, entryType, amount,
                description, referenceType, referenceId, paymentMode, date, notes } = req.body;
        if (!partyId || !entryType || !amount)
          return res.status(400).json({ error: 'partyId, entryType and amount required' });
        if (!['credit', 'debit'].includes(entryType))
          return res.status(400).json({ error: 'entryType must be credit or debit' });

        const entryDate = date ? new Date(date) : new Date();
        const result = await ledgerCol.insertOne({
          partyType, partyId, partyName: partyName || '',
          entryType, amount: Number(amount),
          description: description || '',
          referenceType: referenceType || 'manual',
          referenceId: referenceId || null,
          paymentMode: paymentMode || null,
          notes: notes || '',
          date: entryDate, createdAt: new Date(),
        });

        // If payment (debit), record in cashFlow for cash position tracking
        if (entryType === 'debit' && ['advance_payment','payment','manual'].includes(referenceType || 'manual')) {
          await cashFlow.insertOne({
            type: 'expense', category: 'supplier_payment',
            amount: Number(amount),
            paymentMode: paymentMode || 'cash',
            description: description || `Payment to ${partyName || partyId}`,
            referenceId: result.insertedId.toString(),
            referenceType: 'ledger_payment',
            partyId, partyType,
            date: entryDate, createdAt: new Date(),
          });
        }
        return res.status(201).json({ success: true, _id: result.insertedId });
      }

      if (req.method === 'PUT') {
        const { id, amount, description, notes, date } = req.body;
        if (!id) return res.status(400).json({ error: 'id required' });
        const update = { updatedAt: new Date() };
        if (amount !== undefined) update.amount = Number(amount);
        if (description !== undefined) update.description = description;
        if (notes !== undefined) update.notes = notes;
        if (date) update.date = new Date(date);
        await ledgerCol.updateOne({ _id: new ObjectId(id) }, { $set: update });
        return res.status(200).json({ success: true });
      }

      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'id required' });
        await cashFlow.deleteMany({ referenceId: id, referenceType: 'ledger_payment' });
        await ledgerCol.deleteOne({ _id: new ObjectId(id) });
        return res.status(200).json({ success: true });
      }
    }

    // ─── REGENERATE BOOKS (?module=regenerate) ────────────────────────────────
    //
    // scope = 'ledger' (default) → rebuild PO ledger entries only
    // scope = 'full'             → rebuild ALL cashflow entries from source documents:
    //   • sales         → referenceType: 'sale', 'sale_cogs'
    //   • orders        → referenceType: 'order_delivery', 'order_cogs'
    //   • expenses      → referenceType: 'expense'
    //   • financing     → referenceType: 'financing'
    //   • purchase orders → referenceType: 'po_advance', 'purchase_order', etc.
    //   • ledger payments → referenceType: 'ledger_payment'
    //
    // 'full' wipes ALL cashflow entries and rebuilds from scratch — this also
    // fixes any duplicates (e.g. double delivery_collection from the old frontend bug).
    if (module === 'regenerate') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

      const { scope = 'ledger' } = req.body || {};
      const purchaseOrders = db.collection('purchaseOrders');
      const ordersCol      = db.collection('orders');
      const salesCol       = db.collection('sales');
      const expensesCol    = db.collection('expenses');
      const finCol         = db.collection('financing');
      const inventoryCol   = db.collection('inventory');
      const ledgerCol      = db.collection('ledgerEntries');
      const cfCol          = db.collection('cashFlow');
      const log            = [];

      // ── STEP 1: Delete stale entries ─────────────────────────────────────────
      const ledgerDel = await ledgerCol.deleteMany({
        referenceType: { $in: ['po_advance', 'advance_payment', 'purchase_order', 'po_shortage',
          'po_shortage_refund', 'po_shortage_goods', 'po_goods_received'] },
      });
      log.push(`Deleted ${ledgerDel.deletedCount} PO ledger entries`);

      let cashDelCount = 0;
      if (scope === 'full') {
        // Step A: delete by referenceType (covers all properly-tagged auto-generated entries)
        const cashDel1 = await cfCol.deleteMany({
          referenceType: { $in: [
            'sale', 'sale_cogs',
            'order_delivery', 'order_cogs', 'order',
            'po_advance', 'purchase_order', 'po_receipt', 'po_resolution',
            'po_shortage_refund', 'advance_payment', 'po_return', 'ledger_payment',
            'expense', 'financing',
          ]},
        });
        // Step B: delete only system-generated delivery_collection entries (referenceType: 'order_delivery')
        // DO NOT delete entries without referenceType or with referenceType != 'order_delivery'
        // Those are manually created by admin (settle confirmations) and must be preserved
        const cashDel2 = await cfCol.deleteMany({
          category: 'delivery_collection',
          referenceType: 'order_delivery',
        });
        // Also protect cash_settled, cash_handover, owner_deposit — never delete these on regenerate
        cashDelCount = cashDel1.deletedCount + cashDel2.deletedCount;
        log.push(`Deleted ${cashDelCount} cashflow entries`);
      }

      let ledgerCreated = 0;
      let cashCreated   = 0;

      // ── STEP 2: Rebuild PO ledger entries (always) ───────────────────────────
      const allPOs = await purchaseOrders.find({}).toArray();

      for (const po of allPOs) {
        const poId         = po._id.toString();
        const supplierName = po.supplier?.name || '';
        const poDate       = po.createdAt || new Date();

        let resolvedSupplierId = po.supplierId || null;
        if (!resolvedSupplierId && supplierName) {
          const sup = await db.collection('suppliers').findOne({ name: supplierName });
          if (sup) resolvedSupplierId = sup._id.toString();
        }
        if (!resolvedSupplierId) resolvedSupplierId = poId; // last-resort fallback

        // ── Advance payments ────────────────────────────────────────────────────
        // Read from cashFlow (source of truth for advance amounts)
        const advCfEntries = await cfCol.find({
          referenceId: poId,
          referenceType: { $in: ['po_advance', 'advance_payment'] },
        }).toArray();

        for (const adv of advCfEntries) {
          await ledgerCol.insertOne({
            partyType: 'supplier', partyId: resolvedSupplierId, partyName: supplierName,
            entryType: 'debit', amount: adv.amount,
            description: `Advance payment — ${po.poNumber}`,
            referenceType: 'advance_payment', referenceId: poId,
            paymentMode: adv.paymentMode || 'cash',
            date: adv.date || poDate, createdAt: new Date(),
          });
          ledgerCreated++;
        }

        // Fallback: if full scope wiped cashFlow but PO has paidAmount, recreate both
        if (scope === 'full' && advCfEntries.length === 0 && (po.paidAmount || 0) > 0) {
          await cfCol.insertOne({
            type: 'expense', category: 'advance_payment',
            amount: po.paidAmount,
            description: `Advance Payment — PO ${po.poNumber} — ${supplierName}`,
            referenceType: 'po_advance', referenceId: poId,
            paymentMode: 'cash',
            date: poDate, createdAt: new Date(),
          });
          cashCreated++;
          await ledgerCol.insertOne({
            partyType: 'supplier', partyId: resolvedSupplierId, partyName: supplierName,
            entryType: 'debit', amount: po.paidAmount,
            description: `Advance payment — ${po.poNumber}`,
            referenceType: 'advance_payment', referenceId: poId,
            paymentMode: 'cash',
            date: poDate, createdAt: new Date(),
          });
          ledgerCreated++;
        }

        // ── Goods received ──────────────────────────────────────────────────────
        if (['received', 'partially_returned', 'returned'].includes(po.status)) {
          const invoicedAmount = po.totalAmount || 0;
          if (invoicedAmount > 0) {
            await ledgerCol.insertOne({
              partyType: 'supplier', partyId: resolvedSupplierId, partyName: supplierName,
              entryType: 'credit', amount: invoicedAmount,
              description: `Goods received — ${po.poNumber}`,
              referenceType: 'purchase_order', referenceId: poId,
              date: po.receivedDate || po.receivedAt || poDate, createdAt: new Date(),
            });
            ledgerCreated++;

            // Rebuild balance-due-on-delivery cashflow entry if scope=full
            if (scope === 'full') {
              const advancePaid = po.paidAmount || 0;
              const balanceDue  = Math.max(0, invoicedAmount - advancePaid);
              if (balanceDue > 0.01) {
                await cfCol.insertOne({
                  type: 'expense', category: 'inventory_asset', amount: balanceDue,
                  paymentMode: po.paymentMode || 'cash',
                  description: `Balance Payment on Delivery — PO ${po.poNumber} — ${supplierName}`,
                  referenceId: poId, referenceType: 'purchase_order',
                  poNumber: po.poNumber, supplierName,
                  date: po.receivedDate || po.receivedAt || poDate, createdAt: new Date(),
                });
                cashCreated++;
              }
            }
          }
        }

        // ── Shortage debit (unresolved) ─────────────────────────────────────────
        if (po.shortageItems?.length && po.shortageValue > 0 && !po.shortageResolved) {
          await ledgerCol.insertOne({
            partyType: 'supplier', partyId: resolvedSupplierId, partyName: supplierName,
            entryType: 'debit', amount: po.shortageValue,
            description: `Shortage / goods not received — ${po.poNumber} (${po.shortageItems.map(i => `${i.productName}: ${i.shortageQty} short`).join(', ')})`,
            referenceType: 'po_shortage', referenceId: poId,
            date: po.receivedDate || po.receivedAt || poDate, createdAt: new Date(),
          });
          ledgerCreated++;
        }

        // ── Shortage resolved ───────────────────────────────────────────────────
        if (po.shortageItems?.length && po.shortageValue > 0 && po.shortageResolved) {
          await ledgerCol.insertOne({
            partyType: 'supplier', partyId: resolvedSupplierId, partyName: supplierName,
            entryType: 'debit', amount: po.shortageValue,
            description: `Shortage / goods not received — ${po.poNumber}`,
            referenceType: 'po_shortage', referenceId: poId,
            date: po.receivedDate || po.receivedAt || poDate, createdAt: new Date(),
          });
          ledgerCreated++;

          if (po.shortageResolveType === 'refund' && po.shortageRefundAmount > 0) {
            await ledgerCol.insertOne({
              partyType: 'supplier', partyId: resolvedSupplierId, partyName: supplierName,
              entryType: 'credit', amount: po.shortageRefundAmount,
              description: `Shortage refund received — ${po.poNumber}`,
              referenceType: 'po_shortage_refund', referenceId: poId,
              date: po.shortageResolvedAt || poDate, createdAt: new Date(),
            });
            ledgerCreated++;
          } else if (po.shortageResolveType === 'goods') {
            await ledgerCol.insertOne({
              partyType: 'supplier', partyId: resolvedSupplierId, partyName: supplierName,
              entryType: 'credit', amount: po.shortageValue,
              description: `Shortage resolved (goods delivered) — ${po.poNumber}`,
              referenceType: 'po_shortage_goods', referenceId: poId,
              date: po.shortageResolvedAt || poDate, createdAt: new Date(),
            });
            ledgerCreated++;
          }
        }

        log.push(`PO ${po.poNumber}: ledger rebuilt`);
      }

      // ── STEP 3: Rebuild all cashflow entries (scope=full only) ───────────────
      if (scope === 'full') {

        // ── 3a. Sales (direct POS/walk-in sales) ─────────────────────────────
        // Only rebuild sales that are NOT linked to a whatsapp order
        // (whatsapp order cashflow is rebuilt from orders in step 3b)
        const allSales = await salesCol.find({ paymentMode: { $ne: 'whatsapp' }, $or: [{ orderId: { $exists: false } }, { orderId: null }, { orderId: '' }] }).toArray();
        for (const sale of allSales) {
          const saleId   = sale._id.toString();
          const saleDate = sale.date || sale.createdAt || new Date();

          if (sale.paymentMode === 'mixed') {
            const cashAmt  = Number(sale.mixedCashAmount)  || 0;
            const otherAmt = Number(sale.mixedOtherAmount) || 0;
            if (cashAmt > 0) {
              await cfCol.insertOne({
                type: 'income', category: 'sales', amount: cashAmt,
                paymentMode: 'cash',
                description: `Sale ${sale.saleNumber} — Cash portion — ${sale.customerName || 'Customer'}`,
                referenceId: saleId, referenceType: 'sale',
                date: saleDate, createdAt: new Date(),
              });
              cashCreated++;
            }
            if (otherAmt > 0) {
              await cfCol.insertOne({
                type: 'income', category: 'sales', amount: otherAmt,
                paymentMode: sale.mixedOtherMode || 'upi',
                description: `Sale ${sale.saleNumber} — ${(sale.mixedOtherMode || 'upi').toUpperCase()} portion — ${sale.customerName || 'Customer'}`,
                referenceId: saleId, referenceType: 'sale',
                date: saleDate, createdAt: new Date(),
              });
              cashCreated++;
            }
          } else {
            await cfCol.insertOne({
              type: 'income', category: 'sales', amount: sale.totalAmount || 0,
              paymentMode: sale.paymentMode || 'cash',
              description: `Sale ${sale.saleNumber} — ${sale.customerName || 'Customer'}`,
              referenceId: saleId, referenceType: 'sale',
              date: saleDate, createdAt: new Date(),
            });
            cashCreated++;
          }

          // COGS for this sale
          let totalCOGS = 0;
          for (const item of (sale.items || [])) {
            if (!item.productId) continue;
            const inv = await inventoryCol.findOne({ productId: item.productId });
            if (inv && inv.costPrice > 0) totalCOGS += inv.costPrice * (Number(item.quantity) || 1);
          }
          if (totalCOGS > 0) {
            await cfCol.insertOne({
              type: 'expense', category: 'cogs', amount: totalCOGS,
              description: `Cost of goods — Sale ${sale.saleNumber}`,
              referenceId: saleId, referenceType: 'sale_cogs',
              date: saleDate, createdAt: new Date(),
            });
            cashCreated++;
          }
          log.push(`Sale ${sale.saleNumber}: cashflow rebuilt`);
        }

        // ── 3b. Orders (whatsapp/delivery orders) ────────────────────────────
        const allOrders = await ordersCol.find({ status: 'delivered' }).toArray();
        for (const order of allOrders) {
          const orderId   = order._id.toString();
          const orderDate = order.deliveredAt || order.updatedAt || order.createdAt || new Date();

          // Only write delivery_collection if cash was collected on delivery
          // AND it has not already been settled by admin (cash_settled entry exists)
          // This prevents regenerate from undoing admin settle confirmations
          const collectedAmount = Number(order.amountCollected) || order.totalAmount || 0;
          if (collectedAmount > 0 && order.paymentMode !== 'already_paid') {
            // Always recreate delivery_collection — it represents cash physically collected.
            // cash_settled entries are separate admin confirmations and are never deleted by regenerate.
            // Both can coexist: delivery_collection = cash collected, cash_settled = cash handed to admin.
            await cfCol.insertOne({
              type: 'income', category: 'delivery_collection',
              amount: collectedAmount,
              description: `Delivery collected – Order ${order.orderId || orderId} (${order.customerName})`,
              referenceId: orderId, referenceType: 'order_delivery',
              collectedBy: order.collectedBy || null,
              collectorName: order.collectorName || null,
              orderId: order.orderId || orderId,
              paymentMode: order.paymentMode || 'cash',
              date: orderDate, createdAt: new Date(),
            });
            cashCreated++;
          }

          // COGS for this order
          let totalCOGS = 0;
          for (const item of (order.items || [])) {
            if (!item.productId) continue;
            const inv = await inventoryCol.findOne({ productId: item.productId });
            if (inv && inv.costPrice > 0) totalCOGS += inv.costPrice * (Number(item.quantity) || 1);
          }
          if (totalCOGS > 0) {
            await cfCol.insertOne({
              type: 'expense', category: 'cogs', amount: totalCOGS,
              description: `Cost of goods – Order ${order.orderId || orderId}`,
              referenceId: orderId, referenceType: 'order_cogs',
              date: orderDate, createdAt: new Date(),
            });
            cashCreated++;
          }
          log.push(`Order ${order.orderId || orderId}: cashflow rebuilt`);
        }

        // ── 3c. Expenses ──────────────────────────────────────────────────────
        const allExpenses = await expensesCol.find({}).toArray();
        for (const exp of allExpenses) {
          await cfCol.insertOne({
            type: 'expense', category: exp.category || 'other',
            amount: Number(exp.amount) || 0,
            description: exp.description || exp.category,
            paymentMode: exp.paymentMode || 'cash',
            referenceId: exp._id.toString(), referenceType: 'expense',
            date: exp.date || exp.createdAt || new Date(), createdAt: new Date(),
          });
          cashCreated++;
        }
        log.push(`Rebuilt ${allExpenses.length} expense cashflow entries`);

        // ── 3d. Financing ─────────────────────────────────────────────────────
        const INCOME_FIN  = ['opening_capital', 'capital_infusion', 'loan_received'];
        const TYPE_LABELS = {
          opening_capital: 'Opening Capital', capital_infusion: 'Capital Infusion',
          loan_received: 'Loan Received', loan_repayment: 'Loan Repayment',
          owner_withdrawal: 'Owner Withdrawal',
        };
        const allFin = await finCol.find({}).toArray();
        for (const fin of allFin) {
          const finId  = fin._id.toString();
          const cfType = INCOME_FIN.includes(fin.type) ? 'income' : 'expense';
          const desc   = `${TYPE_LABELS[fin.type] || fin.type}${fin.source ? ' — ' + fin.source : ''}`;
          const finDate = fin.date || fin.createdAt || new Date();
          const cashAmt = Number(fin.cashAmount) || 0;
          const bankAmt = Number(fin.bankAmount) || 0;
          const total   = Number(fin.amount) || 0;
          if (cashAmt > 0 && bankAmt > 0) {
            await cfCol.insertOne({ type: cfType, category: 'financing', amount: cashAmt,
              paymentMode: 'cash', description: `${desc} (Cash)`,
              referenceId: finId, referenceType: 'financing', date: finDate, createdAt: new Date() });
            await cfCol.insertOne({ type: cfType, category: 'financing', amount: bankAmt,
              paymentMode: 'bank', description: `${desc} (Bank)`,
              referenceId: finId, referenceType: 'financing', date: finDate, createdAt: new Date() });
            cashCreated += 2;
          } else {
            const paymentMode = bankAmt > 0 ? 'bank' : cashAmt > 0 ? 'cash' : 'other';
            await cfCol.insertOne({ type: cfType, category: 'financing', amount: total,
              paymentMode, description: desc,
              referenceId: finId, referenceType: 'financing', date: finDate, createdAt: new Date() });
            cashCreated++;
          }
        }
        log.push(`Rebuilt ${allFin.length} financing cashflow entries`);
      }

      log.push(`Total: ${ledgerCreated} ledger entries created, ${cashCreated} cashflow entries created`);

      return res.status(200).json({
        success: true,
        ledgerDeleted: ledgerDel.deletedCount,
        ledgerCreated,
        cashDeleted: cashDelCount,
        cashCreated,
        log,
      });
    }

    // ─── DELIVERY MODULE ─────────────────────────────────────────────────────
    if (module === 'delivery') {
      const { action } = req.query;
      const ordersCol = db.collection('orders');
      const driverLoc = db.collection('driverLocations');
      const pushSubs  = db.collection('pushSubscriptions');
      const usersCol  = db.collection('users');

      // GET: list all active delivery boys (for admin assign dropdown)
      if (req.method === 'GET' && action === 'all_drivers') {
        const auth = requireAuth(req, ['admin', 'manager']);
        if (!auth) return res.status(403).json({ error: 'Forbidden' });
        const drivers = await usersCol.find(
          { role: 'delivery_boy', active: true },
          { projection: { passwordHash: 0, pinHash: 0 } }
        ).toArray();
        return res.status(200).json(drivers);
      }

      // GET: driver's own assigned orders
      if (req.method === 'GET' && action === 'my_orders') {
        const auth = requireAuth(req, ['delivery_boy']);
        if (!auth) return res.status(403).json({ error: 'Forbidden' });
        const myOrders = await ordersCol.find(
          { assignedDriverId: auth.userId, status: { $in: ['confirmed', 'out_for_delivery'] } }
        ).sort({ createdAt: -1 }).toArray();
        return res.status(200).json(myOrders);
      }

      if (req.method === 'PUT') {
        // Assign driver to order
        if (action === 'assign') {
          const auth = requireAuth(req, ['admin', 'manager']);
          if (!auth) return res.status(403).json({ error: 'Forbidden' });
          const { orderId, driverId, driverName } = req.body;
          if (!orderId || !driverId) return res.status(400).json({ error: 'orderId and driverId required' });
          await ordersCol.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { assignedDriverId: driverId, assignedDriverName: driverName || '', status: 'out_for_delivery', updatedAt: new Date() } }
          );
          // Push notification to driver
          const driverSub = await pushSubs.findOne({ adminId: `driver-${driverId}` });
          const order = await ordersCol.findOne({ _id: new ObjectId(orderId) });
          if (driverSub && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            try {
              const webpush = await import('web-push');
              webpush.default.setVapidDetails(
                `mailto:${process.env.ADMIN_EMAIL || 'admin@yourdomain.com'}`,
                process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY
              );
              const payload = JSON.stringify({
                title: '🚚 New Delivery Assigned!',
                body: `Order ${order?.orderId || orderId} → ${order?.customerName || 'Customer'}`,
                orderId, url: `/deliver/${orderId}`,
              });
              await webpush.default.sendNotification(driverSub.subscription, payload);
            } catch (e) { console.error('Driver push failed:', e.message); }
          }
          // ── EMAIL: out for delivery ──────────────────────────────────────
          if (order?.customerEmail) {
            const trackUrl = `${process.env.VITE_APP_URL || 'https://ta-gs.online'}/track/${orderId}`;
            sendOrderEmail(order.customerEmail, order.customerName, 'out_for_delivery', {
              orderId: order.orderId || orderId,
              items: order.items || [],
              totalAmount: order.totalAmount,
              deliveryAddress: order.deliveryAddress || '',
              trackUrl,
            }).catch(() => {});
          }
          return res.status(200).json({ success: true });
        }

        // Driver registers push subscription
        if (action === 'push_subscribe') {
          const auth = requireAuth(req, ['delivery_boy']);
          if (!auth) return res.status(403).json({ error: 'Forbidden' });
          const { subscription } = req.body;
          if (!subscription) return res.status(400).json({ error: 'subscription required' });
          await pushSubs.updateOne(
            { adminId: `driver-${auth.userId}` },
            { $set: { adminId: `driver-${auth.userId}`, subscription, updatedAt: new Date() } },
            { upsert: true }
          );
          return res.status(200).json({ success: true });
        }
      }

      return res.status(400).json({ error: 'Invalid delivery action' });
    }

    return res.status(400).json({ error: 'Invalid module. Use ?module=auth|users|suppliers|expenses|cashflow|reports|financing|ledger|regenerate|delivery' });
  } catch (error) {
    console.error('Business API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
