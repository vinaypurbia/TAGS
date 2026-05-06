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
    const collection = db.collection('products');

    if (req.method === 'GET') {
      const products = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(products);
    }

    if (req.method === 'POST') {
      const product = { ...req.body, createdAt: new Date() };
      const result = await collection.insertOne(product);
      return res.status(201).json({ success: true, _id: result.insertedId });
    }

    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      delete updateData._id;
      updateData.updatedAt = new Date();
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Product not found' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('MongoDB error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
