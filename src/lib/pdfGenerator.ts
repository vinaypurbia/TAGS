import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CartItem } from '../context/CartContext';

export interface UserDetails {
  name: string;
  phone: string;
  address: string;
}

export const generateOrderPDF = (items: CartItem[], userDetails: UserDetails): string => {
  const doc = new jsPDF();
  const orderId = `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const date = new Date().toLocaleDateString();

  // Title
  doc.setFontSize(22);
  doc.setTextColor(37, 211, 102); // WhatsApp green
  doc.text('Play & Gear - Order Summary', 14, 22);

  // Business / Order Info
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.text(`Order ID: ${orderId}`, 14, 32);
  doc.text(`Date: ${date}`, 14, 38);
  
  // Customer Info
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Customer Details:', 14, 48);
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(`Name: ${userDetails.name}`, 14, 54);
  doc.text(`Phone: ${userDetails.phone}`, 14, 60);
  if (userDetails.address) {
    doc.text(`Delivery Address: ${userDetails.address}`, 14, 66);
  }

  // Table Data
  const tableData = items.map(item => [
    item.product.id,
    item.product.name,
    item.quantity.toString()
  ]);

  autoTable(doc, {
    startY: userDetails.address ? 74 : 68,
    head: [['Product ID', 'Product Name', 'Quantity']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [37, 211, 102] }
  });

  // Footer Instructions
  const finalY = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(10);
  doc.setTextColor(150, 50, 50);
  doc.text('* Payment to be made after confirmation via WhatsApp.', 14, finalY + 10);
  
  // Save file
  const fileName = `Order_${orderId}.pdf`;
  doc.save(fileName);
  
  return orderId;
};

export const getWhatsAppLink = (phoneNumber: string, orderId: string, name: string) => {
  const message = `Hello Play & Gear! 👋\n\nI would like to place an order.\nMy Order ID is: *${orderId}*\nName: ${name}\n\nI have generated the order PDF and will attach it to this chat now.\nPlease let me know the payment details and delivery confirmation.`;
  return `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
};
