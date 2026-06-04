import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, MapPin, Package, DollarSign, Loader, AlertCircle, Navigation } from 'lucide-react';

interface OrderInfo {
  _id: string;
  saleNumber?: string;
  orderId?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  deliveryAddress?: string;
  totalAmount: number;
  paymentMode: string;
  paidAmount?: number;
  status: string;
  items: { productName: string; quantity: number; price: number }[];
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function DriverDeliver() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [error, setError] = useState('');
  const [driverName, setDriverName] = useState(localStorage.getItem('driverName') || '');
  const [cashCollected, setCashCollected] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank'>('cash');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'active' | 'error'>('idle');
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Fetch order
  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/sales?id=${orderId}`)
      .then(r => r.json())
      .then(data => {
        setOrder(data);
        // Pre-fill cash amount for COD
        const isCOD = ['cod', 'cash'].includes((data.paymentMode || '').toLowerCase());
        const partial = Number(data.paidAmount || 0);
        if (isCOD || partial > 0) {
          setCashCollected(String(data.totalAmount - partial));
        }
        setLoading(false);
      })
      .catch(() => { setError('Order not found'); setLoading(false); });
  }, [orderId]);

  // Start GPS tracking — watch position and POST to server every 5s
  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }
    setGpsStatus('active');

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    // POST to server every 5 seconds
    gpsIntervalRef.current = setInterval(async () => {
      if (!currentPos || !orderId) return;
      try {
        await fetch('/api/sales', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: orderId,
            action: 'driver_location',
            lat: currentPos.lat,
            lng: currentPos.lng,
          }),
        });
      } catch {}
    }, 5000);
  }, [orderId, currentPos]);

  // Also push immediately when position changes
  useEffect(() => {
    if (gpsStatus !== 'active' || !currentPos || !orderId) return;
    fetch('/api/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: orderId,
        action: 'driver_location',
        lat: currentPos.lat,
        lng: currentPos.lng,
      }),
    }).catch(() => {});
  }, [currentPos, gpsStatus, orderId]);

  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    setGpsStatus('idle');
  }, []);

  useEffect(() => () => stopGPS(), [stopGPS]);

  const handleMarkDelivered = async () => {
    if (!order) return;
    if (!driverName.trim()) { setError('Please enter your name'); return; }
    setSubmitting(true);
    setError('');
    try {
      localStorage.setItem('driverName', driverName);
      const res = await fetch('/api/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          action: 'complete_delivery',
          driverName: driverName.trim(),
          cashCollected: Number(cashCollected) || 0,
          paymentCollectedMode: paymentMode,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      stopGPS();
      setDelivered(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading order...</p>
        </div>
      </div>
    );
  }

  if (delivered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
        <div className="text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-800 mb-2">Delivered!</h2>
          <p className="text-green-600">Customer has been notified on WhatsApp.</p>
          <p className="text-green-600 text-sm mt-1">Admin has also been notified.</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const isCOD = ['cod', 'cash'].includes((order?.paymentMode || '').toLowerCase());
  const partialPaid = Number(order?.paidAmount || 0);
  const totalAmt = Number(order?.totalAmount || 0);
  const cashDue = isCOD ? totalAmt : Math.max(0, totalAmt - partialPaid);
  const orderRef = order?.saleNumber || order?.orderId || orderId;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-5">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5" />
          <span className="font-bold text-lg">Delivery #{orderRef}</span>
        </div>
        <p className="text-blue-100 text-sm">Deliver to: <strong>{order?.customerName}</strong></p>
        {(order?.deliveryAddress || order?.customerAddress) && (
          <p className="text-blue-100 text-sm mt-0.5 flex items-start gap-1">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {order?.deliveryAddress || order?.customerAddress}
          </p>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">

        {/* GPS Tracking Toggle */}
        <div className={`rounded-2xl p-4 border-2 ${
          gpsStatus === 'active' ? 'bg-green-50 border-green-300' :
          gpsStatus === 'error' ? 'bg-red-50 border-red-300' :
          'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className={`w-5 h-5 ${
                gpsStatus === 'active' ? 'text-green-600' :
                gpsStatus === 'error' ? 'text-red-500' : 'text-gray-400'
              }`} />
              <div>
                <p className="font-semibold text-sm text-gray-700">GPS Sharing</p>
                <p className="text-xs text-gray-500">
                  {gpsStatus === 'active' ? `Live — sharing location${currentPos ? ` (${currentPos.lat.toFixed(4)}, ${currentPos.lng.toFixed(4)})` : ''}` :
                   gpsStatus === 'error' ? 'GPS unavailable' :
                   'Start to let customer track you'}
                </p>
              </div>
            </div>
            {gpsStatus === 'active' ? (
              <button onClick={stopGPS} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium">
                Stop
              </button>
            ) : (
              <button onClick={startGPS} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">
                Start
              </button>
            )}
          </div>
          {gpsStatus === 'active' && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600">Customer can see your location live</span>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Items to deliver</h3>
          <div className="space-y-2">
            {order?.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.productName} × {item.quantity}</span>
                <span className="font-medium">{fmt(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>{fmt(totalAmt)}</span>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className={`rounded-2xl p-4 border-2 ${isCOD || cashDue > 0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-5 h-5 ${isCOD || cashDue > 0 ? 'text-amber-600' : 'text-green-600'}`} />
            <span className="font-semibold text-sm text-gray-700">Payment</span>
          </div>
          {isCOD ? (
            <p className="text-amber-700 text-sm font-medium">💵 COD — Collect <strong>{fmt(totalAmt)}</strong> from customer</p>
          ) : cashDue > 0 ? (
            <p className="text-amber-700 text-sm font-medium">💵 Partial — Collect <strong>{fmt(cashDue)}</strong> remaining from customer</p>
          ) : (
            <p className="text-green-700 text-sm font-medium">✅ Fully paid in advance. No cash to collect.</p>
          )}
        </div>

        {/* Mark Delivered Form */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-gray-700">Confirm Delivery</h3>

          {/* Driver Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Your Name</label>
            <input
              type="text"
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
              placeholder="Enter your name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cash collected — only if COD or partial */}
          {cashDue > 0 && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Cash Collected (₹)</label>
                <input
                  type="number"
                  value={cashCollected}
                  onChange={e => setCashCollected(e.target.value)}
                  placeholder={`${cashDue}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">Payment mode collected</label>
                <div className="flex gap-2">
                  {(['cash', 'bank'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentMode(m)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        paymentMode === m ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {m === 'cash' ? '💵 Cash' : '🏦 Bank Transfer'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleMarkDelivered}
            disabled={submitting || !driverName.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader className="w-5 h-5 animate-spin" /> Confirming...</>
            ) : (
              <><CheckCircle className="w-5 h-5" /> Mark as Delivered</>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            This will notify the customer on WhatsApp and alert the admin.
          </p>
        </div>

      </div>
    </div>
  );
}
