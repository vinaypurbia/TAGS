import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Package, MapPin, Phone, LogOut, CheckCircle, Clock, RefreshCw, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

interface Order {
  _id: string; orderId: string; customerName: string;
  customerPhone?: string; deliveryAddress?: string; customerAddress?: string;
  totalAmount: number; paymentMode: string; status: string;
  items: { productName: string; quantity: number }[];
  assignedDriverName?: string;
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function DriverPanel() {
  const { user, token, logout, isDeliveryBoy } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isDeliveryBoy) { navigate('/pos-login'); return; }
    fetchOrders();
    checkPushStatus();
    // Poll every 30s for new assignments
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [isDeliveryBoy]);

  async function fetchOrders() {
    try {
      const res = await fetch('/api/business?module=delivery&action=my_orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setOrders(await res.json());
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }

  async function checkPushStatus() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/delivery-sw.js').catch(() => null);
    if (reg) {
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      if (sub) setPushEnabled(true);
    }
  }

  async function enablePush() {
    if (!VAPID_PUBLIC_KEY) return;
    try {
      const reg = await navigator.serviceWorker.register('/delivery-sw.js');
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await fetch('/api/business?module=delivery&action=push_subscribe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setPushEnabled(true);
    } catch (e) { console.error('Push setup failed', e); }
  }

  const isCOD = (order: Order) =>
    ['cod', 'cash', 'whatsapp'].includes((order.paymentMode || '').toLowerCase());

  if (!isDeliveryBoy) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1A1A1A] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FA5600] rounded-xl flex items-center justify-center font-black text-lg">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-black text-sm">{user?.name}</p>
              <p className="text-white/50 text-xs">Delivery Driver</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setRefreshing(true); fetchOrders(); }}
              className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition ${refreshing ? 'animate-spin' : ''}`}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={logout} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">

        {/* Push notification enable */}
        {!pushEnabled && (
          <button onClick={enablePush}
            className="w-full bg-blue-600 text-white rounded-2xl p-4 flex items-center gap-3 text-left">
            <Bell className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Enable Delivery Alerts</p>
              <p className="text-blue-100 text-xs">Get notified when a new order is assigned to you.</p>
            </div>
          </button>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-black text-[#FA5600]">{orders.length}</p>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">Active Orders</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-black text-green-600">
              {fmt(orders.filter(isCOD).reduce((s, o) => s + o.totalAmount, 0))}
            </p>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">COD to Collect</p>
          </div>
        </div>

        {/* Order list */}
        <h2 className="font-black text-gray-800 text-sm uppercase tracking-widest flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#FA5600]" /> My Assigned Orders
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold text-sm">No orders assigned yet</p>
            <p className="text-gray-400 text-xs mt-1">Pull down to refresh or wait for admin to assign.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order._id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                {/* Status bar */}
                <div className={`px-4 py-2 flex items-center justify-between ${order.status === 'out_for_delivery' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                  <span className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                    {order.status === 'out_for_delivery'
                      ? <><Truck className="w-3.5 h-3.5" /> Out for Delivery</>
                      : <><Clock className="w-3.5 h-3.5" /> Confirmed</>
                    }
                  </span>
                  <span className="text-white/80 text-xs font-bold">{order.orderId}</span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Customer */}
                  <div>
                    <p className="font-black text-gray-900">{order.customerName}</p>
                    {order.customerPhone && (
                      <a href={`tel:${order.customerPhone}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 mt-0.5">
                        <Phone className="w-3 h-3" /> {order.customerPhone}
                      </a>
                    )}
                    {(order.deliveryAddress || order.customerAddress) && (
                      <p className="text-xs text-gray-500 flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#FA5600]" />
                        {order.deliveryAddress || order.customerAddress}
                      </p>
                    )}
                  </div>

                  {/* Items */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                    {order.items?.slice(0, 3).map((item, i) => (
                      <p key={i} className="text-xs text-gray-600">× {item.quantity} {item.productName || (item as any).name}</p>
                    ))}
                    {(order.items?.length || 0) > 3 && (
                      <p className="text-xs text-gray-400">+{order.items.length - 3} more items</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className={`rounded-xl px-3 py-2 flex justify-between items-center ${isCOD(order) ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <span className="text-xs font-bold text-gray-600">
                      {isCOD(order) ? '💵 Collect Cash' : '✅ Pre-paid'}
                    </span>
                    <span className={`font-black text-sm ${isCOD(order) ? 'text-amber-700' : 'text-green-700'}`}>
                      {fmt(order.totalAmount)}
                    </span>
                  </div>

                  {/* Action button */}
                  <Link to={`/deliver/${order._id}`}
                    className="w-full bg-[#FA5600] hover:bg-[#E04A00] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl transition flex items-center justify-center gap-2">
                    <Truck className="w-4 h-4" /> Start Delivery
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
