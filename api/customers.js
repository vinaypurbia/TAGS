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

    // GET - list all customers or single customer with purchase history
    if (req.method === 'GET') {
      const { id, phone } = req.query;

      // Single customer by ID with full purchase history
      if (id) {
        const customer = await customers.findOne({ _id: new ObjectId(id) });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // Fetch all sales for this customer
        const customerSales = await sales
          .find({ customerId: id })
          .sort({ date: -1 })
          .toArray();

        const totalSpend = customerSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
        const totalOrders = customerSales.length;

        return res.status(200).json({ ...customer, sales: customerSales, totalSpend, totalOrders });
      }

      // Find by phone number
      if (phone) {
        const customer = await customers.findOne({ phone });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        const customerSales = await sales.find({ customerId: customer._id.toString() }).sort({ date: -1 }).toArray();
        const totalSpend = customerSales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
        return res.status(200).json({ ...customer, sales: customerSales, totalSpend, totalOrders: customerSales.length });
      }

      // All customers with summary stats
      const allCustomers = await customers.find({}).sort({ createdAt: -1 }).toArray();

      // Enrich each customer with sales stats
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

      // Sort by total spend descending
      enriched.sort((a, b) => b.totalSpend - a.totalSpend);

      const totalCustomers = enriched.length;
      const totalRevenue = enriched.reduce((s, c) => s + c.totalSpend, 0);
      const repeatCustomers = enriched.filter(c => c.totalOrders > 1).length;

      return res.status(200).json({
        customers: enriched,
        summary: { totalCustomers, totalRevenue, repeatCustomers }
      });
    }

    // POST - create new customer (or upsert by phone)
    if (req.method === 'POST') {
      const { name, phone, email, address, notes } = req.body;
      if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

      // Check if customer with this phone already exists
      const existing = await customers.findOne({ phone });
      if (existing) {
        // Update existing customer
        await customers.updateOne(
          { phone },
          { $set: { name, email: email || existing.email, address: address || existing.address, notes: notes || existing.notes, updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true, _id: existing._id, updated: true });
      }

      const result = await customers.insertOne({
        name, phone,
        email: email || '',
        address: address || '',
        notes: notes || '',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return res.status(201).json({ success: true, _id: result.insertedId, created: true });
    }

    // PUT - update customer details
    if (req.method === 'PUT') {
      const { id, ...data } = req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });
      delete data._id;
      data.updatedAt = new Date();
      await customers.updateOne({ _id: new ObjectId(id) }, { $set: data });
      return res.status(200).json({ success: true });
    }

    // DELETE - remove customer
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
