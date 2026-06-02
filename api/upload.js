import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: {
    bodyParser: false, // we handle raw binary ourselves
  },
};

// ── Helper: is this a Cloudinary URL already? ──────────────────────────────
function isCloudinaryUrl(url) {
  return url && (url.includes('res.cloudinary.com') || url.includes('cloudinary.com'));
}

// ── Helper: fetch an external image and upload to Cloudinary ────────────────
// Handles Facebook CDN, Google, WhatsApp, and any other external image URLs.
// Returns the permanent Cloudinary URL.
async function fetchAndUploadToCloudinary(externalUrl) {
  // If already on Cloudinary, return as-is
  if (isCloudinaryUrl(externalUrl)) return externalUrl;

  // Use Cloudinary's built-in fetch-from-URL upload — no manual download needed
  const result = await cloudinary.uploader.upload(externalUrl, {
    folder: 'tags-products',
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    // 'fetch' type tells Cloudinary to download from the URL directly
    // This bypasses 403s from Facebook CDN since Cloudinary fetches server-side
  });
  return result.secure_url;
}

export { fetchAndUploadToCloudinary };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ── Mode 1: Upload from external URL (?from_url=true) ──────────────────
    // Used when saving a product with an external image URL (Facebook, Google, etc.)
    // Cloudinary downloads it server-side, bypassing CDN restrictions.
    if (req.query.from_url === 'true') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const { url } = body;

      if (!url) return res.status(400).json({ error: 'url is required' });
      if (isCloudinaryUrl(url)) {
        // Already on Cloudinary — return as-is, no re-upload needed
        return res.status(200).json({ success: true, url, alreadyCloudinary: true });
      }

      const result = await cloudinary.uploader.upload(url, {
        folder: 'tags-products',
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
      });

      return res.status(200).json({
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
      });
    }

    // ── Mode 2: Upload from raw binary (default — camera/file picker) ───────
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString('base64');
    const contentType = req.headers['content-type'] || 'image/jpeg';
    const dataUri = `data:${contentType};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'tags-products',
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    });

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });

  } catch (error) {
    console.error('Cloudinary error:', error);
    return res.status(500).json({ error: 'Upload failed', details: error.message });
  }
}
