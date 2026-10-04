// ── TAGS store policy settings — ONE place to edit ───────────────────────────────
// Used by the checkout (OrderSummary), the Shipping & Delivery page and the Returns & Refunds page,
// so what customers are told always matches how checkout behaves. If you change a value here, also
// change it in Google Merchant Center (shipping + return settings), and COD_RULES in api/customers.js.

// Cash on Delivery: only inside Udaipur, and only for orders of COD_MIN_ORDER or more
export const COD_CITY = 'udaipur';          // the city typed by the customer must contain this
export const COD_PIN_PREFIX = '313';        // …and the pincode must start with this (Udaipur postal codes)
export const COD_MIN_ORDER = 1000;          // ₹

// Everything else (other cities / all-India) is advance payment + courier charge
export const LOCAL_DELIVERY_CHARGE = 0;     // ₹ charged for deliveries inside Udaipur (0 = free)

// Courier charge by destination state (₹ per order). States not listed use COURIER_DEFAULT_CHARGE.
// Leave both empty/null to show "courier charge confirmed on WhatsApp" instead of an amount.
export const COURIER_RATES: Record<string, number> = {};   // e.g. { 'rajasthan': 80, 'gujarat': 100, 'delhi': 120 }
export const COURIER_DEFAULT_CHARGE: number | null = null; // e.g. 150

// Estimated delivery time in days [fastest, slowest] — PLEASE CONFIRM THESE ARE REALISTIC
export const DELIVERY_DAYS_LOCAL: [number, number] = [1, 2];
export const DELIVERY_DAYS_COURIER: [number, number] = [5, 8];

// Returns — PLEASE CONFIRM the number of days
export const RETURN_WINDOW_DAYS = 7;

export const UPI_ID = '';                   // e.g. 'yourshop@upi' — shown to customers who pay in advance
export const SHOP_WHATSAPP = '916350021226';
export const SHOP_PHONE = '+91 63500 21226';
export const SHOP_EMAIL = 'tags.udr@gmail.com';
export const SHOP_ADDRESS = '5, B Inside Hathipole, Street #2, Gulabeshwar Marg, Udaipur - 313001, Rajasthan, India';
