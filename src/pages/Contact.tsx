import { useState } from 'react';
import { Phone, Mail, MapPin, MessageCircle, Send, CheckCircle, User } from 'lucide-react';

export function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const msg = `Hello TAGS! 👋\n\nNew enquiry from website:\n\nName: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone}\n\nMessage:\n${formData.message}`;
    const waUrl = `https://wa.me/916350021226?text=${encodeURIComponent(msg)}`;
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      window.open(waUrl, '_blank');
    }, 800);
  };

  const lat = 24.58626748321101;
  const lng = 73.68766945881869;
  const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      <div className="mb-10 border-b-4 border-black pb-4">
        <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none uppercase">Contact Us</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">TAGS · Udaipur · Usually reply within 1 hour</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div className="lg:col-span-4 flex flex-col gap-4">

          <div className="flex items-start gap-4 bg-white border-2 border-black p-5">
            <div className="bg-black text-white p-2 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Contact Person</p>
              <p className="font-black text-sm">Vinay Purbia</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">TAGS, Udaipur</p>
            </div>
          </div>

          <a href="tel:+916350021226" className="flex items-start gap-4 bg-white border-2 border-black p-5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all group">
            <div className="bg-[#FA5600] text-white p-2 shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Call / WhatsApp</p>
              <p className="font-black text-sm group-hover:text-[#FA5600] transition-colors">+91 63500 21226</p>
            </div>
          </a>

          <a href="mailto:tags.udr@gmail.com" className="flex items-start gap-4 bg-white border-2 border-black p-5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all group">
            <div className="bg-[#FA5600] text-white p-2 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email</p>
              <p className="font-black text-sm group-hover:text-[#FA5600] transition-colors">tags.udr@gmail.com</p>
            </div>
          </a>

          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 bg-white border-2 border-black p-5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all group">
            <div className="bg-[#FA5600] text-white p-2 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Shop Address</p>
              <p className="font-black text-sm leading-relaxed group-hover:text-[#FA5600] transition-colors">
                5, B Inside Hathipole,<br />
                Street #2, Gulabeshwar Marg,<br />
                Udaipur, Rajasthan - 313001
              </p>
              <p className="text-[9px] text-[#FA5600] font-black uppercase tracking-widest mt-2">Open in Google Maps →</p>
            </div>
          </a>

          <a
            href="https://wa.me/916350021226"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-black uppercase text-sm tracking-widest py-4 px-6 border-2 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <MessageCircle className="w-5 h-5" /> Chat on WhatsApp
          </a>

          <div className="bg-slate-50 border-2 border-black p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Business Hours</p>
            <ul className="space-y-1 text-xs font-bold text-slate-600">
              <li className="flex justify-between"><span>Mon – Sat</span><span>10:00 AM – 7:00 PM</span></li>
              <li className="flex justify-between"><span>Sunday</span><span>11:00 AM – 5:00 PM</span></li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">

          <div className="bg-white border-2 border-black p-6 md:p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-[#25D366] flex items-center justify-center mb-4 border-2 border-black">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Message Sent!</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">WhatsApp has been opened with your message. Vinay will reply shortly!</p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', phone: '', message: '' }); }}
                  className="text-[10px] font-black uppercase tracking-widest border-2 border-black px-6 py-3 hover:bg-black hover:text-white transition-colors"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-black uppercase tracking-widest mb-6 border-b-2 border-black pb-3">Send Us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black tracking-widest uppercase mb-2">Full Name <span className="text-[#FA5600]">*</span></label>
                      <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="Your name"
                        className="w-full p-3 bg-slate-50 border-2 border-black font-bold text-sm outline-none focus:border-[#FA5600] transition-colors placeholder:text-slate-300 placeholder:font-normal" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black tracking-widest uppercase mb-2">Phone Number <span className="text-[#FA5600]">*</span></label>
                      <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} placeholder="+91 00000 00000"
                        className="w-full p-3 bg-slate-50 border-2 border-black font-bold text-sm outline-none focus:border-[#FA5600] transition-colors placeholder:text-slate-300 placeholder:font-normal" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black tracking-widest uppercase mb-2">Email Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com"
                      className="w-full p-3 bg-slate-50 border-2 border-black font-bold text-sm outline-none focus:border-[#FA5600] transition-colors placeholder:text-slate-300 placeholder:font-normal" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black tracking-widest uppercase mb-2">Message <span className="text-[#FA5600]">*</span></label>
                    <textarea name="message" required rows={4} value={formData.message} onChange={handleChange}
                      placeholder="Tell us what you're looking for, ask about a product, or anything else..."
                      className="w-full p-3 bg-slate-50 border-2 border-black font-bold text-sm outline-none focus:border-[#FA5600] transition-colors resize-none placeholder:text-slate-300 placeholder:font-normal" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-[#25D366] text-white font-black uppercase tracking-tighter text-sm py-4 border-2 border-black flex items-center justify-center gap-2 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-60">
                    {loading ? <span className="animate-pulse">Opening WhatsApp...</span> : <><Send className="w-4 h-4" /> Send via WhatsApp</>}
                  </button>
                  <p className="text-[9px] text-center uppercase font-bold text-slate-400 tracking-widest">Submitting opens WhatsApp with your message pre-filled</p>
                </form>
              </>
            )}
          </div>

          {/* Map */}
          <div className="border-2 border-black overflow-hidden">
            <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#FA5600]" /> TAGS · Hathipole, Udaipur
              </p>
              <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                className="text-[9px] font-black uppercase tracking-widest text-[#FA5600] hover:underline">
                Open in Maps →
              </a>
            </div>
            <iframe
              title="TAGS Shop Location - Udaipur"
              width="100%"
              height="320"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`}
            />
            <a href={mapsLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-slate-50 border-t-2 border-black py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
              <MapPin className="w-3.5 h-3.5" /> Get Directions
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Contact;
