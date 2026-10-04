import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, RotateCcw, Phone, Mail, MapPin, MessageCircle } from 'lucide-react';
import {
  COD_MIN_ORDER, LOCAL_DELIVERY_CHARGE, DELIVERY_DAYS_LOCAL, DELIVERY_DAYS_COURIER, RETURN_WINDOW_DAYS,
  UPI_ID, SHOP_WHATSAPP, SHOP_PHONE, SHOP_EMAIL, SHOP_ADDRESS,
} from '../lib/storePolicy';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const days = ([a, b]: [number, number]) => (a === b ? `${a} day${a === 1 ? '' : 's'}` : `${a}–${b} days`);

function Page({ icon, title, intro, children }: { icon: React.ReactNode; title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 bg-orange-50 text-[#FA5600] rounded-xl flex items-center justify-center">{icon}</div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-gray-900">{title}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8 leading-relaxed">{intro}</p>
      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">{children}</div>
      <ContactBlock />
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-black uppercase tracking-widest text-gray-900 border-b border-gray-200 pb-2 mb-3">{children}</h2>
);

function ContactBlock() {
  return (
    <div className="mt-10 bg-gray-50 border border-gray-200 rounded-2xl p-5">
      <p className="text-xs font-black uppercase tracking-widest text-gray-900 mb-3">Questions? Contact TAGS</p>
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#FA5600]" /> {SHOP_PHONE}</li>
        <li className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-[#FA5600]" /> <a className="underline hover:text-[#FA5600]" href={`https://wa.me/${SHOP_WHATSAPP}`} target="_blank" rel="noopener noreferrer">WhatsApp us</a></li>
        <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#FA5600]" /> {SHOP_EMAIL}</li>
        <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[#FA5600] mt-0.5 shrink-0" /> <span>{SHOP_ADDRESS}</span></li>
      </ul>
      <Link to="/contact" className="inline-block mt-3 text-xs font-black uppercase tracking-widest text-[#FA5600] hover:underline">Contact page →</Link>
    </div>
  );
}

export function ShippingPolicy() {
  return (
    <Page icon={<Truck className="w-5 h-5" />} title="Shipping & Delivery"
      intro="We deliver across India. How you pay depends on where you live and the value of your order.">
      <section>
        <H>Delivery in Udaipur</H>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Estimated delivery: <b>{days(DELIVERY_DAYS_LOCAL)}</b> after your order is confirmed.</li>
          <li>Delivery charge: <b>{LOCAL_DELIVERY_CHARGE === 0 ? 'Free' : inr(LOCAL_DELIVERY_CHARGE)}</b>.</li>
          <li><b>Cash on Delivery</b> is available for orders of <b>{inr(COD_MIN_ORDER)} or more</b>. You pay the delivery person in cash when your order arrives, so nothing is paid online.</li>
          <li>Orders below {inr(COD_MIN_ORDER)} in Udaipur are paid in advance.</li>
        </ul>
      </section>

      <section>
        <H>Delivery outside Udaipur (all across India)</H>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We ship by courier. Estimated delivery: <b>{days(DELIVERY_DAYS_COURIER)}</b> after your payment is received.</li>
          <li>Orders outside Udaipur are paid <b>in advance</b>. The amount includes the <b>courier charge for your delivery address</b>, which is shown at checkout or confirmed with you on WhatsApp before you pay.</li>
          <li>{UPI_ID ? <>Pay by UPI to <b>{UPI_ID}</b>, then send the payment screenshot and your Order ID on WhatsApp.</> : <>After you place your order we share the payment details with you. Send the payment screenshot and your Order ID on WhatsApp.</>} We dispatch your order once the payment is received.</li>
          <li>Cash on Delivery is not available outside Udaipur.</li>
        </ul>
      </section>

      <section>
        <H>How ordering works</H>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Add items to your order list and open it.</li>
          <li>Enter your name, mobile number and full delivery address (city, pincode and state). No account is needed.</li>
          <li>Place your order. You see your Order ID, the amount to pay and the estimated delivery dates straight away.</li>
          <li>Track your order any time with the Track Order link on the confirmation page.</li>
        </ol>
        <p className="mt-3">We do not use an online payment gateway, and we never ask for card details.</p>
      </section>

      <section>
        <H>Availability</H>
        <p>Orders are accepted for items that are in stock. If an item is no longer available after you order, we will contact you on WhatsApp or by phone to offer an alternative or cancel that item.</p>
      </section>
    </Page>
  );
}

export function ReturnPolicy() {
  return (
    <Page icon={<RotateCcw className="w-5 h-5" />} title="Returns & Refunds"
      intro="We accept returns. Here is how they work.">
      <section>
        <H>Return window</H>
        <p>You can request a return within <b>{RETURN_WINDOW_DAYS} days</b> of receiving your order.</p>
      </section>

      <section>
        <H>How to return an item</H>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Contact us on WhatsApp, by phone or by email with your Order ID and the reason for the return.</li>
          <li>We confirm the return and the address to send it to.</li>
          <li>Pack the item in the condition you received it, with its original packaging and accessories, and send it back to us.</li>
        </ol>
      </section>

      <section>
        <H>Return shipping</H>
        <p>The courier charge for sending the item back is <b>paid by the customer</b>. Please keep your courier receipt until the return is settled.</p>
      </section>

      <section>
        <H>Refunds</H>
        <p>We inspect the returned goods when they reach us. Your payment is provided <b>after the inspection</b>, and we confirm it with you on WhatsApp. If a returned item does not pass inspection, we will tell you why.</p>
      </section>
    </Page>
  );
}
