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
    const cashFlow = db.collection('cashFlow');

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

      // Summary mode — return totals
      if (summary === 'true') {
        const all = await cashFlow.find(filter).toArray();
        const totalIncome = all
          .filter((e) => e.type === 'income')
          .reduce((s, e) => s + e.amount, 0);
        const totalExpense = all
          .filter((e) => e.type === 'expense')
          .reduce((s, e) => s + e.amount, 0);

        // Category breakdown
        const breakdown = {};
        all.forEach((e) => {
          const key = `${e.type}_${e.category}`;
          breakdown[key] = (breakdown[key] || 0) + e.amount;
        });

        // Monthly trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const trend = await cashFlow
          .find({ date: { $gte: sixMonthsAgo } })
          .sort({ date: 1 })
          .toArray();

        const monthlyMap = {};
        trend.forEach((e) => {
          const d = new Date(e.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 };
          monthlyMap[key][e.type] += e.amount;
        });

        return res.status(200).json({
          totalIncome,
          totalExpense,
          netProfit: totalIncome - totalExpense,
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
