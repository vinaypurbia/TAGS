import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { generateOrderPDF, getWhatsAppLink } from '../lib/pdfGenerator';
import { Trash2, Plus, Minus, Download, MessageCircle, AlertCircle, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export function OrderSummary() {
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [orderState, setOrderState] = useState<{ step: 'cart' | 'pdf_generated'; orderId?: string }>({ step: 'cart' });

  const subtotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGeneratePDF = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    
    // Generate PDF and get order ID
    const orderId = generateOrderPDF(items, formData);
    
    // Change UI state to show WhatsApp link and instructions
    setOrderState({ step: 'pdf_generated', orderId });
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Your Order List is Empty</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">Browse our catalog to add some amazing toys or adventure gear to your list.</p>
        <Link to="/products" className="inline-flex items-center justify-center bg-[#25D366] text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-green-600 transition-colors">
          Browse Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8 border-b-4 border-black pb-4">
         <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none uppercase">Order Summary</h1>
         <span className="text-slate-400 font-bold uppercase text-xs tracking-widest hidden sm:inline">Checkout</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Order Items */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white border-2 border-black p-6 card-hover">
            <div className="mb-6 flex justify-between items-center border-b-2 border-black pb-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Selected Items ({items.length})</h2>
              <button onClick={clearCart} className="text-[10px] uppercase font-bold text-slate-500 hover:text-black border border-slate-300 px-3 py-1 hover:border-black transition-colors">Clear All</button>
            </div>
            
            <ul className="divide-y-2 divide-slate-100">
              {items.map((item) => (
                <li key={item.product.id} className="py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-6 items-center sm:items-start group">
                  <div className="w-24 h-24 shrink-0 bg-slate-50 border-2 border-black overflow-hidden relative">
                    <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover mix-blend-multiply" />
                  </div>
                  
                  <div className="flex-1 text-center sm:text-left flex flex-col justify-between h-full">
                    <div>
                      <h3 className="font-black uppercase text-lg group-hover:text-[var(--color-wa-green)] transition-colors leading-tight mb-1">{item.product.name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.product.category}</p>
                    </div>
                    <div className="font-black text-xl mt-4 sm:mt-2">${item.product.price.toFixed(2)}</div>
                  </div>
                  
                  <div className="flex flex-col sm:items-end gap-4 h-full">
                    <div className="flex items-center gap-0 border-2 border-black bg-slate-50">
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-2 text-black hover:bg-black hover:text-white transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-black text-black">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-2 text-black hover:bg-black hover:text-white transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => removeItem(item.product.id)}
                      className="text-[10px] uppercase font-bold text-slate-400 hover:text-black flex items-center gap-1 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            
            <div className="mt-6 p-4 bg-black text-white flex justify-between items-center shadow-[4px_4px_0px_0px_var(--color-wa-green)] border-2 border-black">
               <span className="text-xs uppercase font-bold tracking-widest opacity-80">Estimated Total</span>
               <span className="text-3xl font-black">${subtotal.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="bg-[#F6FFED] border-2 border-[var(--color-wa-green)] p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4">
             <div className="bg-[var(--color-wa-green)] text-white p-2 shrink-0 rounded-full">
               <AlertCircle className="w-6 h-6" />
             </div>
             <div className="text-center sm:text-left">
               <h4 className="font-black uppercase text-sm tracking-widest text-[#075E54] mb-2">No Online Payment</h4>
               <p className="text-xs font-bold text-[#075E54]/70 uppercase tracking-wide leading-relaxed">This is an order request. You will coordinate payment directly via WhatsApp after sending this form.</p>
             </div>
          </div>
        </div>

        {/* Right Column: User Details & Actions */}
        <div className="lg:col-span-4">
          <div className="border-l-0 lg:border-l-4 lg:border-black pl-0 lg:pl-8 sticky top-32 flex flex-col justify-between h-[max-content] min-h-[500px]">
            
            {orderState.step === 'cart' ? (
              <form onSubmit={handleGeneratePDF} className="flex flex-col h-full">
                <div className="flex-1 mb-8">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b-2 border-black pb-2">Your Details</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-[10px] font-black tracking-widest uppercase mb-2">Full Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        id="name" 
                        name="name" 
                        required 
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full p-4 bg-slate-50 border-2 border-black font-bold outline-none focus:border-[var(--color-wa-green)] transition-colors placeholder:text-slate-300 placeholder:font-normal"
                        placeholder="NAME SURNAME"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="phone" className="block text-[10px] font-black tracking-widest uppercase mb-2">Phone Number <span className="text-red-500">*</span></label>
                      <input 
                        type="tel" 
                        id="phone" 
                        name="phone" 
                        required 
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full p-4 bg-slate-50 border-2 border-black font-bold outline-none focus:border-[var(--color-wa-green)] transition-colors placeholder:text-slate-300 placeholder:font-normal"
                        placeholder="+1 555-000-0000"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="address" className="block text-[10px] font-black tracking-widest uppercase mb-2">Delivery Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <textarea 
                        id="address" 
                        name="address" 
                        rows={3}
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full p-4 bg-slate-50 border-2 border-black font-bold outline-none focus:border-[var(--color-wa-green)] transition-colors resize-none placeholder:text-slate-300 placeholder:font-normal line-clamp-3"
                        placeholder="STREET, CITY, ZIP"
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t-2 border-slate-100">
                  <button 
                    type="submit"
                    className="w-full bg-black text-white font-black py-4 uppercase tracking-tighter flex items-center justify-center gap-2 text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    <Download className="w-4 h-4"/> 1. Generate Order PDF
                  </button>
                  <p className="text-[9px] text-center uppercase font-bold opacity-40">Downloads file to upload on next step</p>
                </div>
              </form>
            ) : (
              <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300">
                <div className="flex-1">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b-2 border-black pb-2 text-[var(--color-wa-green)]">Step 1 Complete</h3>
                  <div className="bg-slate-50 border-2 border-black p-6 mb-8 relative overflow-hidden group">
                     <span className="step-number text-[var(--color-wa-green)]">✓</span>
                     <div className="relative z-10">
                       <h4 className="font-black text-lg uppercase mb-2">PDF Generated</h4>
                       <p className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-4 line-clamp-2">Order_{orderState.orderId}.pdf downloaded.</p>
                       <div className="h-0.5 bg-black w-full mb-4"></div>
                       <h5 className="font-black text-[10px] uppercase tracking-widest mb-2">Next Steps:</h5>
                       <ol className="text-[10px] uppercase font-bold text-slate-600 space-y-2">
                         <li>1. Click WhatsApp button</li>
                         <li>2. Attach the PDF file</li>
                         <li>3. Send for confirmation</li>
                       </ol>
                     </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t-2 border-slate-100">
                  <a 
                    href={getWhatsAppLink('15551234567', orderState.orderId || '', formData.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[var(--color-wa-green)] hover:bg-[#20bd5a] text-white font-black py-4 uppercase tracking-tighter flex items-center justify-center gap-2 text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-y-1 hover:shadow-none border-2 border-black"
                  >
                    <MessageCircle className="w-5 h-5"/> 2. Send on WhatsApp
                  </a>
                  
                  <button 
                    onClick={() => setOrderState({ step: 'cart' })}
                    className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-black transition-colors"
                  >
                    ← Edit Details
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
export default OrderSummary;
