import { MongoClient } from 'mongodb';

const uri = process.env.TAGS_MONGO;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('tagsdb');
    const collection = db.collection('products');

    if (req.method === 'GET') {
      const products = await collection.find({}).toArray();
      return res.status(200).json(products);
    }

    if (req.method === 'POST') {
      const product = {
        ...req.body,
        createdAt: new Date(),
      };
      const result = await collection.insertOne(product);
      return res.status(201).json({ success: true, id: result.insertedId });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('MongoDB error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  } finally {
    await client.close();
  }
}
