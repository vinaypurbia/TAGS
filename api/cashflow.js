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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const cashFlow  = db.collection('cashFlow');
    const financing = db.collection('financing');

    // ─────────────────────────────────────────────
    // GET /api/cashflow
    // ?summary=true        → totals only (income, expense, net)
    // ?type=income|expense → filter by type
    // ?category=sale|...   → filter by category
    // ?from=YYYY-MM-DD&to=YYYY-MM-DD → date range
    // ?month=2026-05       → specific month
    // ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const { summary, type, category, from, to, month, collectorBalances } = req.query;

      // ── COLLECTOR BALANCES ──────────────────────────────────────
      // Returns current cash-in-hand per collector (collections minus handovers)
      if (collectorBalances === 'true') {
        // All delivery collections
        const collections = await cashFlow
          .find({ category: 'delivery_collection' })
          .toArray();

        // All handovers (debits against collectors)
        const handovers = await cashFlow
          .find({ category: 'cash_handover' })
          .toArray();

        // Group collections by collector key
        const balanceMap: Record<string, any> = {};
        collections.forEach((e: any) => {
          const key = `${e.collectedBy}::${e.collectorName || ''}`;
          if (!balanceMap[key]) {
            balanceMap[key] = {
              collectedBy: e.collectedBy,
              collectorName: e.collectorName || null,
              balance: 0,
              collected: 0,
              handedOver: 0,
              count: 0,
            };
          }
          balanceMap[key].balance += e.amount;
          balanceMap[key].collected += e.amount;
          balanceMap[key].count += 1;
        });

        // Subtract handovers
        handovers.forEach((e: any) => {
          const key = `${e.collectedBy}::${e.collectorName || ''}`;
          if (balanceMap[key]) {
            balanceMap[key].balance -= e.amount;
            balanceMap[key].handedOver += e.amount;
          }
        });

        // Return only those with a positive balance
        const result = Object.values(balanceMap).filter((c: any) => c.balance > 0);
        return res.status(200).json(result);
      }

      // Build date filter
      const filter = {};
      if (type) filter.type = type;
      if (category) filter.category = category;

      if (month) {
        const [y, m] = month.split('-');
        const start = new Date(Number(y), Number(m) - 1, 1);
        const end = new Date(Number(y), Number(m), 1);
        filter.date = { $gte: start, $lt: end };
      } else if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
      }

      // Summary mode — proper 3-tier P&L
      // Excluded from P&L: 'financing' (capital/loans) and 'inventory_asset' (PO purchases)
      // COGS is included as it's the direct cost of goods sold
      if (summary === 'true') {
        const P&L_EXCLUDE = ['financing', 'inventory_asset'];
        const all = await cashFlow.find({ ...filter, category: { $nin: P&L_EXCLUDE } }).toArray();

        // Revenue = sales income only
        const revenue = all
          .filter((e) => e.type === 'income' && e.category === 'sales')
          .reduce((s, e) => s + e.amount, 0);

        // COGS = cost of goods sold (recorded per sale)
        const cogs = all
          .filter((e) => e.type === 'expense' && e.category === 'cogs')
          .reduce((s, e) => s + e.amount, 0);

        // Gross Profit = Revenue - COGS
        const grossProfit = revenue - cogs;

        // Operating Expenses = all expenses EXCEPT cogs, financing, inventory_asset
        const operatingExpenses = all
          .filter((e) => e.type === 'expense' && e.category !== 'cogs')
          .reduce((s, e) => s + e.amount, 0);

        // Net Profit = Gross Profit - Operating Expenses
        const netProfit = grossProfit - operatingExpenses;

        // Other income (non-sales)
        const otherIncome = all
          .filter((e) => e.type === 'income' && e.category !== 'sales')
          .reduce((s, e) => s + e.amount, 0);

        const totalIncome  = revenue + otherIncome;
        const totalExpense = cogs + operatingExpenses;

        // Category breakdown
        const breakdown = {};
        all.forEach((e) => {
          const key = `${e.type}_${e.category}`;
          breakdown[key] = (breakdown[key] || 0) + e.amount;
        });

        // Monthly trend (last 6 months) — operating only
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const trend = await cashFlow
          .find({ date: { $gte: sixMonthsAgo }, category: { $nin: P&L_EXCLUDE } })
          .sort({ date: 1 })
          .toArray();

        const monthlyMap = {};
        trend.forEach((e) => {
          const d = new Date(e.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0, grossProfit: 0 };
          if (e.type === 'income') monthlyMap[key].income += e.amount;
          if (e.type === 'expense') monthlyMap[key].expense += e.amount;
          monthlyMap[key].grossProfit = monthlyMap[key].income - monthlyMap[key].expense;
        });

        return res.status(200).json({
          revenue,
          cogs,
          grossProfit,
          operatingExpenses,
          netProfit,
          otherIncome,
          totalIncome,
          totalExpense,
          grossMargin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
          netMargin:   revenue > 0 ? ((netProfit   / revenue) * 100).toFixed(1) : 0,
          breakdown,
          monthlyTrend: monthlyMap,
          count: all.length,
        });
      }

      // Full ledger
      const entries = await cashFlow
        .find(filter)
        .sort({ date: -1 })
        .toArray();

      return res.status(200).json(entries);
    }

    // ─────────────────────────────────────────────
    // POST /api/cashflow
    // Manual entry
    // Body: { type, category, amount, description, date, referenceId }
    // ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const {
        type,
        category = 'other',
        amount,
        description = '',
        date,
        referenceId = null,
        referenceType = null,
        paymentMode = null,
        collectedBy = null,
        collectorName = null,
        orderId = null,
        handoverTo = null,
      } = req.body;

      if (!type || !['income', 'expense', 'transfer'].includes(type)) {
        return res.status(400).json({ error: 'type must be "income", "expense", or "transfer"' });
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }

      const entry = {
        type,
        category,
        amount: Number(amount),
        description,
        referenceId,
        referenceType,
        paymentMode,
        collectedBy,
        collectorName,
        orderId,
        handoverTo,
        date: date ? new Date(date) : new Date(),
        createdAt: new Date(),
      };

      const result = await cashFlow.insertOne(entry);
      return res.status(201).json({ success: true, _id: result.insertedId });
    }

    // ─────────────────────────────────────────────
    // PUT /api/cashflow — edit a manual entry
    // ─────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      delete updateData._id;
      if (updateData.date) updateData.date = new Date(updateData.date);
      if (updateData.amount) updateData.amount = Number(updateData.amount);
      updateData.updatedAt = new Date();

      const result = await cashFlow.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Entry not found' });
      return res.status(200).json({ success: true });
    }

    // ─────────────────────────────────────────────
    // DELETE /api/cashflow
    // ─────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const result = await cashFlow.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Entry not found' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Cash Flow API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCING MODULE  —  /api/cashflow?module=financing
//
// Handles: opening capital, capital infusion, loans, repayments, withdrawals.
//
// Rules:
//   • Every financing entry ALSO writes a mirrored cashFlow entry so the
//     ledger stays complete and consistent.
//   • Deleting a financing entry cascades to delete its cashFlow mirror.
//   • P&L reports EXCLUDE financing (capital & loans are not revenue/expense).
//   • cashFlow entries use referenceType='financing' for clean identification.
//
// Types and their cashFlow direction:
//   opening_capital  → income  (money entering the business)
//   capital_infusion → income
//   loan_received    → income
//   loan_repayment   → expense (money leaving the business)
//   owner_withdrawal → expense
// ─────────────────────────────────────────────────────────────────────────────
export async function financingHandler(req, res) {
  const INCOME_TYPES  = ['opening_capital', 'capital_infusion', 'loan_received'];
  const EXPENSE_TYPES = ['loan_repayment', 'owner_withdrawal'];
  const ALL_TYPES     = [...INCOME_TYPES, ...EXPENSE_TYPES];

  const TYPE_LABELS = {
    opening_capital:  'Opening Capital',
    capital_infusion: 'Capital Infusion',
    loan_received:    'Loan Received',
    loan_repayment:   'Loan Repayment',
    owner_withdrawal: 'Owner Withdrawal',
  };

  try {
    const dbClient = await getClient();
    const db        = dbClient.db('tagsdb');
    const financing = db.collection('financing');
    const cashFlow  = db.collection('cashFlow');

    // ── GET: list all financing entries with summary ──────────────────────
    if (req.method === 'GET') {
      const { type, from, to } = req.query;
      const filter = {};
      if (type) filter.type = type;
      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to)   filter.date.$lte = new Date(to);
      }

      const entries = await financing.find(filter).sort({ date: -1 }).toArray();

      // Summary totals
      const totalCapital    = entries.filter(e => INCOME_TYPES.includes(e.type)).reduce((s, e) => s + e.amount, 0);
      const totalWithdrawn  = entries.filter(e => EXPENSE_TYPES.includes(e.type)).reduce((s, e) => s + e.amount, 0);
      const netCapital      = totalCapital - totalWithdrawn;

      // Cash vs bank split (sum of all entries)
      const totalCash = entries.reduce((s, e) => s + (e.cashAmount || 0), 0);
      const totalBank = entries.reduce((s, e) => s + (e.bankAmount || 0), 0);

      // Loan position
      const totalLoans     = entries.filter(e => e.type === 'loan_received').reduce((s, e) => s + e.amount, 0);
      const totalRepaid    = entries.filter(e => e.type === 'loan_repayment').reduce((s, e) => s + e.amount, 0);
      const outstandingLoan = Math.max(0, totalLoans - totalRepaid);

      return res.status(200).json({
        entries,
        summary: {
          totalCapital,
          totalWithdrawn,
          netCapital,
          totalCash,
          totalBank,
          totalLoans,
          totalRepaid,
          outstandingLoan,
        },
      });
    }

    // ── POST: create financing entry ──────────────────────────────────────
    if (req.method === 'POST') {
      const { type, amount, cashAmount, bankAmount, source, date, notes } = req.body;

      if (!type || !ALL_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${ALL_TYPES.join(', ')}` });
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }

      const totalAmt = Number(amount);
      const cashAmt  = Number(cashAmount) || 0;
      const bankAmt  = Number(bankAmount) || 0;

      // cash + bank must equal total (allow rounding tolerance)
      if (cashAmt + bankAmt > 0 && Math.abs(cashAmt + bankAmt - totalAmt) > 1) {
        return res.status(400).json({ error: 'cashAmount + bankAmount must equal amount' });
      }

      const entryDate = date ? new Date(date) : new Date();

      // 1. Insert into financing collection
      const finResult = await financing.insertOne({
        type,
        amount: totalAmt,
        cashAmount: cashAmt,
        bankAmount: bankAmt,
        source: source || '',
        notes: notes || '',
        date: entryDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const finId = finResult.insertedId.toString();
      const cashFlowType = INCOME_TYPES.includes(type) ? 'income' : 'expense';
      const label = TYPE_LABELS[type];

      // 2. Mirror into cashFlow so the ledger is always complete.
      //    If split across cash and bank, create two entries; otherwise one.
      if (cashAmt > 0 && bankAmt > 0) {
        await cashFlow.insertOne({
          type: cashFlowType, category: 'financing',
          amount: cashAmt, paymentMode: 'cash',
          description: `${label}${source ? ' — ' + source : ''} (Cash)`,
          referenceId: finId, referenceType: 'financing',
          date: entryDate, createdAt: new Date(),
        });
        await cashFlow.insertOne({
          type: cashFlowType, category: 'financing',
          amount: bankAmt, paymentMode: 'bank',
          description: `${label}${source ? ' — ' + source : ''} (Bank)`,
          referenceId: finId, referenceType: 'financing',
          date: entryDate, createdAt: new Date(),
        });
      } else {
        const paymentMode = bankAmt > 0 ? 'bank' : cashAmt > 0 ? 'cash' : 'other';
        await cashFlow.insertOne({
          type: cashFlowType, category: 'financing',
          amount: totalAmt, paymentMode,
          description: `${label}${source ? ' — ' + source : ''}`,
          referenceId: finId, referenceType: 'financing',
          date: entryDate, createdAt: new Date(),
        });
      }

      return res.status(201).json({ success: true, _id: finResult.insertedId });
    }

    // ── PUT: edit a financing entry ───────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, type, amount, cashAmount, bankAmount, source, date, notes } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const existing = await financing.findOne({ _id: new ObjectId(id) });
      if (!existing) return res.status(404).json({ error: 'Financing entry not found' });

      const newType    = type    || existing.type;
      const newAmount  = amount  ? Number(amount)     : existing.amount;
      const newCash    = cashAmount !== undefined ? Number(cashAmount) : existing.cashAmount;
      const newBank    = bankAmount !== undefined ? Number(bankAmount) : existing.bankAmount;
      const newSource  = source  !== undefined ? source : existing.source;
      const newNotes   = notes   !== undefined ? notes  : existing.notes;
      const newDate    = date    ? new Date(date) : existing.date;

      // Update financing record
      await financing.updateOne(
        { _id: new ObjectId(id) },
        { $set: { type: newType, amount: newAmount, cashAmount: newCash, bankAmount: newBank,
                  source: newSource, notes: newNotes, date: newDate, updatedAt: new Date() } }
      );

      // Rebuild cashFlow mirrors — delete old ones, insert fresh
      await cashFlow.deleteMany({ referenceId: id, referenceType: 'financing' });

      const cashFlowType = INCOME_TYPES.includes(newType) ? 'income' : 'expense';
      const label = TYPE_LABELS[newType];

      if (newCash > 0 && newBank > 0) {
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: newCash,
          paymentMode: 'cash', description: `${label}${newSource ? ' — ' + newSource : ''} (Cash)`,
          referenceId: id, referenceType: 'financing', date: newDate, createdAt: new Date() });
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: newBank,
          paymentMode: 'bank', description: `${label}${newSource ? ' — ' + newSource : ''} (Bank)`,
          referenceId: id, referenceType: 'financing', date: newDate, createdAt: new Date() });
      } else {
        const paymentMode = newBank > 0 ? 'bank' : newCash > 0 ? 'cash' : 'other';
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: newAmount,
          paymentMode, description: `${label}${newSource ? ' — ' + newSource : ''}`,
          referenceId: id, referenceType: 'financing', date: newDate, createdAt: new Date() });
      }

      return res.status(200).json({ success: true });
    }

    // ── DELETE: cascade-delete financing + its cashFlow mirrors ──────────
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const existing = await financing.findOne({ _id: new ObjectId(id) });
      if (!existing) return res.status(404).json({ error: 'Financing entry not found' });

      // Delete cashFlow mirrors first, then the source record
      await cashFlow.deleteMany({ referenceId: id, referenceType: 'financing' });
      await financing.deleteOne({ _id: new ObjectId(id) });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Financing API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
