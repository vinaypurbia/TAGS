import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: {
    bodyParser: false, // we handle raw binary ourselves
    sizeLimit: '10mb', // reject oversized uploads early
  },
};

// ── Shared upload options — applied to EVERY upload path ──────────────────
// What each option does:
//   format: 'webp'         → converts PNG/JPEG/etc to WebP (30–80% smaller on disk)
//   quality: 'auto:low'    → Cloudinary AI picks lowest quality human eye won't notice
//   width/height: 1000     → hard cap; no product image needs more than 1000px
//   crop: 'limit'          → only shrinks, never upscales small images
//   strip_metadata: true   → removes EXIF/GPS/camera data (saves ~10–30 KB per image)
//   overwrite: false        → if same public_id exists, skip re-upload (deduplication)
//   unique_filename: true  → prevents collisions between different products
//   invalidate: true       → busts CDN cache when an image is replaced
const UPLOAD_OPTIONS = {
  folder: 'tags-products',
  format: 'webp',
  transformation: [
    {
      width: 1000,
      height: 1000,
      crop: 'limit',
      quality: 'auto:low',
      strip_metadata: true,
      fetch_format: 'auto', // serves AVIF to browsers that support it, WebP otherwise
    },
  ],
  // Eager transformations: pre-generate a thumbnail at upload time so the
  // first user to view a product doesn't trigger on-the-fly resizing.
  eager: [
    { width: 300, height: 300, crop: 'fill', gravity: 'auto', quality: 'auto:low', format: 'webp' },
  ],
  eager_async: true,       // don't block the upload response waiting for thumbnails
  overwrite: false,
  unique_filename: true,
  invalidate: true,
  resource_type: 'image',
};

// ── Helper: is this a Cloudinary URL already? ─────────────────────────────
function isCloudinaryUrl(url) {
  return url && (url.includes('res.cloudinary.com') || url.includes('cloudinary.com'));
}

// ── Helper: hash a buffer so identical images reuse the same public_id ────
// If two products have the same photo, we upload it only once.
function bufferHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16);
}

// ── Helper: fetch an external image and upload to Cloudinary ──────────────
// Handles Facebook CDN, Google, WhatsApp, and any other external image URLs.
// Returns the permanent Cloudinary URL.
async function fetchAndUploadToCloudinary(externalUrl) {
  if (isCloudinaryUrl(externalUrl)) return externalUrl;

  const result = await cloudinary.uploader.upload(externalUrl, {
    ...UPLOAD_OPTIONS,
    // For URL uploads, use the URL's hash as public_id so the same image
    // from the same source is never uploaded twice.
    public_id: `tags-products/ext_${bufferHash(Buffer.from(externalUrl))}`,
    overwrite: false,
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
    // ── Mode 1: Upload from external URL (?from_url=true) ─────────────────
    if (req.query.from_url === 'true') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const { url } = body;

      if (!url) return res.status(400).json({ error: 'url is required' });

      if (isCloudinaryUrl(url)) {
        return res.status(200).json({ success: true, url, alreadyCloudinary: true });
      }

      const result = await cloudinary.uploader.upload(url, {
        ...UPLOAD_OPTIONS,
        public_id: `tags-products/ext_${bufferHash(Buffer.from(url))}`,
        overwrite: false,
      });

      return res.status(200).json({
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        // Return thumbnail URL so frontend can use it without extra API calls
        thumbnailUrl: result.eager?.[0]?.secure_url ?? result.secure_url,
        bytes: result.bytes, // useful for logging / debugging storage
      });
    }

    // ── Mode 2: Upload from raw binary (camera / file picker) ─────────────
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Reject images larger than 15 MB before even hitting Cloudinary
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large. Maximum size is 15 MB.' });
    }

    const contentType = req.headers['content-type'] || 'image/jpeg';
    const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;

    // Use MD5 hash of file content as public_id → identical images are never
    // stored twice even if uploaded by different users or at different times.
    const hash = bufferHash(buffer);

    const result = await cloudinary.uploader.upload(dataUri, {
      ...UPLOAD_OPTIONS,
      public_id: `tags-products/img_${hash}`,
      overwrite: false,
    });

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      thumbnailUrl: result.eager?.[0]?.secure_url ?? result.secure_url,
      bytes: result.bytes,
    });

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return res.status(500).json({ error: 'Upload failed', details: error.message });
  }
}
