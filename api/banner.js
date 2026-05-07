import { MongoClient } from 'mongodb';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const collection = db.collection('settings');

    if (req.method === 'GET') {
      const settings = await collection.findOne({ key: 'siteSettings' });
      return res.status(200).json(settings || {});
    }

    if (req.method === 'POST') {
      const {
        promoLines,
        promoText,
        bannerSlides,   // array of { image, text, description }
        bannerImage,    // legacy fallback
        bannerText,     // legacy fallback
      } = req.body;

      // Only keep slides that have at least an image
      const cleanedSlides = Array.isArray(bannerSlides)
        ? bannerSlides.map(s => ({
            image: s.image || '',
            text: s.text || '',
            description: s.description || '',
          }))
        : [];

      await collection.updateOne(
        { key: 'siteSettings' },
        {
          $set: {
            key: 'siteSettings',
            promoLines: promoLines || [],
            promoText: promoText || '',
            bannerSlides: cleanedSlides,   // ✅ properly saved now
            bannerImage: bannerImage || '',
            bannerText: bannerText || '',
            updatedAt: new Date(),
          }
        },
        { upsert: true }
      );
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
