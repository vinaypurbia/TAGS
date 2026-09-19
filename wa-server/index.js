// wa-server/index.js
// Tiny Express server that wraps whatsapp-web.js
// Run this on a phone or PC that stays connected with WhatsApp Web session
// 
// Setup:
//   cd wa-server
//   npm install express whatsapp-web.js qrcode-terminal
//   node index.js
// Scan the QR code with WhatsApp on your phone once — session is saved after that.

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let waReady = false;

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'tags-delivery' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  waReady = true;
  console.log('✅ WhatsApp client ready!');
});

client.on('disconnected', (reason) => {
  waReady = false;
  console.log('❌ WhatsApp disconnected:', reason);
});

client.initialize();

// ── POST /send  { phone: "919876543210", message: "Hello!" } ──────────────────
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
  if (!waReady) return res.status(503).json({ error: 'WhatsApp not ready' });

  try {
    // Format: 91XXXXXXXXXX@c.us (India example)
    const chatId = phone.replace(/[^0-9]/g, '') + '@c.us';
    await client.sendMessage(chatId, message);
    console.log(`✉️  Sent to ${phone}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /status ───────────────────────────────────────────────────────────────
app.get('/status', (_, res) => res.json({ ready: waReady }));

// ── GET /groups ────────────────────────────────────────────────────────────────
// One-time helper to find a group/community's chat ID. WhatsApp group IDs
// aren't visible anywhere in the app UI — this is the only way to get them.
// Run this once, find "TAGS" (or whatever your group is named) in the list,
// copy its `id`, and set it as the WA_GROUP_ID environment variable.
app.get('/groups', async (_, res) => {
  if (!waReady) return res.status(503).json({ error: 'WhatsApp not ready' });
  try {
    const chats = await client.getChats();
    const groups = chats
      .filter(c => c.isGroup)
      .map(c => ({ id: c.id._serialized, name: c.name }));
    res.json({ groups });
  } catch (err) {
    console.error('Groups fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /broadcast  { imageUrl?: string, message: string } ───────────────────
// Posts to the WhatsApp Group/Community set in WA_GROUP_ID — same shape as
// the Telegram broadcast (imageUrl + message), so the frontend/API layer can
// call this the same way it calls Telegram's sendPhoto. If the image fails to
// download or send, falls back to a text-only message rather than failing
// the whole broadcast, matching the Telegram broadcast's fallback behavior.
app.post('/broadcast', async (req, res) => {
  const { imageUrl, message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  if (!waReady) return res.status(503).json({ error: 'WhatsApp not ready' });

  const groupId = process.env.WA_GROUP_ID;
  if (!groupId) return res.status(500).json({ error: 'WA_GROUP_ID environment variable not set — call GET /groups to find your group\'s id first' });

  try {
    if (imageUrl) {
      try {
        const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
        await client.sendMessage(groupId, media, { caption: message });
        console.log(`✉️  Broadcast (image) sent to group ${groupId}`);
        return res.json({ success: true, imageSent: true });
      } catch (imgErr) {
        console.warn('Broadcast image failed, falling back to text-only:', imgErr.message);
      }
    }
    await client.sendMessage(groupId, message);
    console.log(`✉️  Broadcast (text) sent to group ${groupId}`);
    res.json({ success: true, imageSent: false, note: imageUrl ? 'Text only — image failed to send' : undefined });
  } catch (err) {
    console.error('Broadcast error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 WA server running on port ${PORT}`));
