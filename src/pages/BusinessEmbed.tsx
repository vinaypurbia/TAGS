import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  AlertTriangle, BarChart2, Users, FileText, Plus, Trash2,
  Check, X, Search, Phone, Mail, MapPin, ChevronDown, ChevronUp
} from 'lucide-react';

type Module = 'dashboard' | 'orders' | 'sales' | 'purchase-orders' | 'cashflow' | 'expenses' | 'suppliers' | 'customers' | 'reports';
type ReportType = 'stock-shortage' | 'low-performing' | 'best-selling' | 'profit-margin' | 'pnl' | 'stock-valuation';

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n: number) => Number(n || 0).toLocaleString('en-IN');

export function BusinessEmbed() {
  const [module, setModule] = useState<Module>('dashboard');
  const [message, setMessage] = useState({ text: '', type: '' });

  const showMsg = (text: string, type: string) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: Package },
    { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {message.text && (
        <div className={`p-3 rounded-xl text-center font-semibold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setModule(tab.id as Module)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${module === tab.id ? 'bg-[#FA5600] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#FA5600] hover:text-[#FA5600]'}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {module === 'dashboard' && <DashboardModule showMsg={showMsg} />}
      {module === 'orders' && <OrdersModule showMsg={showMsg} />}
      {module === 'sales' && <SalesModule showMsg={showMsg} />}
      {module === 'purchase-orders' && <PurchaseOrdersModule showMsg={showMsg} />}
      {module === 'cashflow' && <CashflowModule showMsg={showMsg} />}
      {module === 'expenses' && <ExpensesModule showMsg={showMsg} />}
      {module === 'customers' && <CustomersModule showMsg={showMsg} />}
      {module === 'suppliers' && <SuppliersModule showMsg={showMsg} />}
      {module === 'reports' && <ReportsModule showMsg={showMsg} />}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function DashboardModule({ showMsg }: any) {
  const [stats, setStats] = useState<any>(null);
  const [shortage, setShortage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/sales?period=month').then(r => r.json()),
      fetch('/api/business?module=cashflow&period=month').then(r => r.json()),
      fetch('/api/business?module=reports&type=stock-shortage').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ]).then(([salesData, cashData, shortageData, custData]) => {
      setStats({ sales: salesData.summary, cash: cashData.summary, customers: custData.summary });
      setShortage(Array.isArray(shortageData) ? shortageData.slice(0, 5) : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingCards count={4} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Revenue (Month)', value: fmt(stats?.sales?.totalRevenue || 0), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Orders (Month)', value: fmtQty(stats?.sales?.totalOrders || 0), icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
          { label: 'Total Customers', value: fmtQty(stats?.customers?.totalCustomers || 0), icon: Users, color: 'text-purple-600 bg-purple-50' },
          { label: 'Net Profit', value: fmt(stats?.cash?.profit || 0), icon: DollarSign, color: 'text-[#FA5600] bg-orange-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${card.color}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-black text-gray-900">{card.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {shortage.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-yellow-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Low Stock Alerts</h3>
            <span className="ml-auto text-xs text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full">{shortage.length} items</span>
          </div>
          <div className="space-y-2">
            {shortage.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-yellow-50 rounded-lg">
                {item.image && <img src={item.image} alt={item.productName} className="w-8 h-8 rounded object-cover" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-400">{item.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${item.isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`}>{item.availableStock} left</p>
                  <p className="text-[10px] text-gray-400">alert at {item.lowStockAlert}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shortage.length === 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-sm font-bold text-green-700">All stock levels are healthy!</p>
        </div>
      )}
    </div>
  );
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
function CustomersModule({ showMsg }: any) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const fetchCustomers = () => {
    setLoading(true);
    fetch('/api/customers')
      .then(r => r.json())
      .then(data => { setCustomers(data.customers || []); setSummary(data.summary || {}); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  const fetchDetail = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setCustomerDetail(null); return; }
    setExpandedId(id);
    const res = await fetch(`/api/customers?id=${id}`);
    const data = await res.json();
    setCustomerDetail(data);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.phone) { showMsg('Name and phone required.', 'error'); return; }
    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...form } : form;
    const res = await fetch('/api/customers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
      showMsg(editId ? '✅ Customer updated!' : '✅ Customer added!', 'success');
      setShowForm(false); setEditId(null);
      setForm({ name: '', phone: '', email: '', address: '', notes: '' });
      fetchCustomers();
    } else showMsg(data.error || 'Failed.', 'error');
  };

  const startEdit = (c: any) => {
    setEditId(c._id);
    setForm({ name: c.name, phone: c.phone, email: c.email || '', address: c.address || '', notes: c.notes || '' });
    setShowForm(true);
  };

  const deleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Their purchase history will remain in sales records.`)) return;
    await fetch('/api/customers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Customer deleted.', 'success');
    fetchCustomers();
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Customers', value: fmtQty(summary.totalCustomers || 0) },
          { label: 'Total Revenue', value: fmt(summary.totalRevenue || 0) },
          { label: 'Repeat Customers', value: fmtQty(summary.repeatCustomers || 0) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xl font-black text-gray-900">{s.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone or email..."
            className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition" />
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', phone: '', email: '', address: '', notes: '' }); }}
          className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition shrink-0">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">{editId ? 'Edit Customer' : 'New Customer'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Phone *</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 00000 00000"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Delivery address"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this customer..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">
              {editId ? 'Update Customer' : 'Add Customer'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Customer List */}
      {loading ? <LoadingCards count={4} /> : filtered.length === 0 ? (
        <EmptyState icon="👥" text={searchQuery ? 'No customers found' : 'No customers yet — they are auto-added when you record a sale'} />
      ) : (
        <div className="space-y-3">
          {filtered.map(customer => (
            <div key={customer._id} className={`bg-white rounded-xl border transition-all ${expandedId === customer._id ? 'border-[#FA5600]' : 'border-gray-200'}`}>
              {/* Customer row */}
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => fetchDetail(customer._id)}>
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 font-black text-[#FA5600] text-lg">
                  {customer.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-900">{customer.name}</p>
                  <p className="text-xs text-gray-400">{customer.phone}</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="font-black text-sm text-[#FA5600]">{fmt(customer.totalSpend)}</p>
                  <p className="text-[10px] text-gray-400">{customer.totalOrders} order{customer.totalOrders !== 1 ? 's' : ''}</p>
                </div>
                {expandedId === customer._id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </div>

              {/* Expanded purchase history */}
              {expandedId === customer._id && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Customer details */}
                  <div className="grid grid-cols-2 gap-3">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate">{customer.address}</span>
                      </div>
                    )}
                    {customer.lastOrderDate && (
                      <div className="text-xs text-gray-400">
                        Last order: {new Date(customer.lastOrderDate).toLocaleDateString('en-IN')}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <p className="font-black text-sm text-[#FA5600]">{fmt(customer.totalSpend)}</p>
                      <p className="text-[9px] text-gray-400 uppercase font-bold">Total Spent</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="font-black text-sm text-blue-600">{customer.totalOrders}</p>
                      <p className="text-[9px] text-gray-400 uppercase font-bold">Orders</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="font-black text-sm text-green-600">
                        {customer.totalOrders > 0 ? fmt(customer.totalSpend / customer.totalOrders) : '₹0'}
                      </p>
                      <p className="text-[9px] text-gray-400 uppercase font-bold">Avg Order</p>
                    </div>
                  </div>

                  {/* Purchase history */}
                  {customerDetail && customerDetail._id === customer._id && customerDetail.sales && (
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Purchase History</p>
                      {customerDetail.sales.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No purchases recorded yet</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {customerDetail.sales.map((sale: any) => (
                            <div key={sale._id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                              <div>
                                <p className="text-xs font-bold text-gray-800">{sale.saleNumber}</p>
                                <p className="text-[10px] text-gray-400">{new Date(sale.date).toLocaleDateString('en-IN')} · {sale.items?.length} item{sale.items?.length !== 1 ? 's' : ''}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {sale.items?.slice(0, 3).map((item: any, i: number) => (
                                    <span key={i} className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded-full text-gray-500">{item.productName}</span>
                                  ))}
                                  {sale.items?.length > 3 && <span className="text-[9px] text-gray-400">+{sale.items.length - 3} more</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="font-black text-sm text-[#FA5600]">{fmt(sale.totalAmount)}</p>
                                <StatusBadge status={sale.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* WhatsApp + Actions */}
                  <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100">
                    <a href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-black px-3 py-1.5 rounded-full hover:bg-[#20bd5a] transition">
                      <Phone className="w-3 h-3" /> WhatsApp
                    </a>
                    <button onClick={() => startEdit(customer)}
                      className="text-xs text-blue-500 font-bold border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-50 transition">
                      Edit
                    </button>
                    <button onClick={() => deleteCustomer(customer._id, customer.name)}
                      className="text-xs text-red-400 font-bold border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-50 transition ml-auto">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── ORDERS MODULE ────────────────────────────────────────────────────────────
function OrdersModule({ showMsg }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveryDates, setDeliveryDates] = useState<Record<string, string>>({});
  const [sorryMsgs, setSorryMsgs] = useState<Record<string, string>>({});
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, string>>({});
  const [partialAmounts, setPartialAmounts] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);

  // Payment collection modal state
  const [payModal, setPayModal] = useState<{
    open: boolean; order: any | null;
    paymentMode: 'cash' | 'upi' | 'already_paid';
    amountCollected: string;
    collectedBy: 'owner' | 'delivery_boy' | 'third_party';
    collectorName: string;
    submitting: boolean;
  }>({ open: false, order: null, paymentMode: 'cash', amountCollected: '', collectedBy: 'owner', collectorName: '', submitting: false });

  const openDeliverModal = (order: any) => {
    setPayModal({
      open: true, order,
      paymentMode: order.paymentStatus === 'paid' ? 'already_paid' : 'cash',
      amountCollected: String(order.balanceDue > 0 ? order.balanceDue : order.totalAmount || ''),
      collectedBy: 'owner', collectorName: '', submitting: false,
    });
  };

  const handleDelivered = async () => {
    const { order, paymentMode, amountCollected, collectedBy, collectorName } = payModal;
    if (!order) return;
    if (paymentMode !== 'already_paid' && (!amountCollected || isNaN(Number(amountCollected)) || Number(amountCollected) <= 0)) {
      alert('Please enter a valid amount collected.'); return;
    }
    if ((collectedBy === 'delivery_boy' || collectedBy === 'third_party') && !collectorName.trim()) {
      alert("Please enter the collector's name."); return;
    }
    setPayModal(p => ({ ...p, submitting: true }));
    try {
      await fetch('/api/customers?module=orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order._id, status: 'delivered',
          paymentMode, amountCollected: Number(amountCollected) || 0,
          collectedBy, collectorName,
        }),
      });
      if (paymentMode !== 'already_paid') {
        await fetch('/api/cashflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'income', category: 'delivery_collection',
            amount: Number(amountCollected),
            description: `COD collected – ${order.customerName} (${order.orderId})`,
            paymentMode, referenceId: order._id, referenceType: 'order',
            collectedBy, collectorName: collectorName || null,
            orderId: order.orderId, date: new Date().toISOString(),
          }),
        });
      }
      showMsg('Order delivered & payment recorded!', 'success');
      setPayModal(p => ({ ...p, open: false, order: null, submitting: false }));
      fetchOrders();
    } catch {
      setPayModal(p => ({ ...p, submitting: false }));
      showMsg('Something went wrong. Please try again.', 'error');
    }
  };

  const fetchOrders = () => {
    setLoading(true);
    fetch('/api/customers?module=orders')
      .then(r => r.json())
      .then(data => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
    fetch('/api/products?limit=200').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (d.products || []))).catch(() => {});
  }, []);

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  const updateStatus = async (order: any, status: string, extra: any = {}) => {
    await fetch('/api/customers?module=orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order._id, status, ...extra }),
    });
    showMsg(`Order ${status}!`, 'success');
    fetchOrders();
  };

  const openWhatsApp = (phone: string, message: string) => {
    const clean = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${clean.startsWith('91') ? clean : '91' + clean}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const confirmOrder = (order: any) => {
    const deliveryDate = deliveryDates[order._id] || '';
    if (!deliveryDate) { showMsg('Please select a delivery date first.', 'error'); return; }
    const paymentStatus = paymentStatuses[order._id] || 'pending';
    const dateFormatted = new Date(deliveryDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const itemLines = (order.items || []).map((i: any) => `  - ${i.productName || i.name} x${i.quantity} = Rs. ${((i.price || 0) * i.quantity).toFixed(2)}`).join('\n');
    const partialAmt = parseFloat(partialAmounts[order._id] || '0');
    const balance = Number(order.totalAmount) - partialAmt;
    const paymentLabel = paymentStatus === 'paid'
      ? 'PAID - Thank you!'
      : paymentStatus === 'partial'
      ? `PARTIAL - Rs. ${partialAmt.toFixed(2)} received, Rs. ${balance.toFixed(2)} due on delivery`
      : 'PENDING - Pay on delivery/collection';
    const message = [
      `Hello ${order.customerName}!`,
      ``,
      `Your order *${order.orderId}* has been *CONFIRMED*.`,
      ``,
      `*Items Ordered:*`,
      itemLines,
      `*Order Total:* Rs. ${Number(order.totalAmount).toFixed(2)}`,
      `*Payment Status:* ${paymentLabel}`,
      ``,
      `*Estimated Delivery:* ${dateFormatted}`,
      ``,
      `We will contact you before delivery. Thank you for shopping with TAGS!`,
    ].join('\n');
    updateStatus(order, 'confirmed', { deliveryDate, paymentStatus, partialAmount: partialAmt, balanceDue: paymentStatus === 'partial' ? balance : 0 });
    openWhatsApp(order.customerPhone, message);
  };

  const sendSorry = (order: any) => {
    const customMsg = sorryMsgs[order._id] || '';
    // Find similar products from catalog
    const orderCategories = [...new Set((order.items || []).map((i: any) => i.category).filter(Boolean))];
    const suggestions = products
      .filter(p => orderCategories.includes(p.category) && p.name !== (order.items?.[0]?.productName))
      .slice(0, 2)
      .map(p => `  - ${p.name} (Rs. ${p.discountedPrice || p.price})`)
      .join('\n');

    const message = [
      `Hello ${order.customerName}, 🙏`,
      ``,
      `We are sorry, your order *${order.orderId}* cannot be fulfilled at this time.`,
      customMsg ? `\n${customMsg}` : '',
      suggestions ? `\n*You might also like:*\n${suggestions}\nVisit: www.ta-gs.online` : '',
      ``,
      `We apologize for the inconvenience. Please contact us for more help.`,
      `*TAGS Team* 🧡`,
    ].filter(Boolean).join('\n');
    updateStatus(order, 'cancelled');
    openWhatsApp(order.customerPhone, message);
  };

  const counts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const statusColors: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'confirmed', 'delivered', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border-2 ${statusFilter === s ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#FA5600] hover:text-[#FA5600]'}`}>
            {s} ({counts[s] ?? orders.length})
          </button>
        ))}
      </div>

      {loading ? <LoadingCards count={3} /> : filtered.length === 0 ? (
        <EmptyState icon="📦" text={`No ${statusFilter === 'all' ? '' : statusFilter} orders yet`} />
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <div key={order._id} className={`bg-white rounded-xl border-2 transition-all ${expandedId === order._id ? 'border-[#FA5600]' : 'border-gray-200'}`}>
              {/* Order header row */}
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === order._id ? null : order._id)}>
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${order.status === 'pending' ? 'bg-yellow-400 animate-pulse' : order.status === 'confirmed' ? 'bg-blue-400' : order.status === 'delivered' ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-900">{order.customerName}</p>
                  <p className="text-xs text-gray-400">{order.orderId} · {order.customerPhone}</p>
                  <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-base text-[#FA5600]">Rs. {Number(order.totalAmount).toFixed(2)}</p>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-500'}`}>
                    {order.status || 'pending'}
                  </span>
                </div>
                {expandedId === order._id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </div>

              {/* Expanded order detail */}
              {expandedId === order._id && (
                <div className="border-t border-gray-100 p-4 space-y-4">

                  {/* Items list */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Items Ordered</p>
                    <div className="space-y-1.5">
                      {(order.items || []).map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{item.productName || item.name}</p>
                            <p className="text-[10px] text-gray-400">{item.category}</p>
                          </div>
                          <span className="text-xs font-black text-gray-600 shrink-0">x{item.quantity}</span>
                          <span className="text-xs font-black text-[#FA5600] shrink-0">Rs. {((item.price || 0) * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery address */}
                  {order.deliveryAddress && (
                    <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 rounded-lg px-3 py-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>{order.deliveryAddress}</span>
                    </div>
                  )}

                  {/* ── ACTION AREA ── */}
                  {order.status === 'pending' && (
                    <div className="space-y-3 border-t border-gray-100 pt-3">

                      {/* CONFIRM with delivery date */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-green-700">Confirm & Set Delivery Date</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Delivery Date</label>
                            <input
                              type="date"
                              value={deliveryDates[order._id] || ''}
                              onChange={e => setDeliveryDates(d => ({ ...d, [order._id]: e.target.value }))}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full border-2 border-green-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-green-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Payment Status</label>
                            <select
                              value={paymentStatuses[order._id] || 'pending'}
                              onChange={e => setPaymentStatuses(p => ({ ...p, [order._id]: e.target.value }))}
                              className="w-full border-2 border-green-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-green-500 outline-none bg-white">
                              <option value="pending">Pending (COD)</option>
                              <option value="partial">Partial Paid</option>
                              <option value="paid">Fully Paid</option>
                            </select>
                          </div>
                        </div>
                        {(paymentStatuses[order._id] || 'pending') === 'partial' && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1.5">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-yellow-700">Amount Already Paid (Rs.)</label>
                            <input
                              type="number"
                              min="0"
                              max={order.totalAmount}
                              step="0.01"
                              value={partialAmounts[order._id] || ''}
                              onChange={e => setPartialAmounts(p => ({ ...p, [order._id]: e.target.value }))}
                              placeholder="e.g. 200"
                              className="w-full border-2 border-yellow-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-yellow-500 outline-none bg-white"
                            />
                            {partialAmounts[order._id] && parseFloat(partialAmounts[order._id]) > 0 && (
                              <p className="text-xs font-bold text-yellow-700">
                                Balance due on delivery: Rs. {(Number(order.totalAmount) - parseFloat(partialAmounts[order._id])).toFixed(2)}
                              </p>
                            )}
                          </div>
                        )}
                        <button onClick={() => confirmOrder(order)}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" /> Confirm Order & WhatsApp Customer
                        </button>
                      </div>

                      {/* SORRY / UNAVAILABLE */}
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-red-600">Item Unavailable / Sorry Message</p>
                        <textarea
                          value={sorryMsgs[order._id] || ''}
                          onChange={e => setSorryMsgs(m => ({ ...m, [order._id]: e.target.value }))}
                          placeholder="Optional: add a custom note or alternative suggestion..."
                          rows={2}
                          className="w-full border-2 border-red-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-red-400 outline-none bg-white resize-none"
                        />
                        <p className="text-[10px] text-red-400 font-bold">Similar products from your catalog will be auto-suggested in the message.</p>
                        <button onClick={() => sendSorry(order)}
                          className="w-full bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                          <X className="w-4 h-4" /> Send Sorry & Suggestions via WhatsApp
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Already confirmed — show delivery date + mark delivered */}
                  {order.status === 'confirmed' && (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      {order.deliveryDate && (
                        <p className="text-xs text-blue-600 font-bold bg-blue-50 rounded-lg px-3 py-2">
                          📅 Delivery scheduled: {new Date(order.deliveryDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      )}
                      <button onClick={() => openDeliverModal(order)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl transition">
                        Mark as Delivered ✓
                      </button>
                    </div>
                  )}

                  {/* WhatsApp direct link always visible */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <a href={`https://wa.me/${order.customerPhone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-black px-3 py-1.5 rounded-full hover:bg-[#20bd5a] transition">
                      <Phone className="w-3 h-3" /> WhatsApp
                    </a>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-500'}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PAYMENT COLLECTION MODAL ── */}
      {payModal.open && payModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-black text-gray-900 text-base uppercase tracking-widest">Mark as Delivered</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{payModal.order.customerName} · ₹{Number(payModal.order.totalAmount || 0).toLocaleString('en-IN')}</p>
              </div>
              <button onClick={() => setPayModal(p => ({ ...p, open: false }))} className="text-gray-400 hover:text-gray-600 text-xl font-black">✕</button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment Mode</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'cash',         label: '💵 Cash' },
                  { value: 'upi',          label: '📱 UPI' },
                  { value: 'already_paid', label: '✅ Pre-paid' },
                ] as const).map(opt => (
                  <button key={opt.value}
                    onClick={() => setPayModal(p => ({ ...p, paymentMode: opt.value }))}
                    className={`py-2 px-3 rounded-xl text-xs font-black border-2 transition ${payModal.paymentMode === opt.value ? 'border-[#FA5600] bg-orange-50 text-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {payModal.paymentMode !== 'already_paid' && (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Amount Collected (₹)</p>
                <input type="number" min="0"
                  value={payModal.amountCollected}
                  onChange={e => setPayModal(p => ({ ...p, amountCollected: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none"
                  placeholder="Enter amount" />
              </div>
            )}

            {payModal.paymentMode !== 'already_paid' && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Collected By</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'owner',        label: '🏠 Owner' },
                    { value: 'delivery_boy', label: '🛵 Delivery' },
                    { value: 'third_party',  label: '📦 3rd Party' },
                  ] as const).map(opt => (
                    <button key={opt.value}
                      onClick={() => setPayModal(p => ({ ...p, collectedBy: opt.value }))}
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border-2 transition ${payModal.collectedBy === opt.value ? 'border-[#FA5600] bg-orange-50 text-[#FA5600]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(payModal.collectedBy === 'delivery_boy' || payModal.collectedBy === 'third_party') && (
                  <input type="text"
                    value={payModal.collectorName}
                    onChange={e => setPayModal(p => ({ ...p, collectorName: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none mt-1"
                    placeholder={payModal.collectedBy === 'delivery_boy' ? "Delivery boy's name" : 'Third party name'} />
                )}
              </div>
            )}

            {payModal.paymentMode === 'already_paid' && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs font-bold text-green-700">
                ✅ Already paid online — will be marked delivered directly.
              </div>
            )}

            {payModal.paymentMode !== 'already_paid' && payModal.amountCollected && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 text-xs font-black text-[#FA5600]">
                ₹{Number(payModal.amountCollected).toLocaleString('en-IN')} via {payModal.paymentMode.toUpperCase()} → will post to Cash Flow
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setPayModal(p => ({ ...p, open: false }))}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500 hover:border-gray-300 transition">
                Cancel
              </button>
              <button onClick={handleDelivered} disabled={payModal.submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#FA5600] text-white text-xs font-black uppercase tracking-widest hover:bg-[#E04A00] transition disabled:opacity-60">
                {payModal.submitting ? 'Saving...' : '✓ Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function SalesModule({ showMsg }: any) {
  const [sales, setSales] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerAddress: '', notes: '', paymentMode: 'cash', items: [{ productId: '', productName: '', price: '', quantity: '1' }] });

  const fetchSales = () => {
    setLoading(true);
    fetch(`/api/sales?period=${period}`)
      .then(r => r.json())
      .then(data => { setSales(data.sales || []); setSummary(data.summary || {}); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchSales(); }, [period]);
  useEffect(() => { fetch('/api/products').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : [])).catch(() => {}); }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', price: '', quantity: '1' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateItem = (i: number, field: string, value: string) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      if (field === 'productId') {
        const product = products.find(p => p._id === value);
        if (product) { items[i].productName = product.name; items[i].price = String(product.discountedPrice || product.price || ''); }
      }
      return { ...f, items };
    });
  };

  const handleSubmit = async () => {
    if (!form.customerName || !form.customerPhone) { showMsg('Customer name and phone required.', 'error'); return; }
    const validItems = form.items.filter(i => i.productName && i.price && i.quantity);
    if (validItems.length === 0) { showMsg('Add at least one item.', 'error'); return; }
    const payload = { ...form, items: validItems.map(i => ({ productId: i.productId, productName: i.productName, price: parseFloat(i.price), quantity: parseInt(i.quantity) })) };
    const res = await fetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) {
      showMsg(`✅ Sale ${data.saleNumber} recorded! Customer auto-saved.`, 'success');
      setShowForm(false);
      setForm({ customerName: '', customerPhone: '', customerAddress: '', notes: '', paymentMode: 'cash', items: [{ productId: '', productName: '', price: '', quantity: '1' }] });
      fetchSales();
    } else showMsg(data.error || 'Failed.', 'error');
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/sales', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    fetchSales();
  };

  const deleteSale = async (id: string) => {
    if (!confirm('Delete this sale? Stock will be restored.')) return;
    await fetch('/api/sales', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Sale deleted. Stock restored.', 'success');
    fetchSales();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Revenue', value: fmt(summary.totalRevenue) },
          { label: 'Orders', value: fmtQty(summary.totalOrders) },
          { label: 'Avg Order', value: fmt(summary.avgOrderValue) },
          { label: 'Pending', value: fmtQty(summary.pendingCount) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xl font-black text-gray-900">{s.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition ml-auto">
          <Plus className="w-4 h-4" /> Record Sale
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-4">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">New Sale</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Customer Name *</label>
              <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Customer name" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Phone *</label>
              <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="+91 00000 00000" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="whatsapp">WhatsApp Order</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Address</label>
              <input value={form.customerAddress} onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} placeholder="Delivery address" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Items</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)} className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} placeholder="Name" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} placeholder="₹" className="w-20 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" className="w-14 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <button onClick={() => removeItem(i)}><X className="w-4 h-4 text-red-400" /></button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-xs text-[#FA5600] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>

          <div className="bg-orange-50 rounded-xl p-3 text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Total</p>
            <p className="text-2xl font-black text-[#FA5600]">{fmt(form.items.reduce((s, i) => s + (parseFloat(i.price || '0') * parseInt(i.quantity || '1')), 0))}</p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Save Sale</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : sales.length === 0 ? (
        <EmptyState icon="🛒" text="No sales recorded for this period" />
      ) : (
        <div className="space-y-3">
          {sales.map(sale => (
            <div key={sale._id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-sm text-gray-900">{sale.customerName || 'Walk-in'}</p>
                  <p className="text-xs text-gray-400">{sale.saleNumber} · {sale.customerPhone}</p>
                  <p className="text-xs text-gray-400">{new Date(sale.date).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-lg text-[#FA5600]">{fmt(sale.totalAmount)}</p>
                  <StatusBadge status={sale.status} />
                </div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {sale.status === 'pending' && (
                  <button onClick={() => updateStatus(sale._id, 'confirmed')} className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-full hover:bg-green-600 transition">✓ Confirm</button>
                )}
                {sale.status !== 'cancelled' && (
                  <button onClick={() => updateStatus(sale._id, 'cancelled')} className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full hover:bg-gray-200 transition">Cancel</button>
                )}
                <button onClick={() => deleteSale(sale._id)} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1 rounded-full hover:bg-red-100 transition ml-auto">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
function PurchaseOrdersModule({ showMsg }: any) {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ supplierName: '', supplierContact: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] });

  const fetchPOs = () => { setLoading(true); fetch('/api/purchase-orders').then(r => r.json()).then(data => setPos(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { fetchPOs(); fetch('/api/products').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : [])).catch(() => {}); }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: string, value: string) => {
    setForm(f => {
      const items = [...f.items]; items[i] = { ...items[i], [field]: value };
      if (field === 'productId') { const p = products.find(p => p._id === value); if (p) { items[i].productName = p.name; items[i].sku = p.sku || ''; } }
      return { ...f, items };
    });
  };

  const handleCreate = async () => {
    const validItems = form.items.filter(i => i.productName && i.quantity && i.costPrice);
    if (validItems.length === 0) { showMsg('Add at least one item with cost price.', 'error'); return; }
    const payload = {
      supplier: { name: form.supplierName, contact: form.supplierContact },
      items: validItems.map(i => ({ productId: i.productId, productName: i.productName, sku: i.sku, quantity: parseInt(i.quantity), costPrice: parseFloat(i.costPrice) })),
      notes: form.notes, expectedDate: form.expectedDate,
    };
    const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { showMsg(`✅ ${data.poNumber} created!`, 'success'); setShowForm(false); setForm({ supplierName: '', supplierContact: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] }); fetchPOs(); }
    else showMsg(data.error || 'Failed.', 'error');
  };

  const handleAction = async (id: string, action: string) => {
    const res = await fetch('/api/purchase-orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    const data = await res.json();
    const msgs: any = { order: 'PO marked as ordered!', receive: '✅ Stock received & inventory updated!', cancel: 'PO cancelled.' };
    if (data.success) { showMsg(msgs[action] || 'Updated!', 'success'); fetchPOs(); }
    else showMsg(data.error || 'Failed.', 'error');
  };

  const deletePO = async (id: string) => {
    if (!confirm('Delete this draft PO?')) return;
    await fetch('/api/purchase-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('PO deleted.', 'success'); fetchPOs();
  };

  const poStatusColor: any = { draft: 'bg-gray-100 text-gray-600', ordered: 'bg-blue-100 text-blue-700', received: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 font-bold">{pos.length} purchase orders</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition">
          <Plus className="w-4 h-4" /> New PO
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-4">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">New Purchase Order</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Supplier Name</label>
              <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="Supplier" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Contact</label>
              <input value={form.supplierContact} onChange={e => setForm(f => ({ ...f, supplierContact: e.target.value }))} placeholder="Phone" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Expected Date</label>
              <input type="date" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Items *</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)} className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} placeholder="Name" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" className="w-14 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.costPrice} onChange={e => updateItem(i, 'costPrice', e.target.value)} placeholder="Cost ₹" className="w-20 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <button onClick={() => removeItem(i)}><X className="w-4 h-4 text-red-400" /></button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-xs text-[#FA5600] font-black uppercase tracking-widest flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> Add Item</button>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Total Cost</p>
            <p className="text-2xl font-black text-[#FA5600]">{fmt(form.items.reduce((s, i) => s + (parseFloat(i.costPrice || '0') * parseInt(i.quantity || '1')), 0))}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Create PO</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : pos.length === 0 ? <EmptyState icon="📦" text="No purchase orders yet" /> : (
        <div className="space-y-3">
          {pos.map(po => (
            <div key={po._id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-black text-sm text-gray-900">{po.poNumber}</p>
                  <p className="text-xs text-gray-400">{po.supplier?.name || 'No supplier'} · {po.items?.length} items</p>
                  <p className="text-xs text-gray-400">{new Date(po.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-[#FA5600]">{fmt(po.totalAmount)}</p>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${poStatusColor[po.status] || 'bg-gray-100 text-gray-600'}`}>{po.status}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {po.status === 'draft' && (<><button onClick={() => handleAction(po._id, 'order')} className="text-xs bg-blue-500 text-white font-bold px-3 py-1 rounded-full hover:bg-blue-600 transition">Mark Ordered</button><button onClick={() => deletePO(po._id)} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1 rounded-full hover:bg-red-100 transition">Delete</button></>)}
                {po.status === 'ordered' && (<><button onClick={() => handleAction(po._id, 'receive')} className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-full hover:bg-green-600 transition">✓ Receive Stock</button><button onClick={() => handleAction(po._id, 'cancel')} className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full hover:bg-gray-200 transition">Cancel</button></>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CASHFLOW ────────────────────────────────────────────────────────────────
function CashflowModule({ showMsg }: any) {
  const [data, setData] = useState<any>({ entries: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'income', category: '', amount: '', description: '', date: '', paymentMode: 'cash' });

  const fetchData = () => { setLoading(true); fetch(`/api/business?module=cashflow&period=${period}`).then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { fetchData(); }, [period]);

  const handleSubmit = async () => {
    if (!form.amount || !form.category) { showMsg('Category and amount required.', 'error'); return; }
    const res = await fetch('/api/business?module=cashflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (d.success) { showMsg('✅ Entry added!', 'success'); setShowForm(false); setForm({ type: 'income', category: '', amount: '', description: '', date: '', paymentMode: 'cash' }); fetchData(); }
    else showMsg(d.error || 'Failed.', 'error');
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch('/api/business?module=cashflow', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Entry deleted.', 'success'); fetchData();
  };

  const { income = 0, expense = 0, profit = 0 } = data.summary || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center"><p className="text-lg font-black text-green-700">{fmt(income)}</p><p className="text-[10px] font-bold text-green-600 uppercase">Income</p></div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center"><p className="text-lg font-black text-red-700">{fmt(expense)}</p><p className="text-[10px] font-bold text-red-600 uppercase">Expenses</p></div>
        <div className={`rounded-xl border p-3 text-center ${profit >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}><p className={`text-lg font-black ${profit >= 0 ? 'text-[#FA5600]' : 'text-red-700'}`}>{fmt(profit)}</p><p className="text-[10px] font-bold text-gray-500 uppercase">Net Profit</p></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
          <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="year">This Year</option>
        </select>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition ml-auto">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">New Cash Entry</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white"><option value="income">Income</option><option value="expense">Expense</option></select>
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="₹ 0" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Category *</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Sales, Rent" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="col-span-2"><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Add Entry</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={4} /> : data.entries?.length === 0 ? <EmptyState icon="💰" text="No cash flow entries for this period" /> : (
        <div className="space-y-2">
          {data.entries?.map((entry: any) => (
            <div key={entry._id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${entry.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                {entry.type === 'income' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{entry.description || entry.category}</p>
                <p className="text-[10px] text-gray-400">{entry.category} · {new Date(entry.date).toLocaleDateString('en-IN')}</p>
              </div>
              <p className={`font-black text-sm shrink-0 ${entry.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{entry.type === 'income' ? '+' : '-'}{fmt(entry.amount)}</p>
              <button onClick={() => deleteEntry(entry._id)} className="text-gray-300 hover:text-red-400 transition shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────
function ExpensesModule({ showMsg }: any) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: '', amount: '', description: '', date: '', paymentMode: 'cash' });
  const CATS = ['Rent', 'Salaries', 'Purchase', 'Utilities', 'Marketing', 'Transport', 'Maintenance', 'Packaging', 'Other'];

  const fetchExpenses = () => { setLoading(true); fetch('/api/business?module=expenses').then(r => r.json()).then(data => setExpenses(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { fetchExpenses(); }, []);

  const handleSubmit = async () => {
    if (!form.category || !form.amount) { showMsg('Category and amount required.', 'error'); return; }
    const res = await fetch('/api/business?module=expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.success) { showMsg('✅ Expense added!', 'success'); setShowForm(false); setForm({ category: '', amount: '', description: '', date: '', paymentMode: 'cash' }); fetchExpenses(); }
    else showMsg(data.error || 'Failed.', 'error');
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await fetch('/api/business?module=expenses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Expense deleted.', 'success'); fetchExpenses();
  };

  return (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex justify-between items-center">
        <div><p className="text-2xl font-black text-red-700">{fmt(expenses.reduce((s, e) => s + e.amount, 0))}</p><p className="text-xs font-bold text-red-500 uppercase tracking-widest">Total Expenses</p></div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition"><Plus className="w-4 h-4" /> Add</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Add Expense</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white"><option value="">Select</option>{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="₹ 0" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option><option value="card">Card</option></select>
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="col-span-2"><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this for?" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Save Expense</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : expenses.length === 0 ? <EmptyState icon="🧾" text="No expenses recorded" /> : (
        <div className="space-y-2">
          {expenses.map(exp => (
            <div key={exp._id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0"><TrendingDown className="w-4 h-4 text-red-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{exp.description || exp.category}</p>
                <p className="text-[10px] text-gray-400">{exp.category} · {exp.paymentMode} · {new Date(exp.date).toLocaleDateString('en-IN')}</p>
              </div>
              <p className="font-black text-sm text-red-600 shrink-0">-{fmt(exp.amount)}</p>
              <button onClick={() => deleteExpense(exp._id)} className="text-gray-300 hover:text-red-400 transition shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
function SuppliersModule({ showMsg }: any) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', gstin: '', notes: '' });

  const fetchSuppliers = () => { setLoading(true); fetch('/api/business?module=suppliers').then(r => r.json()).then(data => setSuppliers(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { fetchSuppliers(); }, []);

  const handleSubmit = async () => {
    if (!form.name) { showMsg('Name required.', 'error'); return; }
    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...form } : form;
    const res = await fetch('/api/business?module=suppliers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { showMsg(editId ? '✅ Updated!' : '✅ Added!', 'success'); setShowForm(false); setEditId(null); setForm({ name: '', phone: '', email: '', address: '', gstin: '', notes: '' }); fetchSuppliers(); }
    else showMsg(data.error || 'Failed.', 'error');
  };

  const startEdit = (s: any) => { setEditId(s._id); setForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, gstin: s.gstin, notes: s.notes }); setShowForm(true); };

  const deleteSupplier = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    await fetch('/api/business?module=suppliers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Deleted.', 'success'); fetchSuppliers();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 font-bold">{suppliers.length} suppliers</p>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', phone: '', email: '', address: '', gstin: '', notes: '' }); }}
          className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">{editId ? 'Edit' : 'New'} Supplier</h3>
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'Name *', key: 'name', placeholder: 'Supplier name' }, { label: 'Phone', key: 'phone', placeholder: '+91...' }, { label: 'Email', key: 'email', placeholder: 'email@...' }, { label: 'GSTIN', key: 'gstin', placeholder: 'GST number' }].map(f => (
              <div key={f.key}><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
            ))}
            <div className="col-span-2"><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">{editId ? 'Update' : 'Add'}</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : suppliers.length === 0 ? <EmptyState icon="👥" text="No suppliers yet" /> : (
        <div className="space-y-3">
          {suppliers.map(s => (
            <div key={s._id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 font-black text-[#FA5600] text-lg">{s.name[0].toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-gray-900">{s.name}</p>
                {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                {s.gstin && <p className="text-xs text-gray-400">GST: {s.gstin}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(s)} className="text-blue-400 hover:text-blue-600 text-xs font-bold uppercase transition">Edit</button>
                <button onClick={() => deleteSupplier(s._id)} className="text-red-400 hover:text-red-600 text-xs font-bold uppercase transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
function ReportsModule({ showMsg }: any) {
  const [reportType, setReportType] = useState<ReportType>('stock-shortage');
  const [data, setData] = useState<any[]>([]);
  const [pnl, setPnl] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = () => {
    setLoading(true); setData([]); setPnl(null);
    fetch(`/api/business?module=reports&type=${reportType}`)
      .then(r => r.json()).then(d => { if (reportType === 'pnl') setPnl(d); else setData(Array.isArray(d) ? d : d.items || []); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchReport(); }, [reportType]);

  const reports = [
    { id: 'stock-shortage', label: '🚨 Stock Shortage', desc: 'Items below reorder level' },
    { id: 'low-performing', label: '📉 Low Performing', desc: 'Least sold products' },
    { id: 'best-selling', label: '🏆 Best Selling', desc: 'Top sold products' },
    { id: 'profit-margin', label: '💰 Profit Margin', desc: 'Margin per product' },
    { id: 'pnl', label: '📊 P&L Summary', desc: 'Profit & Loss statement' },
    { id: 'stock-valuation', label: '📦 Stock Valuation', desc: 'Total inventory value' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {reports.map(r => (
          <button key={r.id} onClick={() => setReportType(r.id as ReportType)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${reportType === r.id ? 'border-[#FA5600] bg-orange-50' : 'border-gray-200 bg-white hover:border-[#FA5600]/50'}`}>
            <p className="text-xs font-black text-gray-900">{r.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {loading && <LoadingCards count={4} />}

      {!loading && reportType === 'pnl' && pnl && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center"><p className="text-xl font-black text-green-700">{fmt(pnl.income)}</p><p className="text-[10px] font-bold text-green-600 uppercase">Income</p></div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center"><p className="text-xl font-black text-red-700">{fmt(pnl.expenses)}</p><p className="text-[10px] font-bold text-red-600 uppercase">Expenses</p></div>
            <div className={`rounded-xl border p-4 text-center ${pnl.profit >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}><p className={`text-xl font-black ${pnl.profit >= 0 ? 'text-[#FA5600]' : 'text-red-700'}`}>{fmt(pnl.profit)}</p><p className="text-[10px] font-bold text-gray-500 uppercase">Profit ({pnl.profitMargin}%)</p></div>
          </div>
          {pnl.breakdown && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">By Category</h4>
              <div className="space-y-2">
                {pnl.breakdown.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between items-center">
                    <div><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full mr-2 ${b.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{b.type}</span><span className="text-sm font-bold text-gray-700">{b.category}</span></div>
                    <span className={`font-black text-sm ${b.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{fmt(b.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && reportType === 'stock-shortage' && (
        data.length === 0 ? <EmptyState icon="✅" text="All stock levels healthy!" /> :
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${item.isOutOfStock ? 'border-red-300' : 'border-yellow-200'}`}>
              {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0"><p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p><p className="text-xs text-gray-400">{item.category}</p></div>
              <div className="text-right shrink-0"><p className={`font-black text-sm ${item.isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`}>{item.availableStock} left</p><p className="text-[10px] text-gray-400">Need {item.reorderNeeded} more</p></div>
            </div>
          ))}
        </div>
      )}

      {!loading && (reportType === 'best-selling' || reportType === 'low-performing') && (
        data.length === 0 ? <EmptyState icon="📊" text="No sales data yet" /> :
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <span className="text-lg font-black text-gray-300 w-6 shrink-0">{i + 1}</span>
              {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0"><p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p><p className="text-xs text-gray-400">{item.category}</p></div>
              <div className="text-right shrink-0"><p className="font-black text-sm text-[#FA5600]">{item.totalSold} sold</p><p className="text-xs text-gray-400">{fmt(item.price)}</p></div>
            </div>
          ))}
        </div>
      )}

      {!loading && reportType === 'profit-margin' && (
        data.length === 0 ? <EmptyState icon="💰" text="Set cost prices in inventory to see margins" /> :
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0"><p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p><p className="text-xs text-gray-400">Cost: {fmt(item.costPrice)} · Sell: {fmt(item.sellingPrice)}</p></div>
              <div className="text-right shrink-0"><p className={`font-black text-sm ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(item.margin)}</p>{item.marginPct !== null && <p className="text-[10px] text-gray-400">{item.marginPct}% margin</p>}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && reportType === 'stock-valuation' && data.length > 0 && (
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0"><p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p><p className="text-xs text-gray-400">{item.category} · {item.currentStock} {item.unit}</p></div>
              <div className="text-right shrink-0"><p className="font-black text-sm text-[#FA5600]">{fmt(item.costValue)}</p><p className="text-[10px] text-gray-400">Retail: {fmt(item.retailValue)}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
function LoadingCards({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex gap-3"><div className="w-10 h-10 bg-gray-200 rounded-lg shrink-0" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-1/2" /><div className="h-3 bg-gray-200 rounded w-1/3" /></div></div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-gray-400 font-bold text-sm">{text}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: any = { pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600', delivered: 'bg-blue-100 text-blue-700' };
  return <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

export default BusinessEmbed;
