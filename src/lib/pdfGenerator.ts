import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CartItem } from '../context/CartContext';

export interface UserDetails {
  name: string;
  phone: string;
  address: string;
}

export const generateOrderPDF = (items: CartItem[], userDetails: UserDetails): { orderId: string; pdfBlob: Blob } => {
  const doc = new jsPDF();
  const orderId = `TAGSORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const date = new Date().toLocaleDateString('en-IN');

  // Header background
  doc.setFillColor(250, 86, 0); // TAGS orange
  doc.rect(0, 0, 210, 35, 'F');

  // Brand Name
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TAGS', 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(255, 220, 200);
  doc.text('Toys · Adventure · Gadgets · Sports', 14, 26);
  doc.text(`Order ID: ${orderId}   |   Date: ${date}`, 14, 32);

  // Customer Info
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Details:', 14, 48);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(`Name: ${userDetails.name}`, 14, 55);
  doc.text(`Phone: ${userDetails.phone}`, 14, 61);
  if (userDetails.address) {
    doc.text(`Delivery Address: ${userDetails.address}`, 14, 67);
  }

  // Table
  const tableData = items.map(item => [
    item.product.name,
    item.product.category || '-',
    item.quantity.toString(),
    `₹${(item.product.price * item.quantity).toFixed(2)}`
  ]);

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  autoTable(doc, {
    startY: userDetails.address ? 75 : 68,
    head: [['Product Name', 'Category', 'Qty', 'Amount (INR)']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [250, 86, 0], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 243, 224] },
  });

  const afterTable = (doc as any).lastAutoTable.finalY || 100;

  // Total
  doc.setFillColor(250, 86, 0);
  doc.rect(14, afterTable + 5, 182, 12, 'F');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL AMOUNT: ₹${total.toFixed(2)}`, 16, afterTable + 14);

  // Footer note
  doc.setFontSize(9);
  doc.setTextColor(150, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('* Payment to be made after confirmation via WhatsApp. All prices in INR.', 14, afterTable + 24);
  doc.text('TAGS · Hathipole, Udaipur · +91 63500 21226 · tags.udr@gmail.com', 14, afterTable + 30);

  const pdfBlob = doc.output('blob');
  return { orderId, pdfBlob };
};

export const getWhatsAppLink = (phoneNumber: string, orderId: string, name: string) => {
  const message = `Hello TAGS! 👋\n\nI would like to place an order.\nMy Order ID is: *${orderId}*\nName: ${name}\n\nI have generated the order PDF and will attach it to this chat now.\nPlease let me know the payment details and delivery confirmation.`;
  return `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
};
