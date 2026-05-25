import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  from: 'bot' | 'user';
  text: string;
  options?: string[];
  products?: Product[];
  time: Date;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  discountedPrice?: number;
  image?: string;
  category?: string;
}

// ─── Store Knowledge Base ─────────────────────────────────────────────────────
const KB = {
  whatsapp: '916350021226',
  phone: '+91 63500 21226',
  email: 'support@ta-gs.online',
  address: '5, B Inside Hathipole, Street #2, Gulabeshwar Marg, Udaipur - 313001',
  hours: { weekdays: 'Mon–Sat: 10:00 AM – 7:00 PM', sunday: 'Sunday: 11:00 AM – 5:00 PM' },
  delivery: {
    local: 'Cash on Delivery within Udaipur. Orders above ₹500 get free delivery within 10–12 km of the city. Delivery charges apply for smaller orders.',
    outside: 'We deliver outside Udaipur with advance payment. Contact us on WhatsApp to confirm your location and charges.',
  },
  returns: 'We currently do not have a standard return policy. For any issues with your order, please contact us on WhatsApp and we will do our best to help you.',
  payment: 'Within Udaipur: Cash on Delivery. Outside Udaipur: Advance payment required. We accept UPI, bank transfer, and cash.',
  categories: ['Toys', 'Adventure Gears', 'Gadgets', 'Sports'],
};

// ─── Intent Engine ────────────────────────────────────────────────────────────
type Intent =
  | 'greeting' | 'hours' | 'location' | 'delivery' | 'returns'
  | 'payment' | 'contact' | 'products' | 'price_search' | 'category_search'
  | 'whatsapp' | 'help' | 'unknown';

function detectIntent(text: string): { intent: Intent; data?: any } {
  const t = text.toLowerCase().trim();

  // Greeting
  if (/^(hi|hello|hey|hii|namaste|good\s*(morning|evening|afternoon)|howdy)/.test(t))
    return { intent: 'greeting' };

  // Hours
  if (/\b(open|close|timing|hours?|time|when)\b/.test(t))
    return { intent: 'hours' };

  // Location
  if (/\b(where|location|address|shop|store|find|maps?|directions?)\b/.test(t))
    return { intent: 'location' };

  // Delivery
  if (/\b(deliver|delivery|ship|shipping|courier|cod|outside|udaipur|city|dispatch)\b/.test(t))
    return { intent: 'delivery' };

  // Returns
  if (/\b(return|refund|exchange|replace|broken|damage|defect)\b/.test(t))
    return { intent: 'returns' };

  // Payment
  if (/\b(pay|payment|upi|cash|online|gpay|phonepe|paytm|advance|cod)\b/.test(t))
    return { intent: 'payment' };

  // Contact / WhatsApp
  if (/\b(contact|call|whatsapp|message|email|reach|talk|speak|support)\b/.test(t))
    return { intent: 'contact' };

  // Price search — "under 500", "below 1000", "less than 200"
  const priceMatch = t.match(/(?:under|below|less\s*than|within|upto?|max(?:imum)?)\s*(?:rs\.?|₹|inr)?\s*(\d+)/i)
    || t.match(/(?:rs\.?|₹|inr)\s*(\d+)\s*(?:se\s*)?(?:under|below|less)/i);
  if (priceMatch) return { intent: 'price_search', data: { maxPrice: parseInt(priceMatch[1]) } };

  // Product / category search
  const catMatch = KB.categories.find(c => t.includes(c.toLowerCase()));
  if (catMatch) return { intent: 'category_search', data: { category: catMatch } };
  if (/\b(product|item|toy|gadget|sport|adventure|buy|show|find|search|looking|want|need)\b/.test(t))
    return { intent: 'products' };

  // WhatsApp direct
  if (/\b(whatsapp|wa\.me)\b/.test(t)) return { intent: 'whatsapp' };

  // Help
  if (/\b(help|assist|support|what can|options?|menu)\b/.test(t)) return { intent: 'help' };

  return { intent: 'unknown' };
}

// ─── Response Builder ─────────────────────────────────────────────────────────
async function buildResponse(text: string, originalText?: string): Promise<Partial<Message>> {
  const { intent, data } = detectIntent(text);
  const queryText = originalText || text;

  switch (intent) {
    case 'greeting':
      return {
        text: `👋 Hello! Welcome to **TAGS** — Toys, Adventure, Gadgets & Sports!\n\nI'm your virtual assistant. Here's what I can help you with:\n\n🕐 Store hours & timings\n📍 Store location & directions\n🚚 Delivery info & charges\n💳 Payment options\n🧸 Browse products by category\n💰 Find products by budget\n↩️ Return & exchange policy\n📞 Connect to our team\n\nPlease let us know if you have a query related to any of these topics — or anything else! 😊`,
        options: ['🕐 Store Hours', '📍 Location', '🚚 Delivery Info', '💳 Payment', '🛍️ Browse Products', '📞 Contact Us'],
      };

    case 'hours':
      return {
        text: `🕐 **Store Hours**\n\n${KB.hours.weekdays}\n${KB.hours.sunday}\n\nWe're usually quick to reply on WhatsApp even after hours!`,
        options: ['📍 Location', '🚚 Delivery Info', '💬 Chat on WhatsApp'],
      };

    case 'location':
      return {
        text: `📍 **Find Us**\n\n${KB.address}\n\nEasy to find — we're inside Hathipole area, Udaipur.`,
        options: ['🗺️ Open Google Maps', '🕐 Store Hours', '📞 Call Us'],
      };

    case 'delivery':
      return {
        text: `🚚 **Delivery Information**\n\n**Within Udaipur:**\n${KB.delivery.local}\n\n**Outside Udaipur:**\n${KB.delivery.outside}`,
        options: ['💳 Payment Modes', '📞 Contact for Outside Udaipur', '🛍️ Browse Products'],
      };

    case 'returns':
      return {
        text: `↩️ **Return Policy**\n\n${KB.returns}`,
        options: ['💬 Contact on WhatsApp', '📞 Call Us', '🛍️ Browse Products'],
      };

    case 'payment':
      return {
        text: `💳 **Payment Options**\n\n${KB.payment}`,
        options: ['🚚 Delivery Info', '🛍️ Browse Products', '💬 Chat on WhatsApp'],
      };

    case 'contact':
      return {
        text: `📞 **Contact TAGS**\n\n📱 Phone/WhatsApp: ${KB.phone}\n📧 Email: ${KB.email}\n\n💬 WhatsApp is the fastest way to reach us!`,
        options: ['💬 Open WhatsApp', '📍 Location', '🕐 Store Hours'],
      };

    case 'price_search': {
      const max = data?.maxPrice || 500;
      try {
        const res = await fetch(`/api/products?limit=6&page=1`);
        const d = await res.json();
        const products: Product[] = (d.products || [])
          .filter((p: any) => {
            const price = parseFloat(p.discountedPrice || p.originalPrice || p.price || 0);
            return price <= max && price > 0 && (p.stock?.frontendStatus || 'normal') !== 'hidden';
          })
          .slice(0, 4);
        if (products.length > 0) {
          return {
            text: `🛍️ Found ${products.length} product${products.length > 1 ? 's' : ''} under ₹${max}:`,
            products,
            options: ['🔍 Search Other Price', '🚚 Delivery Info', '💬 Chat on WhatsApp'],
          };
        }
      } catch {}
      return {
        text: `I couldn't find products under ₹${max} right now. Try browsing our catalog or chat with us on WhatsApp!`,
        options: ['🛍️ Browse Catalog', '💬 Chat on WhatsApp'],
      };
    }

    case 'category_search': {
      const cat = data?.category;
      try {
        const res = await fetch(`/api/products?category=${encodeURIComponent(cat)}&limit=4`);
        const d = await res.json();
        const products: Product[] = (d.products || [])
          .filter((p: any) => (p.stock?.frontendStatus || 'normal') !== 'hidden')
          .slice(0, 4);
        if (products.length > 0) {
          return {
            text: `🛍️ Here are some ${cat} items:`,
            products,
            options: [`See All ${cat}`, '🔍 Search by Price', '💬 Chat on WhatsApp'],
          };
        }
      } catch {}
      return {
        text: `Let me connect you to our ${cat} section!`,
        options: [`See All ${cat}`, '💬 Chat on WhatsApp'],
      };
    }

    case 'products':
      return {
        text: `🛍️ **What are you looking for?**\n\nBrowse by category or tell me your budget!`,
        options: ['🧸 Toys', '🏕️ Adventure Gears', '📱 Gadgets', '⚽ Sports', '💰 Under ₹500', '💰 Under ₹1000'],
      };

    case 'whatsapp':
      return {
        text: `💬 Opening WhatsApp chat with TAGS...`,
        options: ['🛍️ Browse Products', '📍 Location'],
      };

    case 'help':
      return {
        text: `🤖 **I can help you with:**\n\n• Store hours & location\n• Delivery & shipping info\n• Payment options\n• Browse products by category or price\n• Return policy\n• Connect to WhatsApp for anything else\n\nWhat would you like to know?`,
        options: ['🕐 Store Hours', '📍 Location', '🚚 Delivery', '🛍️ Products', '💳 Payment'],
      };

    default: {
      const encodedQuery = encodeURIComponent(`Hi TAGS! I have a query: "${queryText}"`);
      return {
        text: `🤔 I couldn't find an answer for that, but don't worry!\n\nTap the button below to send your exact query directly to our team on WhatsApp — we'll reply right away! 💬`,
        options: [`📲 Send My Query to WhatsApp::https://wa.me/${KB.whatsapp}?text=${encodedQuery}`, '🕐 Store Hours', '📍 Location', '🚚 Delivery Info'],
      };
    }
  }
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const price = parseFloat(String(product.discountedPrice || product.price || 0));
  const original = parseFloat(String(product.price || 0));
  const hasDiscount = product.discountedPrice && product.discountedPrice < original;

  return (
    <a href={`/products/${product._id}`}
      className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 p-2 hover:border-[#FA5600] transition-all group">
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
        {product.image
          ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          : <span className="text-xl">📦</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-800 leading-tight truncate group-hover:text-[#FA5600] transition-colors">{product.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs font-black text-[#E53935]">₹{price.toLocaleString('en-IN')}</span>
          {hasDiscount && <span className="text-[9px] text-gray-400 line-through">₹{original.toLocaleString('en-IN')}</span>}
        </div>
      </div>
    </a>
  );
}

// ─── Main ChatBot Component ───────────────────────────────────────────────────
export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [peekDismissed, setPeekDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 300);
      setUnread(0);
    }
  }, [open]);

  // Show greeting on first open
  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true;
      addBotMessage('greeting');
    }
  }, [open]);

  // Show unread bubble after 3s if not opened
  useEffect(() => {
    const t = setTimeout(() => {
      if (!open && !initialized.current) setUnread(1);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  const addBotMessage = async (text: string, originalText?: string) => {
    setTyping(true);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    const response = await buildResponse(text, originalText);
    setTyping(false);
    const msg: Message = {
      id: Date.now().toString(),
      from: 'bot',
      text: response.text || '',
      options: response.options,
      products: response.products,
      time: new Date(),
    };
    setMessages(prev => [...prev, msg]);
    if (!open) setUnread(prev => prev + 1);
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');

    // Handle buttons with embedded URL (format: "Label::https://...")
    if (msg.includes('::https://')) {
      const [, url] = msg.split('::');
      window.open(url, '_blank');
      return;
    }

    // Handle special option actions
    if (msg === '🗺️ Open Google Maps') {
      window.open(`https://www.google.com/maps?q=24.58626748321101,73.68766945881869`, '_blank');
      return;
    }
    if (msg === '📞 Call Us') {
      window.open(`tel:+916350021226`);
      return;
    }
    if (msg.includes('WhatsApp') || msg.includes('whatsapp')) {
      window.open(`https://wa.me/${KB.whatsapp}?text=Hi TAGS! I need help.`, '_blank');
      // Still add user message and bot ack
    }
    if (msg.startsWith('See All ')) {
      const cat = msg.replace('See All ', '');
      window.location.href = `/products?category=${encodeURIComponent(cat)}`;
      return;
    }
    if (msg === '🛍️ Browse Catalog') {
      window.location.href = '/products';
      return;
    }

    // Map quick option labels to natural language for intent detection
    const intentMap: Record<string, string> = {
      '🕐 Store Hours': 'store hours timing',
      '📍 Location': 'location address',
      '🚚 Delivery Info': 'delivery information',
      '💳 Payment': 'payment modes',
      '🛍️ Browse Products': 'show products',
      '📞 Contact Us': 'contact',
      '💬 Chat on WhatsApp': 'whatsapp',
      '💬 Open WhatsApp': 'whatsapp',
      '💬 Contact on WhatsApp': 'whatsapp',
      '📞 Contact for Outside Udaipur': 'contact outside udaipur delivery',
      '🧸 Toys': 'Toys',
      '🏕️ Adventure Gears': 'Adventure Gears',
      '📱 Gadgets': 'Gadgets',
      '⚽ Sports': 'Sports',
      '💰 Under ₹500': 'products under 500',
      '💰 Under ₹1000': 'products under 1000',
      '🔍 Search Other Price': 'show products by price',
      '🔍 Search by Price': 'products by price',
    };

    const processText = intentMap[msg] || msg;

    // Add user message
    const userMsg: Message = { id: Date.now().toString(), from: 'user', text: msg, time: new Date() };
    setMessages(prev => [...prev, userMsg]);

    // Pass original msg so unknown intent can relay it verbatim to WhatsApp
    await addBotMessage(processText, msg);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <>
      {/* ── Chat Window ── */}
      <div className={`fixed bottom-24 right-4 z-[9998] w-[340px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out
        ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>

        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '520px', maxHeight: 'calc(100vh - 120px)' }}>

          {/* Header */}
          <div className="bg-[#FA5600] px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow">
                <span className="text-[#FA5600] font-black text-sm">T</span>
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight">TAGS Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white/80 text-[10px] font-bold">Online — reply in seconds</span>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white transition p-1 rounded-lg hover:bg-white/20">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col gap-1 ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line
                  ${msg.from === 'user'
                    ? 'bg-[#FA5600] text-white rounded-br-sm'
                    : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-sm'}`}>
                  {msg.text}
                </div>

                {/* Product cards */}
                {msg.products && msg.products.length > 0 && (
                  <div className="w-full space-y-1.5 mt-1">
                    {msg.products.map(p => <ProductCard key={p._id} product={p} />)}
                  </div>
                )}

                {/* Quick option buttons */}
                {msg.options && msg.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 max-w-[90%]">
                    {msg.options.map(opt => {
                      const label = opt.includes('::') ? opt.split('::')[0] : opt;
                      const isRelay = opt.startsWith('📲 Send My Query');
                      return (
                        <button key={opt} onClick={() => handleSend(opt)}
                          className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full transition-all whitespace-nowrap
                            ${isRelay
                              ? 'bg-[#25D366] border border-[#25D366] text-white hover:bg-[#1ebe5d]'
                              : 'bg-white border border-[#FA5600] text-[#FA5600] hover:bg-[#FA5600] hover:text-white'}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <span className="text-[9px] text-gray-400 px-1">{formatTime(msg.time)}</span>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex items-start">
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs font-bold outline-none focus:border-[#FA5600] transition-colors"
              />
              <button onClick={() => handleSend()}
                disabled={!input.trim()}
                className="w-8 h-8 bg-[#FA5600] rounded-full flex items-center justify-center text-white hover:bg-[#E04A00] transition disabled:opacity-40 shrink-0">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-center text-[9px] text-gray-300 font-bold uppercase tracking-widest mt-2">
              Powered by TAGS · Free support
            </p>
          </div>
        </div>
      </div>

      {/* ── Idle Peek Card ── */}
      {!open && !peekDismissed && unread > 0 && (
        <div className="fixed bottom-24 right-4 z-[9998] w-[280px] animate-[slideUp_0.4s_ease-out]"
          style={{ animation: 'slideUp 0.4s ease-out' }}>
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(16px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Peek header */}
            <div className="bg-[#FA5600] px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow">
                  <span className="text-[#FA5600] font-black text-xs">T</span>
                </div>
                <div>
                  <p className="text-white font-black text-xs leading-tight">TAGS Assistant</p>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-white/80 text-[9px] font-bold">Online — reply in seconds</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setPeekDismissed(true)}
                className="text-white/70 hover:text-white transition p-0.5 rounded hover:bg-white/20">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Peek body */}
            <div className="px-3 py-3">
              <p className="text-xs font-bold text-gray-800 mb-2">👋 Hi! I can help you with:</p>
              <ul className="space-y-1 text-[11px] text-gray-600 mb-3">
                <li>🕐 Store hours &amp; timings</li>
                <li>🚚 Delivery info &amp; charges</li>
                <li>🧸 Browse products by category</li>
                <li>💳 Payment options</li>
                <li>📍 Location &amp; directions</li>
              </ul>
              <button
                onClick={() => { setPeekDismissed(true); setOpen(true); }}
                className="w-full bg-[#FA5600] text-white text-[11px] font-black uppercase tracking-widest py-2 rounded-full hover:bg-[#E04A00] transition-colors">
                Start Chat →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bubble Button ── */}
      <button
        onClick={() => { setOpen(v => !v); setPeekDismissed(true); }}
        className="fixed bottom-6 right-4 z-[9999] w-14 h-14 bg-[#FA5600] rounded-full shadow-lg hover:bg-[#E04A00] transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
        aria-label="Open chat">
        <div className="relative">
          {open
            ? <X className="w-6 h-6 text-white" />
            : <MessageCircle className="w-6 h-6 text-white" />}
          {!open && unread > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce">
              {unread}
            </span>
          )}
        </div>
      </button>
    </>
  );
}

export default ChatBot;
