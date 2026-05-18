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
    const collection = db.collection('reviews');

    // ── GET: fetch reviews for a product (or all for admin) ──────────────────
    if (req.method === 'GET') {
      const { productId, all } = req.query;

      if (all === 'true') {
        // Admin: return all reviews across all products
        const reviews = await collection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).json(reviews);
      }

      if (!productId) return res.status(400).json({ error: 'productId required' });

      const reviews = await collection
        .find({ productId })
        .sort({ createdAt: -1 })
        .toArray();
      return res.status(200).json(reviews);
    }

    // ── POST: customer submits a new review ──────────────────────────────────
    if (req.method === 'POST') {
      const { productId, productName, name, rating, comment } = req.body;
      if (!productId || !name?.trim() || !comment?.trim() || !rating) {
        return res.status(400).json({ error: 'productId, name, rating and comment are required' });
      }
      const ratingNum = parseInt(rating, 10);
      if (ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      const review = {
        productId,
        productName: productName || '',
        name: name.trim(),
        rating: ratingNum,
        comment: comment.trim(),
        createdAt: new Date(),
      };

      const result = await collection.insertOne(review);
      return res.status(201).json({ ...review, _id: result.insertedId });
    }

    // ── PUT: admin edits a review ────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, name, rating, comment } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });

      const update = {};
      if (name    !== undefined) update.name    = name.trim();
      if (rating  !== undefined) update.rating  = parseInt(rating, 10);
      if (comment !== undefined) update.comment = comment.trim();
      update.updatedAt = new Date();

      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );
      return res.status(200).json({ success: true });
    }

    // ── DELETE: admin deletes a review ───────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });

      await collection.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
