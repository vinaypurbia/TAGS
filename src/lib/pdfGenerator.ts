import jsPDF from 'jspdf';
import { CartItem } from '../context/CartContext';

export interface UserDetails {
  name: string;
  phone: string;
  address: string;
  email?: string;
}

// ── Safe rupee formatter — avoids ₹ glyph which jsPDF cannot render ──────────
const rs = (n: number) =>
  'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Parse price from any format ───────────────────────────────────────────────
const resolvePrice = (product: any): number => {
  for (const v of [product.discountedPrice, product.price, product.originalPrice]) {
    if (v === null || v === undefined) continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
    if (n > 0) return n;
  }
  return 0;
};

// ── Load image via canvas — tries direct URL then your API image proxy ────────
const loadImage = (url: string): Promise<string> =>
  new Promise((resolve) => {
    if (!url) return resolve('');
    const tryCanvas = (src: string) =>
      new Promise<string>((res) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || 80;
            c.height = img.naturalHeight || 80;
            const ctx = c.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0); res(c.toDataURL('image/jpeg', 0.85)); }
            else res('');
          } catch { res(''); }
        };
        img.onerror = () => res('');
        img.src = src;
      });

    tryCanvas(url).then(async (b64) => {
      if (b64) return resolve(b64);
      // Fallback: your own proxy route to bypass Meta CDN CORS
      const proxyUrl = `/api/imgproxy?url=${encodeURIComponent(url)}`;
      resolve(await tryCanvas(proxyUrl));
    });
  });

// ── Draw helpers ──────────────────────────────────────────────────────────────
const hRule = (
  doc: jsPDF,
  y: number,
  x1 = 14,
  x2 = 196,
  color: [number, number, number] = [220, 220, 220]
) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
};

// Strip emojis — jsPDF Helvetica cannot render them
const stripEmoji = (str: string): string =>
  str.replace(/[^\x00-\x7F\xA0-\xFF]/g, '').replace(/\s{2,}/g, ' ').trim();

// ── MAIN GENERATOR ────────────────────────────────────────────────────────────
export const generateOrderPDF = async (
  items: CartItem[],
  userDetails: UserDetails
): Promise<{ orderId: string; pdfBlob: Blob }> => {

  // Resolve prices & normalise
  const safeItems = items.map(item => ({
    ...item,
    product: { ...item.product, price: resolvePrice(item.product) },
    quantity: Number(item.quantity) || 1,
  }));

  // Pre-fetch all product images in parallel
  const imgCache: Record<string, string> = {};
  await Promise.all(safeItems.map(async (item) => {
    const src =
      (item.product as any).imageUrls?.[0] ||
      (item.product as any).imageUrl ||
      item.product.image || '';
    if (src) {
      const b64 = await loadImage(src);
      if (b64) imgCache[item.product.id] = b64;
    }
  }));

  // Fetch store perks/policy from banner API
  let policyLines: string[] = [
    'Cash on Delivery available — pay on WhatsApp confirmation',
    'Check and Collect — inspect your order before accepting',
    'No Return / No Refund once order is accepted',
  ];
  try {
    const banner = await fetch('/api/banner').then(r => r.json());
    if (Array.isArray(banner?.perks) && banner.perks.length > 0) {
      policyLines = banner.perks.map((p: any) => `${p.icon || ''} ${p.text || ''}`.trim());
    }
  } catch { /* use defaults */ }

  const doc    = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW  = 210;
  const pageH  = 297;
  const orderId = `TAGS-${Date.now().toString(36).toUpperCase().slice(-7)}`;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  // ── Orange left accent bar ────────────────────────────────────────────────
  doc.setFillColor(250, 86, 0);
  doc.rect(0, 0, 4, pageH, 'F');

  // ── HEADER ───────────────────────────────────────────────────────────────
  doc.setFillColor(250, 86, 0);
  doc.rect(4, 0, pageW - 4, 44, 'F');

  // Logo circle with T
  doc.setFillColor(255, 255, 255);
  doc.circle(22, 22, 11, 'F');
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(250, 86, 0);
  doc.text('T', 22, 26.5, { align: 'center' });

  // Brand name + tagline
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TAGS', 38, 20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 215, 180);
  doc.text('Toys · Adventure · Gadgets · Sports', 38, 27);
  doc.text('www.ta-gs.online', 38, 33);

  // TAX INVOICE label (right)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE', pageW - 12, 14, { align: 'right' });

  // Store details (right)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 215, 180);
  [
    'Hathipole, Udaipur - 313001, Rajasthan, India',
    'Ph: +91 63500 21226  |  tags.udr@gmail.com',
    'GSTIN: XXXXXXXXXXXXXXX',
  ].forEach((line, i) => doc.text(line, pageW - 12, 22 + i * 7, { align: 'right' }));

  // ── ORDER META BAR ────────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.rect(4, 44, pageW - 4, 14, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.text('ORDER ID',  14,  50);
  doc.text('DATE',      85,  50);
  doc.text('STATUS',   150,  50);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(orderId, 14, 55.5);
  doc.text(dateStr, 85, 55.5);
  doc.setTextColor(250, 86, 0);
  doc.text('PENDING CONFIRMATION', 150, 55.5);

  // ── SOLD BY / SHIP TO ────────────────────────────────────────────────────
  let y = 65;

  // Left — Sold By
  doc.setFillColor(255, 248, 240);
  doc.roundedRect(14, y, 86, 32, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(250, 86, 0);
  doc.text('SOLD BY', 18, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text('TAGS', 18, y + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text('Hathipole, Udaipur - 313001', 18, y + 18);
  doc.text('Rajasthan, India', 18, y + 23);
  doc.text('Ph: +91 63500 21226', 18, y + 28);

  // Right — Ship To
  doc.setFillColor(255, 248, 240);
  doc.roundedRect(110, y, 86, 32, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(250, 86, 0);
  doc.text('SHIP TO', 114, y + 6);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(userDetails.name || '—', 114, y + 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`Ph: ${userDetails.phone || '—'}`, 114, y + 18);
  if (userDetails.address) {
    const addrLines = doc.splitTextToSize(userDetails.address, 78);
    addrLines.slice(0, 3).forEach((line: string, i: number) =>
      doc.text(line, 114, y + 23 + i * 5)
    );
  }

  y += 38;
  hRule(doc, y, 14, 196, [250, 86, 0]);
  y += 5;

  // ── ITEMS TABLE ───────────────────────────────────────────────────────────
  // Columns: IMG(16) | PRODUCT(68) | CATEGORY(28) | UNIT PRICE(30) | QTY(12) | AMOUNT(28)
  // X starts: 14
  const C = {
    img:  14,   // width 16 → ends 30
    name: 31,   // width 68 → ends 99
    cat:  100,  // width 28 → ends 128
    unit: 129,  // width 30 → ends 159 (right-align to 159)
    qty:  160,  // width 12 → ends 172 (centre at 166)
    tot:  173,  // width 23 → ends 196 (right-align to 196)
  };
  const ROW_H = 20;

  // Header
  doc.setFillColor(30, 30, 30);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('IMG',      C.img + 8,  y + 5.5, { align: 'center' });
  doc.text('PRODUCT',  C.name,     y + 5.5);
  doc.text('CATEGORY', C.cat,      y + 5.5);
  doc.text('UNIT',     C.unit + 28, y + 5.5, { align: 'right' });
  doc.text('QTY',      C.qty + 6,  y + 5.5, { align: 'center' });
  doc.text('AMOUNT',   C.tot + 23, y + 5.5, { align: 'right' });
  y += 8;

  const subtotal = safeItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  safeItems.forEach((item, idx) => {
    const rowY = y;
    const even = idx % 2 === 0;

    // Row background + border
    doc.setFillColor(...(even ? [255, 255, 255] as [number,number,number] : [255, 248, 240] as [number,number,number]));
    doc.rect(14, rowY, 182, ROW_H, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(14, rowY, 182, ROW_H);

    // Thumbnail
    const imgData = imgCache[item.product.id];
    if (imgData) {
      try { doc.addImage(imgData, 'JPEG', C.img + 0.5, rowY + 2, 14, 14); }
      catch { /* skip */ }
    } else {
      doc.setFillColor(235, 235, 235);
      doc.rect(C.img + 0.5, rowY + 2, 14, 14, 'F');
      doc.setFontSize(5);
      doc.setTextColor(160, 160, 160);
      doc.text('IMG', C.img + 7.5, rowY + 10.5, { align: 'center' });
    }

    // Product name (max 2 lines)
    const nameLines = doc.splitTextToSize(item.product.name, 66);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    nameLines.slice(0, 2).forEach((line: string, li: number) =>
      doc.text(line, C.name, rowY + 7 + li * 5)
    );

    // Category
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(item.product.category || '—', C.cat, rowY + 11);

    // Unit price — right-aligned to end of column
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(rs(item.product.price), C.unit + 28, rowY + 11, { align: 'right' });

    // Qty — centred
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.quantity), C.qty + 6, rowY + 11, { align: 'center' });

    // Line total — right-aligned
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 20);
    doc.text(rs(item.product.price * item.quantity), C.tot + 23, rowY + 11, { align: 'right' });

    y += ROW_H;
  });

  y += 4;
  hRule(doc, y, 14, 196, [200, 200, 200]);
  y += 5;

  // ── TOTALS ────────────────────────────────────────────────────────────────
  const TX = 148; // label left
  const VX = 195; // value right edge

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text('Subtotal:', TX, y);
  doc.setTextColor(20, 20, 20);
  doc.text(rs(subtotal), VX, y, { align: 'right' });
  y += 6;

  hRule(doc, y, TX - 2, VX + 2, [250, 86, 0]);
  y += 2;

  // Grand total bar
  doc.setFillColor(250, 86, 0);
  doc.roundedRect(TX - 2, y, VX - TX + 4, 11, 1.5, 1.5, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', TX + 1, y + 7.5);
  doc.setFontSize(10);
  doc.text(rs(subtotal), VX - 1, y + 7.5, { align: 'right' });
  y += 16;

  // ── POLICY / TERMS BOX ───────────────────────────────────────────────────
  const policyBoxH = 8 + policyLines.length * 6 + 2;
  doc.setFillColor(255, 252, 245);
  doc.setDrawColor(250, 200, 150);
  doc.roundedRect(14, y, 182, policyBoxH, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(250, 86, 0);
  doc.text('ORDER TERMS & CONDITIONS', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  policyLines.forEach((line, i) =>
    doc.text(`• ${stripEmoji(line)}`, 18, y + 12 + i * 6)
  );
  y += policyBoxH + 6;

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = Math.max(y + 4, pageH - 18);
  doc.setFillColor(26, 26, 26);
  doc.rect(4, footerY, pageW - 4, pageH - footerY, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Thank you for shopping with TAGS!', 14, footerY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  doc.text(
    'TAGS · Hathipole, Udaipur - 313001 · +91 63500 21226 · tags.udr@gmail.com · www.ta-gs.online',
    14, footerY + 13
  );
  doc.setTextColor(250, 86, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('ta-gs.online', pageW - 12, footerY + 7, { align: 'right' });

  const pdfBlob = doc.output('blob');
  return { orderId, pdfBlob };
};

export const getWhatsAppLink = (
  phoneNumber: string,
  orderId: string,
  name: string,
  items?: { name: string; quantity: number; price: number }[],
  total?: number
) => {
  const itemLines = items && items.length > 0
    ? items.map(i => `  - ${i.name} x${i.quantity} = Rs. ${(i.price * i.quantity).toFixed(2)}`).join('\n')
    : '';

  const message = [
    `Hello TAGS! I would like to place an order.`,
    ``,
    `*Order ID:* ${orderId}`,
    `*Name:* ${name}`,
    `*Status:* PENDING CONFIRMATION`,
    total ? `*Total:* Rs. ${total.toFixed(2)}` : '',
    itemLines ? `\n*Items Ordered:*\n${itemLines}` : '',
    ``,
    `I have attached the order PDF. Please confirm payment details and delivery date.`,
  ].filter(Boolean).join('\n');

  return `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
};
