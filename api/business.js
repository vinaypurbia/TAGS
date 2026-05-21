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

  const { module } = req.query;

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');

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
        const result = await col.insertOne({
          name, phone: phone || '', email: email || '',
          address: address || '', gstin: gstin || '',
          notes: notes || '', createdAt: new Date(), updatedAt: new Date()
        });
        return res.status(201).json({ success: true, _id: result.insertedId });
      }
      if (req.method === 'PUT') {
        const { id, ...data } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        delete data._id;
        data.updatedAt = new Date();
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
      // FIX: unified to 'cashFlow' — was 'cashflow' (lowercase), causing split collection
      const cashFlow = db.collection('cashFlow');

      if (req.method === 'GET') {
        const { from, to } = req.query;
        const filter = {};
        if (from || to) {
          filter.date = {};
          if (from) filter.date.$gte = new Date(from);
          if (to) filter.date.$lte = new Date(to);
        }
        const expenses = await col.find(filter).sort({ date: -1 }).toArray();
        return res.status(200).json(expenses);
      }
      if (req.method === 'POST') {
        const { category, amount, description, date, paymentMode, notes } = req.body;
        if (!amount || !category) return res.status(400).json({ error: 'Category and amount required' });
        const result = await col.insertOne({
          category, amount: Number(amount),
          description: description || '',
          date: date ? new Date(date) : new Date(),
          paymentMode: paymentMode || 'cash',
          notes: notes || '',
          createdAt: new Date()
        });
        // FIX: Auto-add to cashFlow (correct collection)
        await cashFlow.insertOne({
          type: 'expense', category,
          amount: Number(amount),
          description: description || category,
          date: date ? new Date(date) : new Date(),
          referenceId: result.insertedId.toString(),
          referenceType: 'expense',
          createdAt: new Date()
        });
        return res.status(201).json({ success: true, _id: result.insertedId });
      }
      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID required' });
        await col.deleteOne({ _id: new ObjectId(id) });
        // FIX: delete from cashFlow (correct collection)
        await cashFlow.deleteOne({ referenceId: id, referenceType: 'expense' });
        return res.status(200).json({ success: true });
      }
    }

    // ─── CASHFLOW ─────────────────────────────────────────────────
    if (module === 'cashflow') {
      // FIX: unified to 'cashFlow' — was 'cashflow' (lowercase)
      const col = db.collection('cashFlow');

      if (req.method === 'GET') {
        const { from, to, type, period } = req.query;

        let fromDate, toDate;
        const now = new Date();
        if (period === 'today') {
          fromDate = new Date(now.setHours(0,0,0,0));
          toDate = new Date();
        } else if (period === 'week') {
          fromDate = new Date(now.setDate(now.getDate() - 7));
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

        const filter = {};
        if (fromDate || toDate) {
          filter.date = {};
          if (fromDate) filter.date.$gte = fromDate;
          if (toDate) filter.date.$lte = toDate;
        }
        if (type) filter.type = type;

        const entries = await col.find(filter).sort({ date: -1 }).toArray();

        const income = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
        const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

        return res.status(200).json({ entries, summary: { income, expense, profit: income - expense } });
      }

      if (req.method === 'POST') {
        const { type, category, amount, description, date, paymentMode, notes } = req.body;
        if (!type || !amount) return res.status(400).json({ error: 'Type and amount required' });
        const result = await col.insertOne({
          type, category: category || 'other',
          amount: Number(amount),
          description: description || '',
          date: date ? new Date(date) : new Date(),
          paymentMode: paymentMode || 'cash',
          notes: notes || '',
          createdAt: new Date()
        });
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
        // FIX: unified to 'cashFlow'
        const cashFlow = db.collection('cashFlow');
        const movements = db.collection('stockMovements');

        if (type === 'stock-shortage') {
          const allInventory = await inventory.find({ trackInventory: true }).toArray();
          const shortage = allInventory
            .filter(i => i.availableStock <= i.lowStockAlert)
            .sort((a, b) => a.availableStock - b.availableStock);

          const enriched = await Promise.all(shortage.map(async (inv) => {
            const product = await products.findOne({ _id: new ObjectId(inv.productId) }).catch(() => null);
            return {
              productId: inv.productId,
              productName: product?.name || 'Unknown',
              category: product?.category || '-',
              image: product?.image || '',
              sku: inv.sku,
              currentStock: inv.currentStock,
              availableStock: inv.availableStock,
              lowStockAlert: inv.lowStockAlert,
              isOutOfStock: inv.availableStock === 0,
              reorderNeeded: inv.lowStockAlert - inv.availableStock,
              // FIX: include frontendStatus so admin visibility panel can read it
              frontendStatus: inv.frontendStatus || 'normal',
            };
          }));
          return res.status(200).json(enriched);
        }

        if (type === 'low-performing') {
          const salesData = await movements
            .find({ type: 'out', reason: { $in: ['sale', 'website_order'] } })
            .toArray();

          const salesMap = {};
          salesData.forEach(m => {
            if (!salesMap[m.productId]) salesMap[m.productId] = 0;
            salesMap[m.productId] += m.quantity;
          });

          const allProducts = await products.find({}).toArray();
          const withSales = allProducts.map(p => ({
            productId: p._id.toString(),
            productName: p.name,
            category: p.category,
            image: p.image,
            price: p.price,
            totalSold: salesMap[p._id.toString()] || 0,
          })).sort((a, b) => a.totalSold - b.totalSold);

          return res.status(200).json(withSales.slice(0, 20));
        }

        if (type === 'best-selling') {
          const salesData = await movements.find({ type: 'out' }).toArray();
          const salesMap = {};
          salesData.forEach(m => {
            if (!salesMap[m.productId]) salesMap[m.productId] = 0;
            salesMap[m.productId] += m.quantity;
          });

          const allProducts = await products.find({}).toArray();
          const withSales = allProducts.map(p => ({
            productId: p._id.toString(),
            productName: p.name,
            category: p.category,
            image: p.image,
            price: p.price,
            totalSold: salesMap[p._id.toString()] || 0,
          })).sort((a, b) => b.totalSold - a.totalSold);

          return res.status(200).json(withSales.slice(0, 20));
        }

        if (type === 'profit-margin') {
          const allInventory = await inventory.find({}).toArray();
          const invMap = {};
          allInventory.forEach(i => { invMap[i.productId] = i; });

          const allProducts = await products.find({}).toArray();
          const withMargin = allProducts.map(p => {
            const pid = p._id.toString();
            const inv = invMap[pid];
            const sellingPrice = parseFloat(p.discountedPrice || p.price || 0);
            const costPrice = inv?.costPrice || 0;
            const margin = sellingPrice - costPrice;
            const marginPct = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : null;
            return {
              productId: pid,
              productName: p.name,
              category: p.category,
              image: p.image,
              sellingPrice,
              costPrice,
              margin,
              marginPct: marginPct ? parseFloat(marginPct) : null,
            };
          }).sort((a, b) => (b.margin || 0) - (a.margin || 0));

          return res.status(200).json(withMargin);
        }

        if (type === 'pnl') {
          const { from, to } = req.query;
          const filter = {};
          if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
          }

          // FIX: reads from cashFlow (correct collection) — now includes sales income,
          // COGS expenses, purchase expenses, delivery collections, and manual entries
          const allCashFlow = await cashFlow.find(filter).toArray();
          const income = allCashFlow.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
          const expenses = allCashFlow.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

          const byCategory = {};
          allCashFlow.forEach(e => {
            const key = `${e.type}:${e.category || 'other'}`;
            if (!byCategory[key]) byCategory[key] = { type: e.type, category: e.category || 'other', total: 0, count: 0 };
            byCategory[key].total += e.amount;
            byCategory[key].count += 1;
          });

          return res.status(200).json({
            income, expenses,
            profit: income - expenses,
            profitMargin: income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0,
            breakdown: Object.values(byCategory),
          });
        }

        if (type === 'stock-valuation') {
          const allInventory = await inventory.find({}).toArray();
          let totalValue = 0;
          let totalRetailValue = 0;

          const enriched = await Promise.all(allInventory.map(async (inv) => {
            const product = await products.findOne({ _id: new ObjectId(inv.productId) }).catch(() => null);
            const costValue = (inv.currentStock || 0) * (inv.costPrice || 0);
            const retailValue = (inv.currentStock || 0) * parseFloat(product?.price || 0);
            totalValue += costValue;
            totalRetailValue += retailValue;
            return {
              productId: inv.productId,
              productName: product?.name || 'Unknown',
              category: product?.category || '-',
              currentStock: inv.currentStock,
              unit: inv.unit,
              costPrice: inv.costPrice,
              retailPrice: parseFloat(product?.price || 0),
              costValue,
              retailValue,
            };
          }));

          return res.status(200).json({
            items: enriched,
            totalCostValue: totalValue,
            totalRetailValue,
            potentialProfit: totalRetailValue - totalValue,
          });
        }

        return res.status(400).json({ error: 'Invalid report type' });
      }
    }

    return res.status(400).json({ error: 'Invalid module. Use ?module=suppliers|expenses|cashflow|reports' });
  } catch (error) {
    console.error('Business API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
