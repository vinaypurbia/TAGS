import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Package, CheckCircle, Clock, Phone, Truck } from 'lucide-react';
import TrackingMap from '../components/TrackingMap';

interface DriverLocation { lat: number; lng: number; updatedAt: string; }
interface OrderInfo {
  _id: string; saleNumber?: string; orderId?: string; status: string;
  customerName: string; customerAddress?: string; deliveryAddress?: string;
  totalAmount: number; paymentMode: string; deliveredAt?: string;
  items: { productName: string; quantity: number; price: number }[];
}

const STATUS_STEPS = ['pending', 'confirmed', 'out_for_delivery', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed', confirmed: 'Confirmed',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
};

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch order — try customers API first (WhatsApp orders), fallback to sales
  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      // Try by _id first
      const r1 = await fetch(`/api/customers?module=orders&id=${orderId}`);
      if (r1.ok) { setOrder(await r1.json()); setLoading(false); return; }
      // Try by orderId string
      const r2 = await fetch(`/api/customers?module=orders&orderId=${orderId}`);
      if (r2.ok) {
        const data = await r2.json();
        const found = data.orders?.[0] || null;
        if (found) { setOrder(found); setLoading(false); return; }
      }
      // Fallback: sales API
      const r3 = await fetch(`/api/sales?id=${orderId}`);
      if (r3.ok) { setOrder(await r3.json()); setLoading(false); return; }
      setError('Order not found'); setLoading(false);
    } catch { setError('Failed to load order'); setLoading(false); }
  }, [orderId]);

  // Fetch driver GPS — uses orderId string as the key (consistent with driver save)
  const fetchLocation = useCallback(async () => {
    if (!orderId) return;
    try {
      // First try to get the order's orderId string for location lookup
      const locationKey = order?.orderId || orderId;
      const res = await fetch(`/api/customers?module=orders&action=location&orderId=${locationKey}`);
      if (res.ok) { setDriverLoc(await res.json()); setLastUpdated(new Date()); }
    } catch {}
  }, [orderId, order?.orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  useEffect(() => { if (order) fetchLocation(); }, [order?._id]);

  // Poll every 5 seconds while out for delivery
  useEffect(() => {
    if (!order || order.status === 'delivered') return;
    const interval = setInterval(() => { fetchLocation(); fetchOrder(); }, 5000);
    return () => clearInterval(interval);
  }, [order?.status]);

  const currentStep = STATUS_STEPS.indexOf(order?.status || 'pending');
  const isOutForDelivery = order?.status === 'out_for_delivery';
  const isDelivered = order?.status === 'delivered';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading your order...</p>
      </div>
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Order Not Found</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button onClick={() => navigate('/')} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Go Home</button>
      </div>
    </div>
  );

  const orderRef = order.orderId || order.saleNumber || orderId;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <Truck className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="font-bold text-gray-800 text-lg">Track Order</h1>
          <p className="text-sm text-gray-500">#{orderRef}</p>
        </div>
        {isDelivered && (
          <span className="ml-auto bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Delivered
          </span>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Live Map */}
        {(isOutForDelivery || (driverLoc && !isDelivered)) ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-gray-700">Driver is on the way</span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-gray-400">
                  Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 1000)}s ago
                </span>
              )}
            </div>
            <div style={{ height: '280px' }}>
              {driverLoc ? (
                <TrackingMap lat={driverLoc.lat} lng={driverLoc.lng} />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center text-gray-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Waiting for driver to start GPS...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : isDelivered ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-green-800">Delivered!</h2>
            <p className="text-green-600 text-sm mt-1">
              {order.deliveredAt ? `Delivered on ${new Date(order.deliveredAt).toLocaleString('en-IN')}` : 'Your order has been delivered.'}
            </p>
            <p className="text-green-600 text-sm mt-1">Check your WhatsApp for confirmation.</p>
            <button
              onClick={() => navigate('/my-account')}
              className="mt-4 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition"
            >
              ← Back to My Account
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
            <Truck className="w-10 h-10 text-blue-400 mx-auto mb-2" />
            <p className="text-blue-700 font-semibold text-sm">Your order is being prepared</p>
            <p className="text-blue-500 text-xs mt-1">Live tracking will appear here once your order is out for delivery.</p>
          </div>
        )}

        {/* Progress Steps */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Order Status</h3>
          <div className="space-y-0">
            {STATUS_STEPS.map((step, idx) => {
              const done = idx <= currentStep;
              const active = idx === currentStep;
              const isLast = idx === STATUS_STEPS.length - 1;
              return (
                <div key={step} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-300'} ${active ? 'ring-4 ring-blue-100' : ''}`}>
                      {done ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    {!isLast && <div className={`w-0.5 h-8 mt-0.5 ${idx < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                  </div>
                  <div className="pt-1 pb-6">
                    <p className={`text-sm font-semibold ${done ? 'text-gray-800' : 'text-gray-400'}`}>{STATUS_LABELS[step]}</p>
                    {active && !isDelivered && <p className="text-xs text-blue-500 mt-0.5">Current status</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Order Summary</h3>
          <div className="space-y-2">
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.productName} × {item.quantity}</span>
                <span className="font-medium">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>₹{order.totalAmount?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Payment</span>
              <span className="capitalize">{['cod','whatsapp','cash'].includes(order.paymentMode?.toLowerCase()) ? '💵 Cash on Delivery' : '✅ Paid'}</span>
            </div>
          </div>
        </div>

        {(order.deliveryAddress || order.customerAddress) && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex gap-3">
            <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Delivery Address</p>
              <p className="text-sm text-gray-500 mt-0.5">{order.deliveryAddress || order.customerAddress}</p>
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
          <Phone className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Need help?</p>
            <p className="text-xs text-blue-600">Contact us on WhatsApp for any delivery issues.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
