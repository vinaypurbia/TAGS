import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  AlertTriangle, BarChart2, Users, FileText, Plus, Trash2,
  ChevronRight, ArrowLeft, Check, X, Search, Download
} from 'lucide-react';

type Module = 'dashboard' | 'sales' | 'purchase-orders' | 'cashflow' | 'expenses' | 'suppliers' | 'reports';
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

  return (
    <div className="space-y-4">
      {message.text && (
        <div className={`p-3 rounded-xl text-center font-semibold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Module tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
          { id: 'sales', label: 'Sales', icon: ShoppingCart },
          { id: 'purchase-orders', label: 'Purchase Orders', icon: Package },
          { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
          { id: 'expenses', label: 'Expenses', icon: TrendingDown },
          { id: 'suppliers', label: 'Suppliers', icon: Users },
          { id: 'reports', label: 'Reports', icon: FileText },
        ].map(tab => (
          <button key={tab.id} onClick={() => setModule(tab.id as Module)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${module === tab.id ? 'bg-[#FA5600] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#FA5600] hover:text-[#FA5600]'}`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {module === 'dashboard' && <DashboardModule showMsg={showMsg} />}
      {module === 'sales' && <SalesModule showMsg={showMsg} />}
      {module === 'purchase-orders' && <PurchaseOrdersModule showMsg={showMsg} />}
      {module === 'cashflow' && <CashflowModule showMsg={showMsg} />}
      {module === 'expenses' && <ExpensesModule showMsg={showMsg} />}
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
    ]).then(([salesData, cashData, shortageData]) => {
      setStats({ sales: salesData.summary, cash: cashData.summary });
      setShortage(Array.isArray(shortageData) ? shortageData.slice(0, 5) : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingCards count={4} />;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Revenue (Month)', value: fmt(stats?.sales?.totalRevenue || 0), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Orders (Month)', value: fmtQty(stats?.sales?.totalOrders || 0), icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
          { label: 'Expenses (Month)', value: fmt(stats?.cash?.expense || 0), icon: TrendingDown, color: 'text-red-600 bg-red-50' },
          { label: 'Profit (Month)', value: fmt(stats?.cash?.profit || 0), icon: DollarSign, color: 'text-[#FA5600] bg-orange-50' },
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

      {/* Low Stock Alerts */}
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
                  <p className={`text-sm font-black ${item.isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`}>
                    {item.availableStock} left
                  </p>
                  <p className="text-[10px] text-gray-400">alert at {item.lowStockAlert}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shortage.length === 0 && !loading && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-sm font-bold text-green-700">All stock levels are healthy!</p>
        </div>
      )}
    </div>
  );
}

// ─── SALES ───────────────────────────────────────────────────────────────────
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
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSales(); }, [period]);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', price: '', quantity: '1' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateItem = (i: number, field: string, value: string) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      if (field === 'productId') {
        const product = products.find(p => p._id === value);
        if (product) {
          items[i].productName = product.name;
          items[i].price = String(product.discountedPrice || product.price || '');
        }
      }
      return { ...f, items };
    });
  };

  const handleSubmit = async () => {
    if (!form.customerName || !form.customerPhone) { showMsg('Customer name and phone required.', 'error'); return; }
    const validItems = form.items.filter(i => i.productName && i.price && i.quantity);
    if (validItems.length === 0) { showMsg('Add at least one item.', 'error'); return; }

    const payload = {
      ...form,
      items: validItems.map(i => ({
        productId: i.productId,
        productName: i.productName,
        price: parseFloat(i.price),
        quantity: parseInt(i.quantity),
      }))
    };

    const res = await fetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) {
      showMsg(`✅ Sale ${data.saleNumber} recorded!`, 'success');
      setShowForm(false);
      setForm({ customerName: '', customerPhone: '', customerAddress: '', notes: '', paymentMode: 'cash', items: [{ productId: '', productName: '', price: '', quantity: '1' }] });
      fetchSales();
    } else {
      showMsg(data.error || 'Failed to record sale.', 'error');
    }
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
      {/* Summary */}
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

      {/* Controls */}
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

      {/* Add Sale Form */}
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

          {/* Items */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Items</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)} className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <input type="text" value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} placeholder="Name" className="w-28 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} placeholder="₹ Price" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" className="w-16 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 transition"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-xs text-[#FA5600] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>

          {/* Total Preview */}
          <div className="bg-orange-50 rounded-xl p-3 text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Total</p>
            <p className="text-2xl font-black text-[#FA5600]">
              {fmt(form.items.reduce((s, i) => s + (parseFloat(i.price || '0') * parseInt(i.quantity || '1')), 0))}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">
              Save Sale
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sales List */}
      {loading ? <LoadingCards count={3} /> : sales.length === 0 ? (
        <EmptyState icon="🛒" text="No sales recorded for this period" />
      ) : (
        <div className="space-y-3">
          {sales.map(sale => (
            <div key={sale._id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-sm text-gray-900">{sale.customerName || 'Walk-in Customer'}</p>
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
                  <button onClick={() => updateStatus(sale._id, 'confirmed')} className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-full hover:bg-green-600 transition">
                    ✓ Confirm
                  </button>
                )}
                {sale.status !== 'cancelled' && (
                  <button onClick={() => updateStatus(sale._id, 'cancelled')} className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full hover:bg-gray-200 transition">
                    Cancel
                  </button>
                )}
                <button onClick={() => deleteSale(sale._id)} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1 rounded-full hover:bg-red-100 transition ml-auto">
                  Delete
                </button>
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
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState({ supplierName: '', supplierContact: '', supplierEmail: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] });

  const fetchPOs = () => {
    setLoading(true);
    fetch('/api/purchase-orders').then(r => r.json()).then(data => setPos(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPOs();
    fetch('/api/products').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
    fetch('/api/business?module=suppliers').then(r => r.json()).then(data => setSuppliers(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateItem = (i: number, field: string, value: string) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      if (field === 'productId') {
        const p = products.find(p => p._id === value);
        if (p) { items[i].productName = p.name; items[i].sku = p.sku || ''; }
      }
      return { ...f, items };
    });
  };

  const handleCreate = async () => {
    const validItems = form.items.filter(i => i.productName && i.quantity && i.costPrice);
    if (validItems.length === 0) { showMsg('Add at least one item with cost price.', 'error'); return; }

    const payload = {
      supplier: { name: form.supplierName, contact: form.supplierContact, email: form.supplierEmail },
      items: validItems.map(i => ({ productId: i.productId, productName: i.productName, sku: i.sku, quantity: parseInt(i.quantity), costPrice: parseFloat(i.costPrice) })),
      notes: form.notes,
      expectedDate: form.expectedDate,
    };

    const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) {
      showMsg(`✅ ${data.poNumber} created!`, 'success');
      setShowForm(false);
      setForm({ supplierName: '', supplierContact: '', supplierEmail: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] });
      fetchPOs();
    } else {
      showMsg(data.error || 'Failed to create PO.', 'error');
    }
  };

  const handleAction = async (id: string, action: string) => {
    const res = await fetch('/api/purchase-orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    const data = await res.json();
    if (data.success) {
      const msgs: any = { order: 'PO marked as ordered!', receive: '✅ Stock received & inventory updated!', cancel: 'PO cancelled.' };
      showMsg(msgs[action] || 'Updated!', 'success');
      fetchPOs();
    } else {
      showMsg(data.error || 'Failed.', 'error');
    }
  };

  const deletePO = async (id: string) => {
    if (!confirm('Delete this draft PO?')) return;
    await fetch('/api/purchase-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('PO deleted.', 'success');
    fetchPOs();
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
              <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="Supplier name" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
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
                  <input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} placeholder="Name" className="w-28 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" className="w-16 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <input type="number" value={item.costPrice} onChange={e => updateItem(i, 'costPrice', e.target.value)} placeholder="Cost ₹" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                  <button onClick={() => removeItem(i)}><X className="w-4 h-4 text-red-400" /></button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-xs text-[#FA5600] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>

          <div className="bg-orange-50 rounded-xl p-3 text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Total Cost</p>
            <p className="text-2xl font-black text-[#FA5600]">
              {fmt(form.items.reduce((s, i) => s + (parseFloat(i.costPrice || '0') * parseInt(i.quantity || '1')), 0))}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Create PO</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : pos.length === 0 ? (
        <EmptyState icon="📦" text="No purchase orders yet" />
      ) : (
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
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${poStatusColor[po.status] || 'bg-gray-100 text-gray-600'}`}>
                    {po.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {po.status === 'draft' && (
                  <>
                    <button onClick={() => handleAction(po._id, 'order')} className="text-xs bg-blue-500 text-white font-bold px-3 py-1 rounded-full hover:bg-blue-600 transition">Mark Ordered</button>
                    <button onClick={() => deletePO(po._id)} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1 rounded-full hover:bg-red-100 transition">Delete</button>
                  </>
                )}
                {po.status === 'ordered' && (
                  <>
                    <button onClick={() => handleAction(po._id, 'receive')} className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-full hover:bg-green-600 transition">✓ Receive Stock</button>
                    <button onClick={() => handleAction(po._id, 'cancel')} className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full hover:bg-gray-200 transition">Cancel</button>
                  </>
                )}
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
  const [form, setForm] = useState({ type: 'income', category: '', amount: '', description: '', date: '', paymentMode: 'cash', notes: '' });

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/business?module=cashflow&period=${period}`)
      .then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [period]);

  const handleSubmit = async () => {
    if (!form.amount || !form.category) { showMsg('Category and amount required.', 'error'); return; }
    const res = await fetch('/api/business?module=cashflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (d.success) { showMsg('✅ Entry added!', 'success'); setShowForm(false); setForm({ type: 'income', category: '', amount: '', description: '', date: '', paymentMode: 'cash', notes: '' }); fetchData(); }
    else showMsg(d.error || 'Failed.', 'error');
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch('/api/business?module=cashflow', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Entry deleted.', 'success');
    fetchData();
  };

  const { income = 0, expense = 0, profit = 0 } = data.summary || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center">
          <p className="text-lg font-black text-green-700">{fmt(income)}</p>
          <p className="text-[10px] font-bold text-green-600 uppercase">Income</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center">
          <p className="text-lg font-black text-red-700">{fmt(expense)}</p>
          <p className="text-[10px] font-bold text-red-600 uppercase">Expenses</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${profit >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-lg font-black ${profit >= 0 ? 'text-[#FA5600]' : 'text-red-700'}`}>{fmt(profit)}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase">Net Profit</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition ml-auto">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">New Cash Entry</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="₹ 0" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Category *</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Sales, Rent, Purchase" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Add Entry</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={4} /> : data.entries?.length === 0 ? (
        <EmptyState icon="💰" text="No cash flow entries for this period" />
      ) : (
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
              <p className={`font-black text-sm shrink-0 ${entry.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                {entry.type === 'income' ? '+' : '-'}{fmt(entry.amount)}
              </p>
              <button onClick={() => deleteEntry(entry._id)} className="text-gray-300 hover:text-red-400 transition shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
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
  const [form, setForm] = useState({ category: '', amount: '', description: '', date: '', paymentMode: 'cash', notes: '' });

  const EXPENSE_CATEGORIES = ['Rent', 'Salaries', 'Purchase', 'Utilities', 'Marketing', 'Transport', 'Maintenance', 'Packaging', 'Other'];

  const fetchExpenses = () => {
    setLoading(true);
    fetch('/api/business?module=expenses').then(r => r.json()).then(data => setExpenses(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleSubmit = async () => {
    if (!form.category || !form.amount) { showMsg('Category and amount required.', 'error'); return; }
    const res = await fetch('/api/business?module=expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.success) { showMsg('✅ Expense added!', 'success'); setShowForm(false); setForm({ category: '', amount: '', description: '', date: '', paymentMode: 'cash', notes: '' }); fetchExpenses(); }
    else showMsg(data.error || 'Failed.', 'error');
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await fetch('/api/business?module=expenses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Expense deleted.', 'success');
    fetchExpenses();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex justify-between items-center">
        <div>
          <p className="text-2xl font-black text-red-700">{fmt(total)}</p>
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Total Expenses</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Add Expense</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="">Select</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="₹ 0" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Save Expense</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : expenses.length === 0 ? (
        <EmptyState icon="🧾" text="No expenses recorded" />
      ) : (
        <div className="space-y-2">
          {expenses.map(exp => (
            <div key={exp._id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{exp.description || exp.category}</p>
                <p className="text-[10px] text-gray-400">{exp.category} · {exp.paymentMode} · {new Date(exp.date).toLocaleDateString('en-IN')}</p>
              </div>
              <p className="font-black text-sm text-red-600 shrink-0">-{fmt(exp.amount)}</p>
              <button onClick={() => deleteExpense(exp._id)} className="text-gray-300 hover:text-red-400 transition shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
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

  const fetchSuppliers = () => {
    setLoading(true);
    fetch('/api/business?module=suppliers').then(r => r.json()).then(data => setSuppliers(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const handleSubmit = async () => {
    if (!form.name) { showMsg('Supplier name required.', 'error'); return; }
    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...form } : form;
    const res = await fetch('/api/business?module=suppliers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
      showMsg(editId ? '✅ Supplier updated!' : '✅ Supplier added!', 'success');
      setShowForm(false); setEditId(null);
      setForm({ name: '', phone: '', email: '', address: '', gstin: '', notes: '' });
      fetchSuppliers();
    } else showMsg(data.error || 'Failed.', 'error');
  };

  const startEdit = (s: any) => { setEditId(s._id); setForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, gstin: s.gstin, notes: s.notes }); setShowForm(true); };

  const deleteSupplier = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    await fetch('/api/business?module=suppliers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('Supplier deleted.', 'success');
    fetchSuppliers();
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
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">{editId ? 'Edit Supplier' : 'New Supplier'}</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Name *', key: 'name', placeholder: 'Supplier name' },
              { label: 'Phone', key: 'phone', placeholder: '+91 00000 00000' },
              { label: 'Email', key: 'email', placeholder: 'email@example.com' },
              { label: 'GSTIN', key: 'gstin', placeholder: 'GST number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">{editId ? 'Update' : 'Add Supplier'}</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : suppliers.length === 0 ? (
        <EmptyState icon="👥" text="No suppliers yet" />
      ) : (
        <div className="space-y-3">
          {suppliers.map(s => (
            <div key={s._id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 font-black text-[#FA5600] text-lg">
                {s.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-gray-900">{s.name}</p>
                {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
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
    setLoading(true);
    setData([]); setPnl(null);
    const url = reportType === 'pnl'
      ? `/api/business?module=reports&type=pnl`
      : `/api/business?module=reports&type=${reportType}`;

    fetch(url).then(r => r.json()).then(d => {
      if (reportType === 'pnl') setPnl(d);
      else setData(Array.isArray(d) ? d : d.items || []);
    }).catch(() => {}).finally(() => setLoading(false));
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
      {/* Report selector */}
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

      {/* P&L Report */}
      {!loading && reportType === 'pnl' && pnl && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
              <p className="text-xl font-black text-green-700">{fmt(pnl.income)}</p>
              <p className="text-[10px] font-bold text-green-600 uppercase">Total Income</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
              <p className="text-xl font-black text-red-700">{fmt(pnl.expenses)}</p>
              <p className="text-[10px] font-bold text-red-600 uppercase">Total Expenses</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${pnl.profit >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xl font-black ${pnl.profit >= 0 ? 'text-[#FA5600]' : 'text-red-700'}`}>{fmt(pnl.profit)}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase">Net Profit ({pnl.profitMargin}%)</p>
            </div>
          </div>
          {pnl.breakdown && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Breakdown by Category</h4>
              <div className="space-y-2">
                {pnl.breakdown.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full mr-2 ${b.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{b.type}</span>
                      <span className="text-sm font-bold text-gray-700">{b.category}</span>
                    </div>
                    <span className={`font-black text-sm ${b.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{fmt(b.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stock Shortage */}
      {!loading && reportType === 'stock-shortage' && (
        data.length === 0 ? <EmptyState icon="✅" text="All stock levels are healthy!" /> :
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${item.isOutOfStock ? 'border-red-300' : 'border-yellow-200'}`}>
              {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.category} {item.sku ? `· SKU: ${item.sku}` : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-sm ${item.isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`}>
                  {item.availableStock} left
                </p>
                <p className="text-[10px] text-gray-400">Need {item.reorderNeeded} more</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Best/Low Performing */}
      {!loading && (reportType === 'best-selling' || reportType === 'low-performing') && (
        data.length === 0 ? <EmptyState icon="📊" text="No sales data yet" /> :
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <span className="text-lg font-black text-gray-300 w-6 shrink-0">{i + 1}</span>
              {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.category}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-sm text-[#FA5600]">{item.totalSold} sold</p>
                <p className="text-xs text-gray-400">{fmt(item.price)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profit Margin */}
      {!loading && reportType === 'profit-margin' && (
        data.length === 0 ? <EmptyState icon="💰" text="Set cost prices in inventory to see margins" /> :
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p>
                <p className="text-xs text-gray-400">Cost: {fmt(item.costPrice)} · Sell: {fmt(item.sellingPrice)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-sm ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(item.margin)}</p>
                {item.marginPct !== null && <p className="text-[10px] text-gray-400">{item.marginPct}% margin</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stock Valuation */}
      {!loading && reportType === 'stock-valuation' && pnl === null && data.length > 0 && (
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.category} · {item.currentStock} {item.unit}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-sm text-[#FA5600]">{fmt(item.costValue)}</p>
                <p className="text-[10px] text-gray-400">Retail: {fmt(item.retailValue)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function LoadingCards({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
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
  const colors: any = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    delivered: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default BusinessEmbed;
