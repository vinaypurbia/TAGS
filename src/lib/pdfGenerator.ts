import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CartItem } from '../context/CartContext';

export interface UserDetails {
  name: string;
  phone: string;
  address: string;
}

// Helper: load an image URL as base64 for jsPDF
const loadImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
};

export const generateOrderPDF = async (
  items: CartItem[],
  userDetails: UserDetails
): Promise<{ orderId: string; pdfBlob: Blob }> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const orderId = `TAGSORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const date = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // ─── HEADER BAND ────────────────────────────────────────────────────────────
  // Orange top stripe
  doc.setFillColor(250, 86, 0);
  doc.rect(0, 0, pageW, 42, 'F');

  // White accent line at bottom of header
  doc.setFillColor(255, 255, 255);
  doc.setFillColor(255, 200, 150);
  doc.rect(0, 39, pageW, 1.2, 'F');

  // ── Logo placeholder / brand name area (left side) ──
  // Try to load the store logo; if unavailable, render text logo
  // Place your logo at: /public/logo.png  (or update the path below)
  const LOGO_URL = '/logo.png'; // ← update this path to match your actual logo
  const logoBase64 = await loadImageAsBase64(LOGO_URL);

  if (logoBase64) {
    // Draw actual logo image (max 28mm tall, auto-width)
    doc.addImage(logoBase64, 'PNG', 12, 6, 28, 28);
  } else {
    // Fallback: stylised text logo
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TAGS', 14, 22);

    doc.setFontSize(8);
    doc.setTextColor(255, 210, 170);
    doc.setFont('helvetica', 'normal');
    doc.text('Toys · Adventure · Gadgets · Sports', 14, 29);
  }

  // ── Store address block (right side of header) ──
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TAGS – Toys, Adventure, Gadgets & Sports', pageW - 14, 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 220, 190);
  const storeLines = [
    'Hathipole, Udaipur – 313001, Rajasthan, India',
    'Phone: +91 63500 21226',
    'Email: tags.udr@gmail.com',
    'GSTIN: XXXXXXXXXXXXXXX',  // ← fill in real GST number
  ];
  storeLines.forEach((line, i) => {
    doc.text(line, pageW - 14, 17 + i * 5, { align: 'right' });
  });

  // ─── INVOICE META BAR (light grey) ──────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 42, pageW, 14, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(0, 42, pageW, 14, 'S');

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.text('ORDER ID', 14, 48);
  doc.text('DATE', 80, 48);
  doc.text('STATUS', 145, 48);

  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(orderId, 14, 53.5);
  doc.text(date, 80, 53.5);

  doc.setTextColor(250, 86, 0);
  doc.text('PENDING CONFIRMATION', 145, 53.5);

  // ─── CUSTOMER DETAILS BOX ────────────────────────────────────────────────────
  const custY = 62;
  doc.setFillColor(255, 248, 240);
  doc.setDrawColor(250, 200, 160);
  doc.roundedRect(14, custY, 88, 28, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(180, 80, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER DETAILS', 18, custY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(`${userDetails.name}`, 18, custY + 12);
  doc.text(`📞 ${userDetails.phone}`, 18, custY + 18);
  if (userDetails.address) {
    const addrLines = doc.splitTextToSize(`📍 ${userDetails.address}`, 78);
    doc.text(addrLines, 18, custY + 24);
  }

  // ─── PAYMENT NOTE BOX (right side, beside customer) ──────────────────────────
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(180, 230, 195);
  doc.roundedRect(108, custY, 88, 28, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(20, 130, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT INFO', 112, custY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text('Pay after WhatsApp confirmation', 112, custY + 13);
  doc.text('All prices include GST (where applicable)', 112, custY + 19);
  doc.text('No online payment required at this step', 112, custY + 25);

  // ─── NORMALISE PRICES (guard against undefined/string prices) ────────────────
  const safeItems = items.map((item) => ({
    ...item,
    product: {
      ...item.product,
      price: Number(item.product.price) || 0,
    },
    quantity: Number(item.quantity) || 1,
  }));

  // ─── ITEMS TABLE WITH THUMBNAILS ─────────────────────────────────────────────
  // Pre-load all product images
  const imageCache: Record<string, string> = {};
  await Promise.all(
    safeItems.map(async (item) => {
      if (item.product.image) {
        const b64 = await loadImageAsBase64(item.product.image);
        if (b64) imageCache[item.product.id] = b64;
      }
    })
  );

  const tableStartY = custY + 34;

  // Column headers
  autoTable(doc, {
    startY: tableStartY,
    head: [['', 'Product', 'Category', 'Unit Price', 'Qty', 'Amount']],
    body: safeItems.map((item) => [
      '', // image cell — filled via didDrawCell
      item.product.name,
      item.product.category || '—',
      `₹${item.product.price.toFixed(2)}`,
      item.quantity.toString(),
      `₹${(item.product.price * item.quantity).toFixed(2)}`,
    ]),
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      valign: 'middle',
      lineColor: [230, 230, 230],
      lineWidth: 0.3,
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [250, 86, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [255, 248, 240] },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' }, // thumbnail
      1: { cellWidth: 62, fontStyle: 'bold' },
      2: { cellWidth: 30, textColor: [120, 120, 120] },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    rowPageBreak: 'avoid',
    // Increase row height for thumbnails
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.minCellHeight = 18;
      }
    },
    // Draw product thumbnails in first column
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const item = safeItems[data.row.index];
        const imgData = imageCache[item.product.id];
        if (imgData) {
          const cellX = data.cell.x + 1;
          const cellY = data.cell.y + 1;
          const size = Math.min(data.cell.width - 2, data.cell.height - 2);
          try {
            doc.addImage(imgData, 'JPEG', cellX, cellY, size, size);
          } catch (_) {
            // skip if image fails
          }
        }
      }
    },
  });

  const afterTable = (doc as any).lastAutoTable.finalY || 140;

  // ─── TOTALS SECTION ──────────────────────────────────────────────────────────
  const subtotal = safeItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  // Subtotal row
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', 140, afterTable + 8, { align: 'right' });
  doc.text(`₹${subtotal.toFixed(2)}`, pageW - 14, afterTable + 8, { align: 'right' });

  doc.text('Shipping', 140, afterTable + 14, { align: 'right' });
  doc.setTextColor(20, 140, 60);
  doc.text('FREE', pageW - 14, afterTable + 14, { align: 'right' });

  // Total band
  doc.setFillColor(250, 86, 0);
  doc.rect(100, afterTable + 18, pageW - 100, 14, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL AMOUNT', 104, afterTable + 27);
  doc.text(`₹${subtotal.toFixed(2)}`, pageW - 14, afterTable + 27, { align: 'right' });

  // ─── FOOTER ──────────────────────────────────────────────────────────────────
  const footerY = afterTable + 40;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(14, footerY, pageW - 14, footerY);

  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Thank you for shopping with TAGS! This is a draft order. Final confirmation will be shared via WhatsApp.',
    pageW / 2,
    footerY + 6,
    { align: 'center' }
  );
  doc.text(
    'TAGS · Hathipole, Udaipur – 313001 · +91 63500 21226 · tags.udr@gmail.com',
    pageW / 2,
    footerY + 11,
    { align: 'center' }
  );

  // Page border accent (thin orange left bar)
  doc.setFillColor(250, 86, 0);
  doc.rect(0, 0, 3, 297, 'F');

  const pdfBlob = doc.output('blob');
  return { orderId, pdfBlob };
};

export const getWhatsAppLink = (phoneNumber: string, orderId: string, name: string) => {
  const message = `Hello TAGS! 👋\n\nI would like to place an order.\nMy Order ID is: *${orderId}*\nName: ${name}\n\nI have generated the order PDF and will attach it to this chat now.\nPlease let me know the payment details and delivery confirmation.`;
  return `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
};
