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

    if (req.method === 'GET') {
      const { summary, type, category, from, to, month, collectorBalances } = req.query;

      if (collectorBalances === 'true') {
        const collections = await cashFlow.find({ category: 'delivery_collection' }).toArray();
        const handovers = await cashFlow.find({ category: 'cash_handover' }).toArray();
        const balanceMap = {};
        collections.forEach((e) => {
          const key = `${e.collectedBy}::${e.collectorName || ''}`;
          if (!balanceMap[key]) {
            balanceMap[key] = { collectedBy: e.collectedBy, collectorName: e.collectorName || null,
              balance: 0, collected: 0, handedOver: 0, count: 0 };
          }
          balanceMap[key].balance += e.amount;
          balanceMap[key].collected += e.amount;
          balanceMap[key].count += 1;
        });
        handovers.forEach((e) => {
          const key = `${e.collectedBy}::${e.collectorName || ''}`;
          if (balanceMap[key]) { balanceMap[key].balance -= e.amount; balanceMap[key].handedOver += e.amount; }
        });
        // Also subtract owner_deposit entries so owner balance clears after depositing
        const deposits = await cashFlow.find({ category: 'owner_deposit' }).toArray();
        deposits.forEach((e) => {
          const key = `owner::`;
          if (balanceMap[key]) { balanceMap[key].balance -= e.amount; balanceMap[key].handedOver += e.amount; }
        });
        const result = Object.values(balanceMap).filter((c) => c.balance > 0);
        return res.status(200).json(result);
      }

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

      if (summary === 'true') {
        // P&L excluded — balance sheet movements, not operating P&L
        const PL_EXCLUDE = ['financing', 'inventory_asset', 'advance_payment', 'supplier_payment', 'ledger_payment', 'po_shortage_receivable', 'po_shortage_refund', 'supplier_return_refund'];
        const all = await cashFlow.find({ ...filter, category: { $nin: PL_EXCLUDE } }).toArray();

        const revenue = all.filter((e) => e.type === 'income' && (e.category === 'sales' || e.category === 'delivery_collection')).reduce((s, e) => s + e.amount, 0);
        const cogs = all.filter((e) => e.type === 'expense' && e.category === 'cogs').reduce((s, e) => s + e.amount, 0);
        const grossProfit = revenue - cogs;
        const operatingExpenses = all.filter((e) => e.type === 'expense' && e.category !== 'cogs').reduce((s, e) => s + e.amount, 0);
        const netProfit = grossProfit - operatingExpenses;
        const otherIncome = all.filter((e) => e.type === 'income' && e.category !== 'sales' && e.category !== 'delivery_collection').reduce((s, e) => s + e.amount, 0);
        const totalIncome = revenue + otherIncome;
        const totalExpense = cogs + operatingExpenses;

        const breakdown = {};
        all.forEach((e) => {
          const key = `${e.type}_${e.category}`;
          breakdown[key] = (breakdown[key] || 0) + e.amount;
        });

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const trend = await cashFlow.find({ date: { $gte: sixMonthsAgo }, category: { $nin: PL_EXCLUDE } }).sort({ date: 1 }).toArray();

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
          revenue, cogs, grossProfit, operatingExpenses, netProfit, otherIncome,
          totalIncome, totalExpense,
          grossMargin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
          netMargin:   revenue > 0 ? ((netProfit   / revenue) * 100).toFixed(1) : 0,
          breakdown, monthlyTrend: monthlyMap, count: all.length,
        });
      }

      // Exclude internal transfers (cash_handover) from the visible Cash Flow list.
      // These are internal movements between collectors and do not represent
      // income or expense — they should not appear in the Cash Flow ledger.
      const listFilter = { ...filter, category: { $ne: 'cash_handover' } };
      const entries = await cashFlow.find(listFilter).sort({ date: -1 }).toArray();
      return res.status(200).json(entries);
    }

    if (req.method === 'POST') {
      const { type, category = 'other', amount, description = '', date,
        referenceId = null, referenceType = null, paymentMode = null,
        collectedBy = null, collectorName = null, orderId = null, handoverTo = null } = req.body;

      if (!type || !['income', 'expense', 'transfer'].includes(type))
        return res.status(400).json({ error: 'type must be "income", "expense", or "transfer"' });
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
        return res.status(400).json({ error: 'amount must be a positive number' });

      const entry = {
        type, category, amount: Number(amount), description,
        referenceId, referenceType, paymentMode,
        collectedBy, collectorName, orderId, handoverTo,
        date: date ? new Date(date) : new Date(), createdAt: new Date(),
      };
      const result = await cashFlow.insertOne(entry);
      return res.status(201).json({ success: true, _id: result.insertedId });
    }

    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      delete updateData._id;
      if (updateData.date) updateData.date = new Date(updateData.date);
      if (updateData.amount) updateData.amount = Number(updateData.amount);
      updateData.updatedAt = new Date();
      const result = await cashFlow.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Entry not found' });
      return res.status(200).json({ success: true });
    }

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
      const totalCapital   = entries.filter(e => INCOME_TYPES.includes(e.type)).reduce((s, e) => s + e.amount, 0);
      const totalWithdrawn = entries.filter(e => EXPENSE_TYPES.includes(e.type)).reduce((s, e) => s + e.amount, 0);
      const netCapital     = totalCapital - totalWithdrawn;
      const totalCash      = entries.reduce((s, e) => s + (e.cashAmount || 0), 0);
      const totalBank      = entries.reduce((s, e) => s + (e.bankAmount || 0), 0);
      const totalLoans     = entries.filter(e => e.type === 'loan_received').reduce((s, e) => s + e.amount, 0);
      const totalRepaid    = entries.filter(e => e.type === 'loan_repayment').reduce((s, e) => s + e.amount, 0);
      const outstandingLoan = Math.max(0, totalLoans - totalRepaid);
      return res.status(200).json({ entries, summary: { totalCapital, totalWithdrawn, netCapital, totalCash, totalBank, totalLoans, totalRepaid, outstandingLoan } });
    }

    if (req.method === 'POST') {
      const { type, amount, cashAmount, bankAmount, source, date, notes } = req.body;
      if (!type || !ALL_TYPES.includes(type))
        return res.status(400).json({ error: `type must be one of: ${ALL_TYPES.join(', ')}` });
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
        return res.status(400).json({ error: 'amount must be a positive number' });

      const totalAmt = Number(amount);
      const cashAmt  = Number(cashAmount) || 0;
      const bankAmt  = Number(bankAmount) || 0;
      if (cashAmt + bankAmt > 0 && Math.abs(cashAmt + bankAmt - totalAmt) > 1)
        return res.status(400).json({ error: 'cashAmount + bankAmount must equal amount' });

      const entryDate = date ? new Date(date) : new Date();
      const finResult = await financing.insertOne({
        type, amount: totalAmt, cashAmount: cashAmt, bankAmount: bankAmt,
        source: source || '', notes: notes || '',
        date: entryDate, createdAt: new Date(), updatedAt: new Date(),
      });
      const finId = finResult.insertedId.toString();
      const cashFlowType = INCOME_TYPES.includes(type) ? 'income' : 'expense';
      const label = TYPE_LABELS[type];

      if (cashAmt > 0 && bankAmt > 0) {
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: cashAmt, paymentMode: 'cash',
          description: `${label}${source ? ' — ' + source : ''} (Cash)`, referenceId: finId, referenceType: 'financing', date: entryDate, createdAt: new Date() });
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: bankAmt, paymentMode: 'bank',
          description: `${label}${source ? ' — ' + source : ''} (Bank)`, referenceId: finId, referenceType: 'financing', date: entryDate, createdAt: new Date() });
      } else {
        const paymentMode = bankAmt > 0 ? 'bank' : cashAmt > 0 ? 'cash' : 'other';
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: totalAmt, paymentMode,
          description: `${label}${source ? ' — ' + source : ''}`, referenceId: finId, referenceType: 'financing', date: entryDate, createdAt: new Date() });
      }
      return res.status(201).json({ success: true, _id: finResult.insertedId });
    }

    if (req.method === 'PUT') {
      const { id, type, amount, cashAmount, bankAmount, source, date, notes } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const existing = await financing.findOne({ _id: new ObjectId(id) });
      if (!existing) return res.status(404).json({ error: 'Financing entry not found' });

      const newType   = type   || existing.type;
      const newAmount = amount ? Number(amount) : existing.amount;
      const newCash   = cashAmount !== undefined ? Number(cashAmount) : existing.cashAmount;
      const newBank   = bankAmount !== undefined ? Number(bankAmount) : existing.bankAmount;
      const newSource = source !== undefined ? source : existing.source;
      const newNotes  = notes  !== undefined ? notes  : existing.notes;
      const newDate   = date ? new Date(date) : existing.date;

      await financing.updateOne({ _id: new ObjectId(id) },
        { $set: { type: newType, amount: newAmount, cashAmount: newCash, bankAmount: newBank,
                  source: newSource, notes: newNotes, date: newDate, updatedAt: new Date() } });

      await cashFlow.deleteMany({ referenceId: id, referenceType: 'financing' });
      const cashFlowType = INCOME_TYPES.includes(newType) ? 'income' : 'expense';
      const label = TYPE_LABELS[newType];

      if (newCash > 0 && newBank > 0) {
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: newCash, paymentMode: 'cash',
          description: `${label}${newSource ? ' — ' + newSource : ''} (Cash)`, referenceId: id, referenceType: 'financing', date: newDate, createdAt: new Date() });
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: newBank, paymentMode: 'bank',
          description: `${label}${newSource ? ' — ' + newSource : ''} (Bank)`, referenceId: id, referenceType: 'financing', date: newDate, createdAt: new Date() });
      } else {
        const paymentMode = newBank > 0 ? 'bank' : newCash > 0 ? 'cash' : 'other';
        await cashFlow.insertOne({ type: cashFlowType, category: 'financing', amount: newAmount, paymentMode,
          description: `${label}${newSource ? ' — ' + newSource : ''}`, referenceId: id, referenceType: 'financing', date: newDate, createdAt: new Date() });
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const existing = await financing.findOne({ _id: new ObjectId(id) });
      if (!existing) return res.status(404).json({ error: 'Financing entry not found' });
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
