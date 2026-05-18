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
    // ── IMAGE PROXY (GET ?proxy=<url>) ────────────────────────────────────────
    // Used by pdfGenerator.ts to bypass CORS on Meta CDN product images
    if (req.method === 'GET' && req.query.proxy) {
      const imageUrl = decodeURIComponent(req.query.proxy);
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return res.status(400).json({ error: 'Invalid URL' });
      }
      const imgRes = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
      });
      if (!imgRes.ok) return res.status(imgRes.status).end();
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const buffer = await imgRes.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(Buffer.from(buffer));
    }

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
