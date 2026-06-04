// wa-server/index.js
// Tiny Express server that wraps whatsapp-web.js
// Run this on a phone or PC that stays connected with WhatsApp Web session
// 
// Setup:
//   cd wa-server
//   npm install express whatsapp-web.js qrcode-terminal
//   node index.js
// Scan the QR code with WhatsApp on your phone once — session is saved after that.

const { Client, LocalAuth } = require('whatsapp-web.js');
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 WA server running on port ${PORT}`));
