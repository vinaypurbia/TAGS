import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Phone, Mail, MapPin, MessageCircle, Package, Clock, CheckCircle, XCircle, Loader, Edit2, Save, X } from 'lucide-react';

const STATUS_STYLES: Record<string, { color: string; icon: any; label: string }> = {
  pending:   { color: 'bg-yellow-100 text-yellow-700', icon: Clock,         label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700',    icon: CheckCircle,    label: 'Confirmed' },
  delivered: { color: 'bg-green-100 text-green-700',  icon: CheckCircle,    label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-700',      icon: XCircle,        label: 'Cancelled' },
};

export function MyAccount() {
  const { customer, setCustomer, setShowSignIn } = useCart();

  const [orders, setOrders] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', whatsapp: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // If not signed in — show sign in prompt
  const isSignedIn = !!(customer.customerId);

  useEffect(() => {
    if (!isSignedIn) return;
    loadProfile();
  }, [customer.customerId]);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?phone=${encodeURIComponent(customer.phone)}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setOrders(data.sales || []);
        setEditForm({
          name: data.name || '',
          whatsapp: data.whatsapp || data.phone || '',
          email: data.email || '',
          address: data.address || '',
        });
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function saveProfile() {
    if (!editForm.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: customer.customerId,
          name: editForm.name.trim(),
          whatsapp: editForm.whatsapp.trim(),
          email: editForm.email.trim(),
          address: editForm.address.trim(),
        }),
      });
      if (res.ok) {
        setCustomer({ ...customer, ...editForm });
        setProfile((p: any) => ({ ...p, ...editForm }));
        setEditMode(false);
      }
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  }

  function signOut() {
    setCustomer({ name: '', phone: '', customerId: undefined });
    setProfile(null);
    setOrders([]);
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">👤</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 mb-2">My Account</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in with your phone number to view your orders and profile.</p>
        <button
          onClick={() => setShowSignIn(true)}
          className="bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest px-8 py-3 rounded-xl hover:bg-[#E04A00] transition"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-[#FA5600] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-xl">{(profile?.name || customer.name)?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div>
              <p className="text-white font-black text-lg">{profile?.name || customer.name}</p>
              <p className="text-white/70 text-xs">{customer.phone}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!editMode ? (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            ) : (
              <>
                <button onClick={() => setEditMode(false)} className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-lg transition"><X className="w-4 h-4" /></button>
                <button onClick={saveProfile} disabled={saving} className="flex items-center gap-1.5 bg-white text-[#FA5600] text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition hover:bg-orange-50 disabled:opacity-60">
                  {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </>
            )}
            <button onClick={signOut} className="bg-white/10 hover:bg-white/20 text-white/70 text-xs font-bold px-3 py-1.5 rounded-lg transition">
              Sign Out
            </button>
          </div>
        </div>

        <div className="p-6">
          {editMode ? (
            <div className="space-y-3">
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Name *</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">WhatsApp Number</label>
                <input value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Delivery Address</label>
                <textarea rows={2} value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none resize-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {profile?.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="w-4 h-4 text-[#FA5600] shrink-0" />{profile.phone}</div>}
              {(profile?.whatsapp && profile.whatsapp !== profile.phone) && <div className="flex items-center gap-2 text-sm text-gray-600"><MessageCircle className="w-4 h-4 text-[#FA5600] shrink-0" />{profile.whatsapp}</div>}
              {profile?.email && <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="w-4 h-4 text-[#FA5600] shrink-0" />{profile.email}</div>}
              {profile?.address && <div className="flex items-start gap-2 text-sm text-gray-600"><MapPin className="w-4 h-4 text-[#FA5600] shrink-0 mt-0.5" />{profile.address}</div>}
              {!profile?.email && !profile?.address && (
                <p className="text-xs text-gray-400">Add your email and address to make checkout faster.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order History */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-tight text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-[#FA5600]" /> Order History
          <span className="text-sm font-bold text-gray-400 normal-case">({orders.length} orders)</span>
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-bold text-sm">No orders yet</p>
            <p className="text-gray-400 text-xs mt-1">Your orders will appear here once you place them.</p>
            <a href="/products" className="inline-block mt-4 text-[#FA5600] font-black text-sm uppercase tracking-widest hover:underline">
              Start Shopping →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => {
              const statusInfo = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
              const StatusIcon = statusInfo.icon;
              return (
                <div key={order._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                          {order.saleNumber || order.orderId}
                        </p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" /> {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.date || order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <div className="mt-2 space-y-0.5">
                        {(order.items || []).map((item: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600 truncate">
                            × {item.quantity} {item.productName || item.name}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-[#FA5600]">₹{(order.totalAmount || order.subtotal || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyAccount;
