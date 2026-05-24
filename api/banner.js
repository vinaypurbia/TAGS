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

      // Email + password login (admin, manager)
      if (action === 'login' && req.method === 'POST') {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = await db.collection('users').findOne({ email: email.toLowerCase(), active: true });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (!['admin', 'manager'].includes(user.role)) return res.status(403).json({ error: 'Use PIN login for your role' });
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = signToken({ userId: user._id.toString(), name: user.name, email: user.email, role: user.role });
        await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
        return res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
      }

      // PIN login (associate, cashier)
      if (action === 'pin' && req.method === 'POST') {
        const { pin } = req.body;
        if (!pin) return res.status(400).json({ error: 'PIN required' });
        const allPinUsers = await db.collection('users').find({ role: { $in: ['associate', 'cashier'] }, active: true }).toArray();
        let matched = null;
        for (const u of allPinUsers) {
          if (u.pinHash && await bcrypt.compare(String(pin), u.pinHash)) { matched = u; break; }
        }
        if (!matched) return res.status(401).json({ error: 'Invalid PIN' });
        const token = signToken({ userId: matched._id.toString(), name: matched.name, role: matched.role });
        await db.collection('users').updateOne({ _id: matched._id }, { $set: { lastLogin: new Date() } });
        return res.status(200).json({ token, user: { id: matched._id, name: matched.name, role: matched.role } });
      }

      // Verify token
      if (action === 'verify' && req.method === 'GET') {
        const decoded = requireAuth(req);
        if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
        return res.status(200).json({ valid: true, user: decoded });
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
        const { name, email, role, password, pin } = req.body;
        if (!name || !role) return res.status(400).json({ error: 'Name and role required' });
        const validRoles = ['admin', 'manager', 'associate', 'cashier'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
        const doc = { name, role, active: true, createdAt: new Date(), updatedAt: new Date(), createdBy: auth.userId };
        if (['admin', 'manager'].includes(role)) {
          if (!email || !password) return res.status(400).json({ error: 'Email and password required for this role' });
          const exists = await col.findOne({ email: email.toLowerCase() });
          if (exists) return res.status(400).json({ error: 'Email already in use' });
          doc.email = email.toLowerCase();
          doc.passwordHash = await bcrypt.hash(password, 10);
        }
        if (['associate', 'cashier'].includes(role)) {
          if (!pin || String(pin).length < 4) return res.status(400).json({ error: '4-digit PIN required' });
          doc.pinHash = await bcrypt.hash(String(pin), 10);
          if (email) doc.email = email.toLowerCase();
        }
        const result = await col.insertOne(doc);
        return res.status(201).json({ success: true, _id: result.insertedId });
      }

      if (req.method === 'PUT') {
        const auth = requireAuth(req, ['admin']);
        if (!auth) return res.status(403).json({ error: 'Admin access required' });
        const { id, name, email, role, active, password, pin } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        const update = { updatedAt: new Date() };
        if (name) update.name = name;
        if (email) update.email = email.toLowerCase();
        if (role) update.role = role;
        if (typeof active === 'boolean') update.active = active;
        if (password) update.passwordHash = await bcrypt.hash(password, 10);
        if (pin) update.pinHash = await bcrypt.hash(String(pin), 10);
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
        const income = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
        const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
        return res.status(200).json({ entries, summary: { income, expense, profit: income - expense } });
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
          const filter = {};
          if (from || to) { filter.date = {}; if (from) filter.date.$gte = new Date(from); if (to) filter.date.$lte = new Date(to); }
          const allCashFlow = await cashFlow.find(filter).toArray();
          const income = allCashFlow.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
          const expenses = allCashFlow.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
          const byCategory = {};
          allCashFlow.forEach(e => { const key = `${e.type}:${e.category || 'other'}`; if (!byCategory[key]) byCategory[key] = { type: e.type, category: e.category || 'other', total: 0, count: 0 }; byCategory[key].total += e.amount; byCategory[key].count += 1; });
          return res.status(200).json({ income, expenses, profit: income - expenses, profitMargin: income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0, breakdown: Object.values(byCategory) });
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

    // ── DBSTATS MODULE (?module=dbstats) ───────────────────────
    if (req.query.module === 'dbstats') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      try {
        const dbStats = await db.command({ dbStats: 1, scale: 1024 });
        const collectionNames = await db.listCollections().toArray();
        const collections = await Promise.all(
          collectionNames.map(async (col) => {
            try {
              const stats = await db.command({ collStats: col.name, scale: 1024 });
              return {
                name: col.name,
                count: stats.count || 0,
                sizeMB: (stats.size || 0) / 1024,
                storageMB: (stats.storageSize || 0) / 1024,
              };
            } catch {
              return { name: col.name, count: 0, sizeMB: 0, storageMB: 0 };
            }
          })
        );
        collections.sort((a, b) => b.sizeMB - a.sizeMB);
        const storageSizeMB = (dbStats.storageSize || 0) / 1024;
        const indexSizeMB   = (dbStats.indexSize   || 0) / 1024;
        const totalSizeMB   = storageSizeMB + indexSizeMB;
        return res.status(200).json({
          storageSizeMB: totalSizeMB,
          dataSizeMB: (dbStats.dataSize || 0) / 1024,
          indexSizeMB,
          limitMB: 512,
          usedPct: Math.min(100, (totalSizeMB / 512) * 100),
          collections,
          totalCollections: collections.length,
          totalDocuments: collections.reduce((s, c) => s + c.count, 0),
        });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch DB stats', details: e.message });
      }
    }

    // ── CLOUDINARY STATS (?module=cloudinarystats) ─────────────
    if (req.query.module === 'cloudinarystats') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey    = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
          return res.status(200).json({ error: 'Cloudinary env vars not set. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to Vercel.' });
        }

        const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
          headers: { Authorization: `Basic ${credentials}` }
        });

        if (!response.ok) {
          return res.status(200).json({ error: `Cloudinary API error: ${response.status}` });
        }

        const usage = await response.json();
        const credits = usage.credits || {};

        return res.status(200).json({
          credits_used:           credits.usage                                          || 0,
          credits_limit:          credits.limit                                          || 25,
          credits_usage_percent:  credits.limit > 0 ? (credits.usage / credits.limit) * 100 : 0,
          storage_used_mb:        (usage.storage?.usage    || 0) / (1024 * 1024),
          storage_limit_mb:       (usage.storage?.limit    || 0) / (1024 * 1024),
          bandwidth_used_mb:      (usage.bandwidth?.usage  || 0) / (1024 * 1024),
          bandwidth_limit_mb:     (usage.bandwidth?.limit  || 0) / (1024 * 1024),
          resources:              usage.resources                                        || 0,
          transformations:        usage.transformations?.usage                           || 0,
          plan:                   usage.plan                                             || 'Free',
          last_updated:           usage.last_updated                                     || null,
        });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch Cloudinary stats', details: e.message });
      }
    }

    return res.status(400).json({ error: 'Invalid module. Use ?module=auth|users|suppliers|expenses|cashflow|reports|dbstats|cloudinarystats' });
  } catch (error) {
    console.error('Business API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
