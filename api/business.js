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
  // Primary: JWT token auth (for new auth system)
  const token = getTokenFromReq(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      if (roles.length && !roles.includes(decoded.role)) return null;
      return decoded;
    }
  }
  // Fallback: X-Admin-Key header (for old admin password system)
  const adminKey = req.headers['x-admin-key'];
  const ADMIN_PASSWORD = process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  if (adminKey && ADMIN_PASSWORD && adminKey === ADMIN_PASSWORD) {
    // Treat as admin role — passes all role checks
    if (roles.length && !roles.includes('admin')) return null;
    return { userId: 'admin', role: 'admin', name: 'Admin' };
  }
  return null;
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

        // ── ALL-TIME entries for cash position (no date filter) ──────────────
        const allEntries = await col.find({}).toArray();

        // ── PROPER 3-TIER P&L ────────────────────────────────────────────────
        // Excluded from P&L: financing (capital/loans), inventory_asset (PO purchases)
        const PL_EXCLUDE = ['financing', 'inventory_asset'];

        // Revenue = sales income only (filtered period)
        const revenue = entries
          .filter(e => e.type === 'income' && e.category === 'sales')
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
          .filter(e => e.type === 'income' && e.category !== 'sales' && !PL_EXCLUDE.includes(e.category))
          .reduce((s, e) => s + e.amount, 0);

        const operatingIncome = revenue + otherIncome;

        // ── CASH IN HAND: all-time cash/upi inflows - cash/upi outflows ─────
        const CASH_MODES = ['cash', 'upi', null, undefined, ''];
        const cashIn  = allEntries
          .filter(e => e.type === 'income'  && CASH_MODES.includes(e.paymentMode) && e.category !== 'financing')
          .reduce((s, e) => s + e.amount, 0);
        const cashOut = allEntries
          .filter(e => e.type === 'expense' && CASH_MODES.includes(e.paymentMode) && e.category !== 'financing')
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
          .filter(e => e.type === 'expense' && BANK_MODES.includes(e.paymentMode) && e.category !== 'financing')
          .reduce((s, e) => s + e.amount, 0);
        const finBankIn  = allEntries
          .filter(e => e.type === 'income'  && e.category === 'financing' && e.paymentMode === 'bank')
          .reduce((s, e) => s + e.amount, 0);
        const finBankOut = allEntries
          .filter(e => e.type === 'expense' && e.category === 'financing' && e.paymentMode === 'bank')
          .reduce((s, e) => s + e.amount, 0);
        const cashAtBank = Math.max(0, bankIn + finBankIn - bankOut - finBankOut);

        return res.status(200).json({
          entries,
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
          // Exclude financing and inventory_asset from P&L
          const PL_EXCLUDE = ['financing', 'inventory_asset'];
          const allCashFlow = await cashFlow.find({ ...dateFilter, category: { $nin: PL_EXCLUDE } }).toArray();

          const revenue          = allCashFlow.filter(e => e.type === 'income'  && e.category === 'sales').reduce((s, e) => s + e.amount, 0);
          const cogs             = allCashFlow.filter(e => e.type === 'expense' && e.category === 'cogs').reduce((s, e) => s + e.amount, 0);
          const grossProfit      = revenue - cogs;
          const operatingExpenses = allCashFlow.filter(e => e.type === 'expense' && e.category !== 'cogs').reduce((s, e) => s + e.amount, 0);
          const otherIncome      = allCashFlow.filter(e => e.type === 'income'  && e.category !== 'sales').reduce((s, e) => s + e.amount, 0);
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
          entries,
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

    // ─── REGENERATE LEDGER (?module=regenerate) ──────────────────────────────
    // Wipes all PO-linked ledger entries and rebuilds them from PO data
    // Safe: only touches ledgerEntries with referenceType in PO types
    // Manual entries (advance_payment added via ledger UI) are preserved
    if (module === 'regenerate') {
      const auth = requireAuth(req, ['admin']);
      if (!auth) return res.status(403).json({ error: 'Admin access required' });

      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

      const { scope = 'ledger' } = req.body;
      const poCol       = db.collection('purchaseOrders');
      const suppCol     = db.collection('suppliers');
      const ledgerCol   = db.collection('ledgerEntries');
      const cashFlow    = db.collection('cashFlow');

      const log = [];
      let ledgerDeleted = 0, ledgerCreated = 0, cashDeleted = 0, cashCreated = 0;

      // ── Step 1: Delete all PO-linked ledger entries ──────────────────────
      // Preserve manual ledger entries (referenceType = 'manual' or 'ledger_payment')
      const PO_LEDGER_TYPES = ['purchase_order', 'advance_payment', 'payment', 'overpayment', 'short_delivery'];
      const delLedger = await ledgerCol.deleteMany({ referenceType: { $in: PO_LEDGER_TYPES } });
      ledgerDeleted = delLedger.deletedCount;
      log.push(`Deleted ${ledgerDeleted} PO-linked ledger entries`);

      // ── Step 2: Delete all PO-linked cashflow entries ─────────────────────
      if (scope === 'full') {
        const PO_CASH_TYPES = ['po_advance', 'purchase_order', 'po_shortage', 'po_shortage_refund', 'po_resolution', 'supplier_payment', 'ledger_payment'];
        const delCash = await cashFlow.deleteMany({ referenceType: { $in: PO_CASH_TYPES } });
        cashDeleted = delCash.deletedCount;
        log.push(`Deleted ${cashDeleted} PO-linked cashflow entries`);
      }

      // ── Step 3: Rebuild from all POs ──────────────────────────────────────
      const allPOs = await poCol.find({}).sort({ createdAt: 1 }).toArray();
      log.push(`Processing ${allPOs.length} purchase orders...`);

      for (const po of allPOs) {
        const poId = po._id.toString();

        // Resolve supplier ID
        let supplierId = po.supplierId || null;
        if (!supplierId && po.supplier?.name) {
          const s = await suppCol.findOne({ name: po.supplier.name });
          if (s) supplierId = s._id.toString();
        }
        if (!supplierId) { log.push(`⚠️ Skipped ${po.poNumber} — supplier not found`); continue; }

        const supplierName = po.supplier?.name || '';
        const entries = [];

        // ── Advance payments ──────────────────────────────────────────────
        // Find cashflow advance entries for this PO
        const advanceEntries = await cashFlow.find({ referenceId: poId, referenceType: 'po_advance' }).toArray();
        for (const adv of advanceEntries) {
          entries.push({
            partyType: 'supplier', partyId: supplierId, partyName: supplierName,
            entryType: 'debit', amount: adv.amount,
            description: `Advance Payment — PO ${po.poNumber}${adv.description?.includes('—') ? ' — ' + adv.description.split('— ').slice(2).join('— ') : ''}`,
            referenceType: 'advance_payment', referenceId: poId,
            paymentMode: adv.paymentMode || 'cash', notes: '',
            date: adv.date || adv.createdAt, createdAt: new Date(),
          });
        }

        // ── If no cashflow advance entry, use paidAmount before receive ────
        if (advanceEntries.length === 0 && po.paidAmount > 0 && ['ordered', 'received'].includes(po.status)) {
          entries.push({
            partyType: 'supplier', partyId: supplierId, partyName: supplierName,
            entryType: 'debit', amount: po.paidAmount,
            description: `Advance Payment — PO ${po.poNumber}`,
            referenceType: 'advance_payment', referenceId: poId,
            paymentMode: 'cash', notes: '',
            date: po.orderDate || po.createdAt, createdAt: new Date(),
          });
        }

        // ── Goods received ────────────────────────────────────────────────
        if (['received', 'partially_returned', 'returned'].includes(po.status)) {
          const receivedItems = po.receivedItems || po.items || [];
          const totalReceivedValue = receivedItems.reduce((s, i) => {
            const qty = Number(i.quantityReceived ?? i.quantity) || 0;
            return s + qty * (Number(i.costPrice) || 0);
          }, 0);

          if (totalReceivedValue > 0) {
            const totalOrdered = (po.items || []).reduce((s, i) => s + Number(i.quantity), 0);
            const totalReceived = receivedItems.reduce((s, i) => s + Number(i.quantityReceived ?? i.quantity), 0);
            entries.push({
              partyType: 'supplier', partyId: supplierId, partyName: supplierName,
              entryType: 'credit', amount: totalReceivedValue,
              description: `Goods received — PO ${po.poNumber} (${totalReceived}/${totalOrdered} units)`,
              referenceType: 'purchase_order', referenceId: poId,
              paymentMode: null, notes: '',
              date: po.receivedDate || po.updatedAt, createdAt: new Date(),
            });
          }

          // ── Short delivery credit note ────────────────────────────────
          if (po.shortageItems?.length > 0 && po.shortageValue > 0) {
            entries.push({
              partyType: 'supplier', partyId: supplierId, partyName: supplierName,
              entryType: 'debit', amount: po.shortageValue,
              description: `Short delivery credit note — PO ${po.poNumber} (₹${po.shortageValue.toFixed(2)} claimable)`,
              referenceType: 'short_delivery', referenceId: poId,
              paymentMode: null,
              notes: po.shortageItems.map((s) => `${s.productName}: ordered ${s.orderedQty}, received ${s.receivedQty}`).join('; '),
              date: po.receivedDate || po.updatedAt, createdAt: new Date(),
            });
          }
        }

        // ── Cashflow regeneration (scope=full only) ───────────────────────
        if (scope === 'full') {
          // Advance payment cashflow — only if not already there
          const existingAdv = await cashFlow.findOne({ referenceId: poId, referenceType: 'po_advance' });
          if (!existingAdv && po.paidAmount > 0) {
            await cashFlow.insertOne({
              type: 'expense', category: 'advance_payment', amount: po.paidAmount,
              paymentMode: 'cash',
              description: `Advance Payment — PO ${po.poNumber} — ${supplierName}`,
              referenceId: poId, referenceType: 'po_advance',
              supplierName, poNumber: po.poNumber,
              date: po.orderDate || po.createdAt, createdAt: new Date(),
            });
            cashCreated++;
          }
        }

        // Insert all ledger entries for this PO
        if (entries.length > 0) {
          await ledgerCol.insertMany(entries);
          ledgerCreated += entries.length;
          log.push(`✅ ${po.poNumber}: ${entries.length} ledger entries created`);
        } else {
          log.push(`⏭️ ${po.poNumber}: no entries needed (${po.status})`);
        }
      }

      log.push(`Done! Created ${ledgerCreated} ledger entries, ${cashCreated} cashflow entries`);
      return res.status(200).json({
        success: true,
        ledgerDeleted, ledgerCreated,
        cashDeleted, cashCreated,
        log,
      });
    }

    // ─── NOTIFICATIONS (?module=notifications) ───────────────────────────────
    if (module === 'notifications') {
      const { action } = req.query;
      // Save FCM push token for sending notifications later
      if (action === 'save-token' && req.method === 'POST') {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token required' });
        const col = db.collection('pushTokens');
        // Upsert — same token may arrive multiple times
        await col.updateOne(
          { token },
          { $set: { token, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: 'Invalid notifications action' });
    }

    return res.status(400).json({ error: 'Invalid module. Use ?module=auth|users|suppliers|expenses|cashflow|reports|financing|ledger|regenerate|notifications' });
  } catch (error) {
    console.error('Business API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
