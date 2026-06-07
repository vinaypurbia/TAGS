import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  AlertTriangle, BarChart2, Users, FileText, Plus, Trash2,
  Check, X, Search, Phone, Mail, MapPin, ChevronDown, ChevronUp, BookOpen,
  Edit2, UserX, UserCheck, Eye, EyeOff, Truck
} from 'lucide-react';
import { useAuth, authHeaders } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';

type Module = 'dashboard' | 'orders' | 'sales' | 'purchase-orders' | 'cashflow' | 'expenses' | 'suppliers' | 'customers' | 'reports' | 'users' | 'financing' | 'ledger' | 'regenerate';
type ReportType = 'stock-shortage' | 'low-performing' | 'best-selling' | 'profit-margin' | 'pnl' | 'stock-valuation';

// ─── DUPLICATE DETECTION ─────────────────────────────────────────────────────
const DUPLICATE_WINDOW_MS = 10000; // 10 seconds
const recentActions = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const last = recentActions.get(key);
  if (!last) return false;
  return Date.now() - last < DUPLICATE_WINDOW_MS;
}

function recordAction(key: string) {
  recentActions.set(key, Date.now());
}

let _setDupModal: ((s: DupModalState) => void) | null = null;

interface DupModalState {
  open: boolean;
  message: string;
  onConfirm: () => void;
}

function withDupCheck(key: string, label: string, action: () => void) {
  if (isDuplicate(key)) {
    _setDupModal?.({
      open: true,
      message: `A "${label}" was just submitted a few seconds ago. Are you sure you want to submit again?`,
      onConfirm: () => { recordAction(key); action(); },
    });
  } else {
    recordAction(key);
    action();
  }
}

function DuplicateModal() {
  const [state, setState] = useState<DupModalState>({ open: false, message: '', onConfirm: () => {} });
  _setDupModal = setState;
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <p className="font-black text-sm text-gray-900 uppercase tracking-widest">Duplicate Entry Detected</p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setState(s => ({ ...s, open: false }))}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-black text-gray-600 hover:border-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { setState(s => ({ ...s, open: false })); state.onConfirm(); }}
            className="flex-1 py-3 rounded-xl bg-[#FA5600] text-white text-sm font-black uppercase tracking-widest hover:bg-[#E04A00] transition"
          >
            Yes, Submit
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n: number) => Number(n || 0).toLocaleString('en-IN');

// ─── SHARED: Searchable product row (Sales & PO) ──────────────────────────────
function ProductSearchRow({ item, index, products, onUpdate, onRemove, showCost }: {
  item: any; index: number; products: any[];
  onUpdate: (i: number, field: string, value: string) => void;
  onRemove: (i: number) => void;
  showCost?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="flex gap-2 items-start">
      <div className="relative flex-1">
        <input
          value={search !== '' ? search : item.productName}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search product..."
          className="w-full border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"
        />
        {open && (
          <div className="absolute z-30 left-0 right-0 bg-white border-2 border-[#FA5600] rounded-xl mt-1 shadow-xl max-h-48 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-gray-400 font-bold">No products found</p>
              : filtered.map(p => (
                <button key={p._id} type="button"
                  onMouseDown={() => { onUpdate(index, '__product__', JSON.stringify(p)); setSearch(''); setOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-100 last:border-0">
                  <p className="text-sm font-bold text-gray-800">{p.name}</p>
                  <p className="text-[10px] text-gray-400">{p.sku ? `SKU: ${p.sku} · ` : ''}{showCost ? `Cost: ₹${p.costPrice || '—'}` : `Price: ₹${p.discountedPrice || p.price || '—'}`}</p>
                </button>
              ))
            }
          </div>
        )}
      </div>
      <input type="number" value={item.quantity}
        onChange={e => onUpdate(index, 'quantity', e.target.value)}
        placeholder="Qty" min="1"
        className="w-14 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
      <input type="number" value={showCost ? item.costPrice : item.price}
        onChange={e => onUpdate(index, showCost ? 'costPrice' : 'price', e.target.value)}
        placeholder={showCost ? 'Cost ₹' : '₹'}
        className="w-20 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
      <button type="button" onClick={() => onRemove(index)} className="mt-2">
        <X className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}

// ─── SHARED: Supplier autocomplete ───────────────────────────────────────────
function SupplierSearchInput({ value, suppliers, onChange }: {
  value: string; suppliers: any[];
  onChange: (name: string, contact: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes((search || value).toLowerCase())
  );
  return (
    <div className="relative">
      <input
        value={search !== '' ? search : value}
        onChange={e => { setSearch(e.target.value); onChange(e.target.value, ''); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search or type supplier..."
        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 right-0 bg-white border-2 border-[#FA5600] rounded-xl mt-1 shadow-xl max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <button key={s._id} type="button"
              onMouseDown={() => { onChange(s.name, s.phone || ''); setSearch(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-100 last:border-0">
              <span className="text-[#FA5600] font-black mr-2">{(s.name || '?')[0].toUpperCase()}</span>
              <span className="text-sm font-bold text-gray-800">{s.name}</span>
              {s.phone && <span className="text-xs text-gray-400 ml-2">{s.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SHARED: Customer autocomplete ───────────────────────────────────────────
function CustomerSearchInput({ value, customers, onSelect, onChange, placeholder }: {
  value: string; customers: any[];
  onSelect: (name: string, phone: string) => void;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(value.toLowerCase()) ||
    c.phone?.includes(value)
  );
  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || 'Customer name'}
        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 right-0 bg-white border-2 border-[#FA5600] rounded-xl mt-1 shadow-xl max-h-40 overflow-y-auto">
          {filtered.map(c => (
            <button key={c._id} type="button"
              onMouseDown={() => { onSelect(c.name, c.phone || ''); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-100 last:border-0">
              <span className="text-sm font-bold text-gray-800">{c.name}</span>
              {c.phone && <span className="text-xs text-gray-400 ml-2">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
    { id: 'financing', label: 'Financing', icon: TrendingUp },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
    { id: 'ledger',    label: 'AP/AR Ledger', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'regenerate', label: '🔄 Regenerate', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <DuplicateModal />
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
      {module === 'financing' && <FinancingModule showMsg={showMsg} />}
      {module === 'customers' && <CustomersModule showMsg={showMsg} />}
      {module === 'suppliers' && <SuppliersModule showMsg={showMsg} />}
      {module === 'ledger'    && <LedgerModule showMsg={showMsg} />}
      {module === 'reports' && <ReportsModule showMsg={showMsg} />}
      {module === 'users' && <UsersModule showMsg={showMsg} />}
      {module === 'regenerate' && <RegenerateModule showMsg={showMsg} />}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function DashboardModule({ showMsg }: any) {
  const [stats, setStats] = useState<any>(null);
  const [shortage, setShortage] = useState<any[]>([]);
  const [showAllShortage, setShowAllShortage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/sales?period=month').then(r => r.json()),
      fetch('/api/business?module=cashflow&period=month').then(r => r.json()),
      fetch('/api/business?module=reports&type=stock-shortage').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ]).then(([salesData, cashData, shortageData, custData]) => {
      setStats({ sales: salesData.summary, cash: cashData.summary, customers: custData.summary });
      setShortage(Array.isArray(shortageData) ? shortageData : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingCards count={4} />;

  return (
    <div className="space-y-6">
      {/* ── TOP ROW: Revenue + Customers ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 text-green-600 bg-green-50"><TrendingUp className="w-4 h-4"/></div>
          <p className="text-xl font-black text-gray-900">{fmt(stats?.cash?.revenue || stats?.sales?.totalRevenue || 0)}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Revenue</p>
          <p className="text-[9px] text-gray-300">{stats?.sales?.totalOrders || 0} orders this month</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 text-purple-600 bg-purple-50"><Users className="w-4 h-4"/></div>
          <p className="text-xl font-black text-gray-900">{fmtQty(stats?.customers?.totalCustomers || 0)}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Customers</p>
          <p className="text-[9px] text-gray-300">{stats?.customers?.repeatCustomers || 0} repeat buyers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 text-blue-600 bg-blue-50"><ShoppingCart className="w-4 h-4"/></div>
          <p className="text-xl font-black text-gray-900">{fmt(stats?.cash?.cogs || 0)}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">COGS</p>
          <p className="text-[9px] text-gray-300">Cost of goods sold</p>
        </div>
      </div>

      {/* ── P&L WATERFALL: Gross Profit → Net Profit ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-700">Profit & Loss</h3>
          <span className="text-[9px] text-gray-400 uppercase tracking-widest">This Month</span>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { label: 'Revenue',              value: stats?.cash?.revenue || 0,          color: 'text-green-700',  bg: 'bg-green-50',   bold: false, indent: false },
            { label: '− Cost of Goods Sold', value: -(stats?.cash?.cogs || 0),          color: 'text-red-500',    bg: '',              bold: false, indent: true  },
            { label: 'Gross Profit',         value: stats?.cash?.grossProfit || 0,       color: (stats?.cash?.grossProfit||0)>=0?'text-emerald-700':'text-red-600', bg: 'bg-emerald-50', bold: true, indent: false },
            { label: '− Operating Expenses', value: -(stats?.cash?.operatingExpense||0), color: 'text-red-500',    bg: '',              bold: false, indent: true  },
            { label: 'Net Profit',           value: stats?.cash?.netProfit || stats?.cash?.profit || 0, color: (stats?.cash?.netProfit||0)>=0?'text-emerald-800':'text-red-700', bg: (stats?.cash?.netProfit||0)>=0?'bg-emerald-100':'bg-red-50', bold: true, indent: false },
          ].map(row => (
            <div key={row.label} className={`flex items-center justify-between px-5 py-2.5 ${row.bg}`}>
              <span className={`text-xs ${row.bold ? 'font-black uppercase tracking-widest' : 'font-semibold text-gray-500'} ${row.indent ? 'pl-4' : ''}`}>{row.label}</span>
              <span className={`text-sm font-black ${row.color}`}>{row.value < 0 ? `−${fmt(Math.abs(row.value))}` : fmt(row.value)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-2 bg-gray-50 flex justify-end gap-4">
          <span className="text-[9px] text-gray-400">Gross Margin: <strong>{stats?.cash?.grossMargin || 0}%</strong></span>
          <span className="text-[9px] text-gray-400">Net Margin: <strong>{stats?.cash?.netMargin || 0}%</strong></span>
        </div>
      </div>

      {/* ── CASH POSITION ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <div className="text-2xl">💵</div>
          <div>
            <p className="text-xl font-black text-gray-900">{fmt(stats?.cash?.cashInHand || 0)}</p>
            <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">Cash in Hand</p>
            <p className="text-[9px] text-gray-400">Cash & UPI transactions</p>
          </div>
        </div>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <div className="text-2xl">🏦</div>
          <div>
            <p className="text-xl font-black text-gray-900">{fmt(stats?.cash?.cashAtBank || 0)}</p>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Cash at Bank</p>
            <p className="text-[9px] text-gray-400">Bank, Card & NEFT</p>
          </div>
        </div>
      </div>

      {shortage.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-yellow-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Low Stock Alerts</h3>
            <span className="ml-auto text-xs text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full">{shortage.length} items</span>
          </div>
          <div className="space-y-2">
            {(showAllShortage ? shortage : shortage.slice(0, 5)).map((item: any, i: number) => (
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
          {shortage.length > 5 && (
            <button
              onClick={() => setShowAllShortage(v => !v)}
              className="w-full mt-3 py-2 text-xs font-black uppercase tracking-widest text-yellow-600 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition"
            >
              {showAllShortage ? `▲ Show Less` : `▼ Show All ${shortage.length} Items`}
            </button>
          )}
          <a
            href="/admin#inventory"
            onClick={e => { e.preventDefault(); window.location.href = '/admin'; setTimeout(() => { const el = document.getElementById('inventory-section'); el?.scrollIntoView({ behavior: 'smooth' }); }, 500); }}
            className="flex items-center justify-center gap-2 w-full mt-2 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border border-gray-200 rounded-lg hover:border-[#FA5600] hover:text-[#FA5600] transition"
          >
            → Go to Inventory
          </a>
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
                  {(customer.name || '?')[0].toUpperCase()}
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
                        Last order: {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('en-IN') : '—'}
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
                                <p className="text-[10px] text-gray-400">{sale.date ? new Date(sale.date).toLocaleDateString('en-IN') : '—'} · {sale.items?.length} item{sale.items?.length !== 1 ? 's' : ''}</p>
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
                    <a href={`https://wa.me/${(customer.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
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
      // NOTE: cashFlow entry is recorded server-side inside customers API when status=delivered
      // Do NOT post to /api/business?module=cashflow here — that would double-count the income
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

  const deleteOrder = async (order: any) => {
    if (!confirm(`Delete order ${order.orderId} for ${order.customerName}? This cannot be undone.`)) return;
    await fetch('/api/customers?module=orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order._id }),
    });
    showMsg('Order deleted.', 'success');
    fetchOrders();
  };

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
    const clean = (phone || '').replace(/[^0-9]/g, '');
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
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const statusColors: Record<string, string> = {
    pending:          'bg-yellow-100 text-yellow-700',
    confirmed:        'bg-blue-100 text-blue-700',
    out_for_delivery: 'bg-purple-100 text-purple-700',
    delivered:        'bg-green-100 text-green-700',
    cancelled:        'bg-red-100 text-red-600',
  };

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border-2 ${statusFilter === s ? 'bg-[#FA5600] text-white border-[#FA5600]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#FA5600] hover:text-[#FA5600]'}`}>
            {s === 'out_for_delivery' ? `🚚 On Way (${counts.out_for_delivery})` : `${s} (${counts[s] ?? orders.length})`}
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
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${order.status === 'pending' ? 'bg-yellow-400 animate-pulse' : order.status === 'confirmed' ? 'bg-blue-400' : order.status === 'out_for_delivery' ? 'bg-purple-500 animate-pulse' : order.status === 'delivered' ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-900">{order.customerName}</p>
                  <p className="text-xs text-gray-400">{order.orderId} · {order.customerPhone}</p>
                  <p className="text-xs text-gray-400">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
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
                        <button onClick={() => withDupCheck(`confirm-${order._id}`, 'Confirm Order', () => confirmOrder(order))}
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

                  {/* Already confirmed — show delivery date + dispatch + mark delivered */}
                  {order.status === 'confirmed' && (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      {order.deliveryDate && (
                        <p className="text-xs text-blue-600 font-bold bg-blue-50 rounded-lg px-3 py-2">
                          📅 Delivery scheduled: {new Date(order.deliveryDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      )}
                      {/* Send to Driver — dispatches order and shares tracking link */}
                      <button
                        onClick={async () => {
                          // Mark as out_for_delivery
                          await fetch('/api/customers?module=orders', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: order._id, status: 'out_for_delivery' }),
                          });
                          fetchOrders();
                          // Open WhatsApp to driver with delivery link
                          const driverLink = `${window.location.origin}/deliver/${order._id}`;
                          const msg = `🚚 *Delivery Assigned*\n\nOrder: *${order.orderId}*\nCustomer: ${order.customerName}\nPhone: ${order.customerPhone}\nAddress: ${order.deliveryAddress || order.customerAddress || 'See order'}\n\n📱 Open this link to start delivery:\n${driverLink}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <Truck className="w-4 h-4" /> Send to Driver (Out for Delivery)
                      </button>
                      <button onClick={() => openDeliverModal(order)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl transition">
                        Mark as Delivered ✓
                      </button>
                    </div>
                  )}

                  {/* Out for delivery — show driver link + mark delivered */}
                  {order.status === 'out_for_delivery' && (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <p className="text-xs text-purple-700 font-bold bg-purple-50 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5" /> Out for Delivery
                      </p>
                      {/* Resend driver link */}
                      <button
                        onClick={() => {
                          const driverLink = `${window.location.origin}/deliver/${order._id}`;
                          const msg = `🚚 *Delivery Link*\n\nOrder: *${order.orderId}*\nCustomer: ${order.customerName}\nAddress: ${order.deliveryAddress || order.customerAddress || ''}\n\n📱 ${driverLink}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <Truck className="w-4 h-4" /> Resend Driver Link
                      </button>
                      {/* Customer tracking link */}
                      <button
                        onClick={() => {
                          const trackLink = `${window.location.origin}/track/${order._id}`;
                          navigator.clipboard.writeText(trackLink).then(() => showMsg('Tracking link copied!', 'success'));
                        }}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-widest py-2.5 rounded-xl transition"
                      >
                        📋 Copy Customer Tracking Link
                      </button>
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
                    <button onClick={() => deleteOrder(order)}
                      className="ml-auto text-xs text-red-400 font-bold border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-50 transition">
                      Delete Order
                    </button>
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
              <button
                onClick={() => withDupCheck(`deliver-${payModal.order?._id}`, 'Confirm Delivery', handleDelivered)}
                disabled={payModal.submitting}
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
  const [customers, setCustomers] = useState<any[]>([]); // FIX #7
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerAddress: '', notes: '', paymentMode: 'cash', items: [{ productId: '', productName: '', price: '', quantity: '1' }] });

  const fetchSales = () => {
    setLoading(true);
    fetch(`/api/sales?period=${period}`)
      .then(r => r.json())
      .then(data => { setSales(data.sales || []); setSummary(data.summary || {}); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchSales(); }, [period]);
  useEffect(() => {
    fetch('/api/products?limit=500&adminView=true').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : (data.products || []))).catch(() => {});
    fetch('/api/customers').then(r => r.json()).then(data => setCustomers(data.customers || [])).catch(() => {}); // FIX #7
  }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', price: '', quantity: '1' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  // FIX #9: handle __product__ key from ProductSearchRow
  const updateItem = (i: number, field: string, value: string) => {
    setForm(f => {
      const items = [...f.items];
      if (field === '__product__') {
        const p = JSON.parse(value);
        items[i] = { ...items[i], productId: p._id, productName: p.name, price: String(p.discountedPrice || p.price || ''), category: p.category || '' };
      } else {
        items[i] = { ...items[i], [field]: value };
      }
      return { ...f, items };
    });
  };

  const handleSubmit = async () => {
    if (!form.customerName || !form.customerPhone) { showMsg('Customer name and phone required.', 'error'); return; }
    const validItems = form.items.filter(i => i.productName && i.price && i.quantity);
    if (validItems.length === 0) { showMsg('Add at least one item.', 'error'); return; }
    const payload = { ...form, items: validItems.map(i => ({ productId: i.productId, productName: i.productName, category: i.category || '', price: parseFloat(i.price), quantity: parseInt(i.quantity) })) };
    const res = await fetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) {
      showMsg(`✅ Sale ${data.saleNumber} recorded! Customer auto-saved.`, 'success');
      setShowForm(false);
      setForm({ customerName: '', customerPhone: '', customerAddress: '', notes: '', paymentMode: 'cash', items: [{ productId: '', productName: '', price: '', quantity: '1' }] });
      fetchSales();
    } else if (data.stockErrors) {
      // Professional stock error display
      showMsg(`⚠️ Stock unavailable: ${data.stockErrors.join(' • ')}`, 'error');
    } else {
      showMsg(data.error || 'Failed.', 'error');
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
              {/* FIX #7+8: customer autocomplete, auto-fills phone */}
              <CustomerSearchInput
                value={form.customerName}
                customers={customers}
                onChange={v => setForm(f => ({ ...f, customerName: v }))}
                onSelect={(name, phone) => setForm(f => ({ ...f, customerName: name, customerPhone: phone }))}
                placeholder="Search existing or type new..."
              />
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
              {/* FIX #9+10: searchable product picker, no redundant Name input */}
              {form.items.map((item, i) => (
                <ProductSearchRow key={i} item={item} index={i} products={products}
                  onUpdate={updateItem} onRemove={removeItem} showCost={false} />
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
            <button onClick={() => withDupCheck(`sale-${form.customerPhone}-${form.items.map(i=>i.productName).join('|')}`, 'Record Sale', handleSubmit)} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Save Sale</button>
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
                  <p className="text-xs text-gray-400">{sale.date ? new Date(sale.date).toLocaleDateString('en-IN') : '—'}</p>
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
  const [editingPO, setEditingPO] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ supplierName: '', supplierContact: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] });
  const [advModal, setAdvModal] = useState<{ open: boolean; po: any | null }>({ open: false, po: null });
  const [advForm, setAdvForm] = useState({ amount: '', paymentMode: 'cash', notes: '' });
  const [supplierCredit, setSupplierCredit] = useState<{ netBalance: number; loading: boolean }>({ netBalance: 0, loading: false });
  const [recvModal, setRecvModal] = useState<{ open: boolean; po: any | null }>({ open: false, po: null });
  const [recvItems, setRecvItems] = useState<any[]>([]);
  const [recvPayMode, setRecvPayMode] = useState('cash');
  const [resolveModal, setResolveModal] = useState<{ open: boolean; po: any | null }>({ open: false, po: null });
  const [resolveForm, setResolveForm] = useState({ resolveType: 'refund', amount: '', paymentMode: 'cash', notes: '' });

  const fetchPOs = () => { setLoading(true); fetch('/api/purchase-orders').then(r => r.json()).then(data => setPos(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => {
    fetchPOs();
    fetch('/api/products?limit=500&adminView=true').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : (data.products || []))).catch(() => {});
    fetch('/api/business?module=suppliers').then(r => r.json()).then(data => setSuppliers(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: string, value: string) => {
    setForm(f => {
      const items = [...f.items];
      if (field === '__product__') { const p = JSON.parse(value); items[i] = { ...items[i], productId: p._id, productName: p.name, sku: p.sku || '' }; }
      else { items[i] = { ...items[i], [field]: value }; }
      return { ...f, items };
    });
  };

  const openEdit = (po: any) => {
    setEditingPO(po);
    setForm({ supplierName: po.supplier?.name || '', supplierContact: po.supplier?.contact || '', notes: po.notes || '', expectedDate: po.expectedDate ? new Date(po.expectedDate).toISOString().split('T')[0] : '', items: po.items.map((i: any) => ({ productId: i.productId || '', productName: i.productName || '', sku: i.sku || '', quantity: String(i.quantity), costPrice: String(i.costPrice) })) });
    setShowForm(true); setExpandedId(null);
  };

  const handleCreate = async () => {
    const validItems = form.items.filter(i => i.productName && i.quantity && i.costPrice);
    if (validItems.length === 0) { showMsg('Add at least one item with cost price.', 'error'); return; }
    const payload = { supplier: { name: form.supplierName, contact: form.supplierContact }, items: validItems.map(i => ({ productId: i.productId, productName: i.productName, sku: i.sku, quantity: parseInt(i.quantity), costPrice: parseFloat(i.costPrice) })), notes: form.notes, expectedDate: form.expectedDate };
    if (editingPO) {
      const res = await fetch('/api/purchase-orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingPO._id, action: 'update', ...payload }) });
      const data = await res.json();
      if (data.success) { showMsg('✅ PO updated!', 'success'); setShowForm(false); setEditingPO(null); setForm({ supplierName: '', supplierContact: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] }); fetchPOs(); }
      else showMsg(data.error || 'Failed.', 'error');
    } else {
      const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { showMsg(`✅ ${data.poNumber} created!`, 'success'); setShowForm(false); setForm({ supplierName: '', supplierContact: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] }); fetchPOs(); }
      else showMsg(data.error || 'Failed.', 'error');
    }
  };

  const handleAction = async (id: string, action: string, extra: any = {}) => {
    const res = await fetch('/api/purchase-orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, ...extra }) });
    const data = await res.json();
    if (data.success) { showMsg(data.message || ({ order: 'PO marked as ordered!', cancel: 'PO cancelled.' } as any)[action] || 'Updated!', 'success'); fetchPOs(); }
    else showMsg(data.error || 'Failed.', 'error');
    return data;
  };

  const deletePO = async (id: string, poNumber: string, status: string) => {
    const warn = status === 'received'
      ? `Delete ${poNumber}? This will remove the PO, REVERSE all stock, and delete all cash flow and ledger entries.`
      : status === 'ordered'
      ? `Delete ${poNumber}? This will remove the PO and all advance/payment entries from cash flow and ledger.`
      : `Delete ${poNumber}?`;
    if (!confirm(warn)) return;
    await fetch('/api/purchase-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showMsg('PO deleted.', 'success'); fetchPOs();
  };

  const openAdvance = async (po: any) => {
    setAdvModal({ open: true, po });
    setAdvForm({ amount: String(po.dueAmount || po.totalAmount), paymentMode: 'cash', notes: '' });
    setSupplierCredit({ netBalance: 0, loading: true });
    // Fetch supplier's current ledger balance to show any existing credit
    try {
      const suppliers = await fetch('/api/business?module=suppliers').then(r => r.json());
      const supplier = (Array.isArray(suppliers) ? suppliers : []).find((s: any) =>
        s.name?.toLowerCase() === po.supplier?.name?.toLowerCase()
      );
      if (supplier) {
        const ledger = await fetch(`/api/business?module=ledger&partyType=supplier&partyId=${supplier._id}`).then(r => r.json());
        setSupplierCredit({ netBalance: ledger?.summary?.netBalance || 0, loading: false });
      } else {
        setSupplierCredit({ netBalance: 0, loading: false });
      }
    } catch {
      setSupplierCredit({ netBalance: 0, loading: false });
    }
  };

  const submitAdvance = async () => {
    if (!advForm.amount || Number(advForm.amount) <= 0) { showMsg('Enter a valid amount.', 'error'); return; }
    const data = await handleAction(advModal.po._id, 'advance_payment', { amount: Number(advForm.amount), paymentMode: advForm.paymentMode, notes: advForm.notes });
    if (data.success) {
      setAdvModal({ open: false, po: null });
      setAdvForm({ amount: '', paymentMode: 'cash', notes: '' });
      setSupplierCredit({ netBalance: 0, loading: false });
      fetchPOs(); // ← auto-refresh PO list to show updated paid/due amounts
    }
  };

  const openReceive = (po: any) => {
    setRecvItems(po.items.map((i: any) => ({ ...i, quantityReceived: i.quantity, damageNotes: '' })));
    setRecvPayMode('cash'); setRecvModal({ open: true, po });
  };

  const removeRecvItem = (index: number) => {
    setRecvItems((prev: any[]) => prev.filter((_: any, i: number) => i !== index));
  };

  const addRecvItem = () => {
    setRecvItems((prev: any[]) => [...prev, { productId: '', productName: '', sku: '', quantity: 1, quantityReceived: 1, costPrice: 0, totalCost: 0, damageNotes: '', isExtra: true }]);
  };

  const updateRecvItem = (index: number, field: string, value: any) => {
    setRecvItems((prev: any[]) => prev.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item));
  };

  const submitReceive = async () => {
    const data = await handleAction(recvModal.po._id, 'receive', { receivedItems: recvItems, paymentMode: recvPayMode });
    if (data.success) {
      setRecvModal({ open: false, po: null });
      if (data.shortageItems?.length > 0) showMsg(`⚠️ Stock received with shortage of ₹${Number(data.totalShortageValue || 0).toFixed(2)} — recorded against ${recvModal.po?.supplier?.name || 'supplier'}.`, 'error');
    }
  };

  const submitResolve = async () => {
    const data = await handleAction(resolveModal.po._id, 'resolve_shortage', { resolveType: resolveForm.resolveType, amount: Number(resolveForm.amount), paymentMode: resolveForm.paymentMode, notes: resolveForm.notes });
    if (data.success) { setResolveModal({ open: false, po: null }); setResolveForm({ resolveType: 'refund', amount: '', paymentMode: 'cash', notes: '' }); }
  };

  const poStatusColor: any = { draft: 'bg-gray-100 text-gray-600', ordered: 'bg-blue-100 text-blue-700', received: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 font-bold">{pos.length} purchase orders</p>
        <button onClick={() => { setShowForm(!showForm); setEditingPO(null); setForm({ supplierName: '', supplierContact: '', notes: '', expectedDate: '', items: [{ productId: '', productName: '', sku: '', quantity: '1', costPrice: '' }] }); }}
          className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition">
          <Plus className="w-4 h-4" /> New PO
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-4">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">{editingPO ? `Edit ${editingPO.poNumber}` : 'New Purchase Order'}</h3>
          {editingPO && <p className="text-xs text-blue-600 font-bold bg-blue-50 rounded-lg px-3 py-2">✏️ Editing an {editingPO.status} PO — changes will update items and totals.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Supplier Name</label>
              <SupplierSearchInput value={form.supplierName} suppliers={suppliers} onChange={(name, contact) => setForm(f => ({ ...f, supplierName: name, supplierContact: contact || f.supplierContact }))} />
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Contact</label>
              <input value={form.supplierContact} onChange={e => setForm(f => ({ ...f, supplierContact: e.target.value }))} placeholder="Phone" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Expected Date</label>
              <input type="date" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Items *</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (<ProductSearchRow key={i} item={item} index={i} products={products} onUpdate={updateItem} onRemove={removeItem} showCost={true} />))}
            </div>
            <button onClick={addItem} className="mt-2 text-xs text-[#FA5600] font-black uppercase tracking-widest flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> Add Item</button>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Total Cost</p>
            <p className="text-2xl font-black text-[#FA5600]">{fmt(form.items.reduce((s, i) => s + (parseFloat(i.costPrice || '0') * parseInt(i.quantity || '1')), 0))}</p>
          </div>
          <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes for this PO..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => withDupCheck(`po-save-${form.supplierName}`, editingPO ? 'Update PO' : 'Create PO', handleCreate)} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">{editingPO ? 'Update PO' : 'Create PO'}</button>
            <button onClick={() => { setShowForm(false); setEditingPO(null); }} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : pos.length === 0 ? <EmptyState icon="📦" text="No purchase orders yet" /> : (
        <div className="space-y-3">
          {pos.map(po => (
            <div key={po._id} className={`bg-white rounded-xl border-2 transition-all ${expandedId === po._id ? 'border-[#FA5600]' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === po._id ? null : po._id)}>
                <div>
                  <p className="font-black text-sm text-gray-900">{po.poNumber}</p>
                  <p className="text-xs text-gray-400">{po.supplier?.name || 'No supplier'} · {po.items?.length} item{po.items?.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-400">{po.createdAt ? new Date(po.createdAt).toLocaleDateString('en-IN') : '—'}</p>
                  {po.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{po.notes}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-lg text-[#FA5600]">{fmt(po.totalAmount)}</p>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${poStatusColor[po.status] || 'bg-gray-100 text-gray-600'}`}>{po.status}</span>
                  {po.shortageStatus === 'has_shortage' && !po.shortageResolved && <p className="text-[10px] text-red-500 font-black mt-0.5">⚠️ SHORTAGE</p>}
                </div>
              </div>

              {expandedId === po._id && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Items</p>
                    <div className="space-y-1.5">
                      {po.items?.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                          <div><p className="text-xs font-bold text-gray-800">{item.productName}</p><p className="text-[10px] text-gray-400">Cost: {fmt(item.costPrice)} · Qty: {item.quantity}</p></div>
                          <p className="font-black text-xs text-[#FA5600]">{fmt(item.totalCost)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(po.paidAmount > 0 || po.dueAmount > 0) && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-orange-50 rounded-lg p-2 text-center"><p className="font-black text-sm text-[#FA5600]">{fmt(po.totalAmount)}</p><p className="text-[9px] text-gray-400 uppercase font-bold">Total</p></div>
                      <div className="bg-green-50 rounded-lg p-2 text-center"><p className="font-black text-sm text-green-600">{fmt(po.paidAmount)}</p><p className="text-[9px] text-gray-400 uppercase font-bold">Paid</p></div>
                      <div className="bg-red-50 rounded-lg p-2 text-center"><p className="font-black text-sm text-red-600">{fmt(po.dueAmount)}</p><p className="text-[9px] text-gray-400 uppercase font-bold">Due</p></div>
                    </div>
                  )}

                  {po.shortageItems?.length > 0 && (
                    <div className={`rounded-xl border p-3 space-y-2 ${po.shortageResolved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs font-black uppercase tracking-widest text-red-700">{po.shortageResolved ? '✅ Shortage Resolved' : '⚠️ Shortage / Damage Recorded'}</p>
                      {po.shortageItems.map((s: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-700 font-bold">{s.productName}</span>
                          <span className="text-red-600 font-black">{s.orderedQty} ordered · {s.receivedQty} received · {s.shortageQty} short — {fmt(s.shortageValue)}{s.damageNotes && <span className="text-gray-400 font-normal"> ({s.damageNotes})</span>}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-black text-sm pt-1 border-t border-red-200">
                        <span className="text-red-700">Owed by {po.supplier?.name || 'supplier'}</span>
                        <span className="text-red-700">{fmt(po.shortageValue)}</span>
                      </div>
                      {po.shortageResolveType && <p className="text-[10px] text-green-600 font-bold">Resolved via {po.shortageResolveType === 'refund' ? `refund of ${fmt(po.shortageRefundAmount)}` : 'goods received'} on {po.shortageResolvedAt ? new Date(po.shortageResolvedAt).toLocaleDateString('en-IN') : '—'}</p>}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap pt-1">
                    {/* Edit PO — only for draft (ordered POs are edited at receive time) */}
                    {po.status === 'draft' && (
                      <button onClick={() => openEdit(po)} className="flex items-center gap-1 text-xs text-blue-500 font-bold border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-50 transition">
                        <Edit2 className="w-3 h-3" /> Edit PO
                      </button>
                    )}
                    {po.status === 'draft' && (
                      <>
                        <button onClick={() => withDupCheck(`po-order-${po._id}`, 'Mark Ordered', () => handleAction(po._id, 'order'))} className="text-xs bg-blue-500 text-white font-bold px-3 py-1.5 rounded-full hover:bg-blue-600 transition">Mark Ordered</button>
                        <button onClick={() => deletePO(po._id, po.poNumber, po.status)} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1.5 rounded-full hover:bg-red-100 transition">Delete</button>
                      </>
                    )}
                    {po.status === 'ordered' && (
                      <>
                        {/* Hide Advance Payment when fully paid */}
                        {(po.dueAmount > 0) && (
                          <button onClick={() => openAdvance(po)} className="text-xs bg-yellow-500 text-white font-bold px-3 py-1.5 rounded-full hover:bg-yellow-600 transition">💰 Advance Payment</button>
                        )}
                        <button onClick={() => openReceive(po)} className="text-xs bg-green-500 text-white font-bold px-3 py-1.5 rounded-full hover:bg-green-600 transition">✓ Receive Stock</button>
                        <button onClick={() => handleAction(po._id, 'cancel')} className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1.5 rounded-full hover:bg-gray-200 transition">Cancel</button>
                        <button onClick={() => deletePO(po._id, po.poNumber, po.status)} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1.5 rounded-full hover:bg-red-100 transition">Delete</button>
                      </>
                    )}
                    {po.status === 'received' && po.shortageItems?.length > 0 && !po.shortageResolved && (
                      <button onClick={() => { setResolveModal({ open: true, po }); setResolveForm({ resolveType: 'refund', amount: String(po.shortageValue || ''), paymentMode: 'cash', notes: '' }); }} className="text-xs bg-orange-500 text-white font-bold px-3 py-1.5 rounded-full hover:bg-orange-600 transition">🔧 Resolve Shortage</button>
                    )}
                    {(po.status === 'received' || po.status === 'cancelled') && (
                      <button onClick={() => deletePO(po._id, po.poNumber, po.status)} className="text-xs bg-red-50 text-red-500 font-bold px-3 py-1.5 rounded-full hover:bg-red-100 transition">Delete</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Advance Payment Modal */}
      {advModal.open && advModal.po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div><h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">Advance Payment</h3><p className="text-xs text-gray-400 mt-0.5">{advModal.po.poNumber} · {advModal.po.supplier?.name}</p><p className="text-xs text-gray-400">Total: {fmt(advModal.po.totalAmount)} · Due: {fmt(advModal.po.dueAmount)}</p></div>
              <button onClick={() => { setAdvModal({ open: false, po: null }); setSupplierCredit({ netBalance: 0, loading: false }); }} className="text-gray-400 hover:text-gray-600 font-black text-xl">✕</button>
            </div>

            {/* Supplier credit balance banner */}
            {supplierCredit.loading && (
              <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold text-gray-400">Checking {advModal.po.supplier?.name}'s balance...</div>
            )}
            {!supplierCredit.loading && supplierCredit.netBalance < -0.01 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 space-y-1">
                <p className="text-xs font-black text-blue-700">💰 Credit Available: {fmt(Math.abs(supplierCredit.netBalance))}</p>
                <p className="text-[10px] text-blue-500">{advModal.po.supplier?.name} has an existing credit (overpayment / shortage refund). You can pay less on this PO.</p>
                <button
                  onClick={() => setAdvForm(f => ({ ...f, amount: String(Math.max(0, Number(f.amount) - Math.abs(supplierCredit.netBalance))) }))}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600 underline"
                >
                  Apply credit → reduce payment to {fmt(Math.max(0, advModal.po.dueAmount - Math.abs(supplierCredit.netBalance)))}
                </button>
              </div>
            )}
            {!supplierCredit.loading && supplierCredit.netBalance > 0.01 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold text-orange-700">
                ⚠️ {advModal.po.supplier?.name} has an outstanding payable of {fmt(supplierCredit.netBalance)} from previous POs.
              </div>
            )}

            <div className="space-y-3">
              <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Amount Paid (₹) *</label>
                <input type="number" value={advForm.amount} onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))} placeholder="Enter amount" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
              <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Payment Mode</label>
                <select value={advForm.paymentMode} onChange={e => setAdvForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option>
                </select>
              </div>
              <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Notes</label>
                <input value={advForm.notes} onChange={e => setAdvForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. 50% advance as agreed" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
            </div>
            <div className="bg-yellow-50 rounded-xl px-3 py-2 text-xs font-bold text-yellow-700">This will be recorded as an advance expense in Cash Flow, linked to {advModal.po.poNumber}.</div>
            <div className="flex gap-3">
              <button onClick={() => { setAdvModal({ open: false, po: null }); setSupplierCredit({ netBalance: 0, loading: false }); }} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500">Cancel</button>
              <button onClick={submitAdvance} className="flex-1 py-2.5 rounded-xl bg-[#FA5600] text-white text-xs font-black uppercase tracking-widest hover:bg-[#E04A00] transition">Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Stock Modal */}
      {recvModal.open && recvModal.po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 my-4">
            <div className="flex justify-between items-start">
              <div><h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">Receive Stock</h3><p className="text-xs text-gray-400 mt-0.5">{recvModal.po.poNumber} · {recvModal.po.supplier?.name}</p></div>
              <button onClick={() => setRecvModal({ open: false, po: null })} className="text-gray-400 hover:text-gray-600 font-black text-xl">✕</button>
            </div>
            <p className="text-xs text-blue-600 font-bold bg-blue-50 rounded-lg px-3 py-2">Enter actual quantity received. Remove items not sent. Add items supplier sent that weren't on the PO.</p>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {recvItems.map((item: any, i: number) => (
                <div key={i} className={`rounded-xl p-3 space-y-2 ${item.isExtra ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      {item.isExtra ? (
                        <input value={item.productName} onChange={e => updateRecvItem(i, 'productName', e.target.value)}
                          placeholder="Product name..." className="text-sm font-black text-gray-800 bg-transparent border-b border-blue-300 outline-none w-full" />
                      ) : (
                        <p className="text-sm font-black text-gray-800">{item.productName}</p>
                      )}
                      {item.isExtra
                        ? <span className="text-[10px] text-blue-500 font-bold">➕ Extra item from supplier</span>
                        : <span className="text-xs text-gray-400 font-bold">Ordered: {item.quantity} · {fmt(item.costPrice)} each</span>
                      }
                    </div>
                    <button onClick={() => removeRecvItem(i)} className="text-red-400 hover:text-red-600 font-black text-lg leading-none ml-2" title="Remove item">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Qty Received *</label>
                      <input type="number" min="0" value={item.quantityReceived}
                        onChange={e => updateRecvItem(i, 'quantityReceived', Number(e.target.value))}
                        className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:border-[#FA5600] outline-none" />
                    </div>
                    <div><label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.isExtra ? 'Cost Price (₹)' : 'Damage / Shortage Note'}</label>
                      {item.isExtra
                        ? <input type="number" min="0" value={item.costPrice} onChange={e => updateRecvItem(i, 'costPrice', Number(e.target.value))}
                            placeholder="0" className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:border-[#FA5600] outline-none" />
                        : <input value={item.damageNotes} onChange={e => updateRecvItem(i, 'damageNotes', e.target.value)}
                            placeholder="e.g. 2 pcs damaged" className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:border-[#FA5600] outline-none" />
                      }
                    </div>
                  </div>
                  {!item.isExtra && Number(item.quantityReceived) < Number(item.quantity) && (
                    <p className="text-[10px] text-red-500 font-bold">⚠️ Shortage: {Number(item.quantity) - Number(item.quantityReceived)} units · {fmt((Number(item.quantity) - Number(item.quantityReceived)) * Number(item.costPrice))} owed by {recvModal.po.supplier?.name || 'supplier'}</p>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addRecvItem} className="text-xs text-blue-500 font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
              ➕ Add Item Supplier Sent
            </button>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Balance Payment Mode</label>
              <select value={recvPayMode} onChange={e => setRecvPayMode(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option>
              </select>
            </div>
            {recvModal.po.paidAmount > 0 && <div className="bg-green-50 rounded-xl px-3 py-2 text-xs font-bold text-green-700">✅ Advance of {fmt(recvModal.po.paidAmount)} already paid — only the balance will be added to Cash Flow.</div>}
            <div className="flex gap-3">
              <button onClick={() => setRecvModal({ open: false, po: null })} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500">Cancel</button>
              <button onClick={submitReceive} className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-xs font-black uppercase tracking-widest hover:bg-green-600 transition">Confirm Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Shortage Resolution Modal */}
      {resolveModal.open && resolveModal.po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div><h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">Resolve Shortage</h3><p className="text-xs text-gray-400 mt-0.5">{resolveModal.po.poNumber} · {resolveModal.po.supplier?.name}</p><p className="text-xs text-red-500 font-bold">Outstanding: {fmt(resolveModal.po.shortageValue)}</p></div>
              <button onClick={() => setResolveModal({ open: false, po: null })} className="text-gray-400 hover:text-gray-600 font-black text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: 'refund', label: '💵 Refund', desc: 'Supplier paid back' }, { value: 'goods', label: '📦 Goods Sent', desc: 'Missing items arrived' }].map(opt => (
                <button key={opt.value} onClick={() => setResolveForm(f => ({ ...f, resolveType: opt.value }))} className={`p-3 rounded-xl border-2 text-left transition ${resolveForm.resolveType === opt.value ? 'border-[#FA5600] bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-black text-xs text-gray-800">{opt.label}</p><p className="text-[10px] text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
            {resolveForm.resolveType === 'refund' && (
              <div className="space-y-3">
                <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Refund Amount (₹)</label>
                  <input type="number" value={resolveForm.amount} onChange={e => setResolveForm(f => ({ ...f, amount: e.target.value }))} placeholder={String(resolveModal.po.shortageValue)} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
                </div>
                <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Payment Mode</label>
                  <select value={resolveForm.paymentMode} onChange={e => setResolveForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>
            )}
            {resolveForm.resolveType === 'goods' && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-700">All shortage items will be added to inventory.</p>
                <div className="mt-2 space-y-1">{resolveModal.po.shortageItems?.map((s: any, i: number) => (<p key={i} className="text-xs text-gray-600">• {s.productName} — {s.shortageQty} units</p>))}</div>
              </div>
            )}
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Notes</label>
              <input value={resolveForm.notes} onChange={e => setResolveForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setResolveModal({ open: false, po: null })} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500">Cancel</button>
              <button onClick={submitResolve} className="flex-1 py-2.5 rounded-xl bg-[#FA5600] text-white text-xs font-black uppercase tracking-widest hover:bg-[#E04A00] transition">Confirm Resolution</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function CashflowModule({ showMsg }: any) {
  const [data, setData] = useState<any>({ entries: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'income', category: '', amount: '', description: '', date: '', paymentMode: 'cash' });

  // FIX #11: preset categories per type
  const INCOME_CATS = ['Sales', 'Delivery Collection', 'Refund Received', 'Loan', 'Investment', 'Other Income'];
  const EXPENSE_CATS = ['Rent', 'Salaries', 'Purchase', 'Utilities', 'Marketing', 'Transport', 'Maintenance', 'Packaging', 'Other'];

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

  const { income = 0, expense = 0, profit = 0, cashInHand = 0, cashAtBank = 0 } = data.summary || {};

  return (
    <div className="space-y-4">
      {/* Top row — Income / Expense / Profit */}
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

      {/* Cash in Hand + Cash at Bank */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0 text-xl">💵</div>
          <div>
            <p className={`text-xl font-black ${cashInHand >= 0 ? 'text-yellow-800' : 'text-red-600'}`}>{fmt(cashInHand)}</p>
            <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Cash in Hand</p>
            <p className="text-[9px] text-yellow-500 mt-0.5">Cash & UPI transactions</p>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 text-xl">🏦</div>
          <div>
            <p className={`text-xl font-black ${cashAtBank >= 0 ? 'text-blue-800' : 'text-red-600'}`}>{fmt(cashAtBank)}</p>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Cash at Bank</p>
            <p className="text-[9px] text-blue-500 mt-0.5">Bank, Card & NEFT</p>
          </div>
        </div>
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
              {/* FIX #11: reset category when type changes */}
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, category: '' }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white"><option value="income">Income</option><option value="expense">Expense</option></select>
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="₹ 0" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            {/* FIX #11: category is now a select with presets */}
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="">Select category</option>
                {(form.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* FIX #12: payment mode now visible in UI */}
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Payment Mode</label>
              <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option><option value="card">Card</option>
              </select>
            </div>
            <div><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div className="col-span-2"><label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => withDupCheck(`cashflow-${form.type}-${form.category}-${form.amount}`, 'Cash Flow Entry', handleSubmit)} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Add Entry</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={4} /> : data.entries?.length === 0 ? <EmptyState icon="💰" text="No cash flow entries for this period" /> : (
        <div className="space-y-2">
          {data.entries?.filter((entry: any) => entry.category !== 'cogs').map((entry: any) => (
            <div key={entry._id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${entry.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                {entry.type === 'income' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{entry.description || entry.category}</p>
                <p className="text-[10px] text-gray-400">{entry.category || '—'} · {entry.paymentMode || 'cash'} · {entry.date ? new Date(entry.date).toLocaleDateString('en-IN') : '—'}</p>
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
  const [period, setPeriod] = useState('month'); // FIX #13
  const [form, setForm] = useState({ category: '', amount: '', description: '', date: '', paymentMode: 'cash' });
  const CATS = ['Rent', 'Salaries', 'Purchase', 'Utilities', 'Marketing', 'Transport', 'Maintenance', 'Packaging', 'Other'];

  // FIX #13: pass period to API
  const fetchExpenses = () => { setLoading(true); fetch(`/api/business?module=expenses&period=${period}`).then(r => r.json()).then(data => setExpenses(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { fetchExpenses(); }, [period]);

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
        {/* FIX #14: total is now period-filtered, label reflects the period */}
        <div>
          <p className="text-2xl font-black text-red-700">{fmt(expenses.reduce((s, e) => s + (e.amount || 0), 0))}</p>
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
            {period === 'today' ? "Today's" : period === 'week' ? "This Week's" : period === 'month' ? "This Month's" : "This Year's"} Expenses
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition"><Plus className="w-4 h-4" /> Add</button>
      </div>

      {/* FIX #13: period filter */}
      <select value={period} onChange={e => setPeriod(e.target.value)} className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
      </select>

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
            <button onClick={() => withDupCheck(`expense-${form.category}-${form.amount}`, 'Save Expense', handleSubmit)} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">Save Expense</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : expenses.length === 0 ? <EmptyState icon="🧾" text="No expenses recorded for this period" /> : (
        <div className="space-y-2">
          {expenses.map(exp => (
            <div key={exp._id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0"><TrendingDown className="w-4 h-4 text-red-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{exp.description || exp.category}</p>
                <p className="text-[10px] text-gray-400">{exp.category} · {exp.paymentMode} · {exp.date ? new Date(exp.date).toLocaleDateString('en-IN') : '—'}</p>
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



// ─── AP/AR LEDGER MODULE ──────────────────────────────────────────────────────
function LedgerModule({ showMsg }: any) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selected, setSelected]   = useState<any>(null);
  const [ledger, setLedger]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({
    entryType: 'debit', amount: '', description: '',
    referenceType: 'advance_payment', paymentMode: 'cash', notes: '', date: '',
  });

  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const loadSuppliers = () => {
    setLoading(true);
    fetch('/api/business?module=ledger&partyType=supplier')
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSuppliers(); }, []);

  const loadLedger = (supplier: any) => {
    setSelected(supplier);
    setLedgerLoading(true);
    fetch(`/api/business?module=ledger&partyType=supplier&partyId=${supplier._id}`)
      .then(r => r.json())
      .then(d => setLedger(d))
      .catch(() => {})
      .finally(() => setLedgerLoading(false));
  };

  const handleAdd = async () => {
    if (!form.amount || !selected) return;
    const res = await fetch('/api/business?module=ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partyType: 'supplier',
        partyId: selected._id,
        partyName: selected.name,
        entryType: form.entryType,
        amount: Number(form.amount),
        description: form.description,
        referenceType: form.referenceType,
        paymentMode: form.paymentMode,
        notes: form.notes,
        date: form.date || new Date().toISOString(),
      }),
    });
    const data = await res.json();
    if (data.success) {
      showMsg('Entry recorded', 'success');
      setShowAdd(false);
      setForm({ entryType: 'debit', amount: '', description: '', referenceType: 'advance_payment', paymentMode: 'cash', notes: '', date: '' });
      loadLedger(selected);
      loadSuppliers();
    } else {
      showMsg(data.error || 'Error', 'error');
    }
  };

  const netBalance = ledger?.summary?.netBalance || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* LEFT: Supplier list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#FA5600]" />
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-700">Supplier Ledger</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : suppliers.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs font-bold uppercase">No suppliers yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {suppliers.map(s => (
              <button key={s._id} onClick={() => loadLedger(s)}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50/50 transition text-left ${selected?._id === s._id ? 'bg-orange-50 border-l-4 border-[#FA5600]' : ''}`}>
                <div>
                  <p className="font-black text-sm text-gray-800">{s.name}</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">
                    {s.status === 'payable' ? '← We owe them' : s.status === 'receivable' ? '→ They owe us' : 'Settled'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${s.netBalance > 0 ? 'text-red-600' : s.netBalance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {s.netBalance !== 0 ? fmt(s.netBalance) : '—'}
                  </p>
                  <p className="text-[9px] text-gray-400">{s.netBalance > 0 ? 'Payable' : s.netBalance < 0 ? 'Receivable' : 'Clear'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: Ledger detail */}
      <div className="lg:col-span-2 space-y-4">
        {!selected ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-black text-sm uppercase tracking-widest">Select a supplier to view ledger</p>
          </div>
        ) : (
          <>
            {/* Balance summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-black text-lg text-gray-900">{selected.name}</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">Supplier Account Statement</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)}
                  className="flex items-center gap-1.5 bg-[#FA5600] text-white text-xs font-black uppercase tracking-widest px-3 py-2 rounded-xl hover:bg-[#E04A00] transition">
                  <Plus className="w-3.5 h-3.5" /> Add Entry
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-red-700">{fmt(ledger?.summary?.totalCredit || 0)}</p>
                  <p className="text-[9px] text-red-500 font-black uppercase tracking-widest">Total Invoiced</p>
                  <p className="text-[8px] text-gray-400">Goods received</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-green-700">{fmt(ledger?.summary?.totalDebit || 0)}</p>
                  <p className="text-[9px] text-green-600 font-black uppercase tracking-widest">Total Paid/Credited</p>
                  <p className="text-[8px] text-gray-400">Payments + credits</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${netBalance > 0 ? 'bg-orange-50' : netBalance < 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <p className={`text-lg font-black ${netBalance > 0 ? 'text-orange-700' : netBalance < 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                    {netBalance !== 0 ? fmt(netBalance) : '—'}
                  </p>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${netBalance > 0 ? 'text-orange-600' : netBalance < 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {netBalance > 0 ? 'Amount Payable' : netBalance < 0 ? 'Amount Receivable' : 'Settled'}
                  </p>
                  <p className="text-[8px] text-gray-400">{netBalance > 0 ? 'We owe supplier' : netBalance < 0 ? 'Supplier owes us' : 'No balance'}</p>
                </div>
              </div>
            </div>

            {/* Add Entry Form */}
            {showAdd && (
              <div className="bg-white rounded-2xl border-2 border-[#FA5600]/30 shadow-sm p-4 space-y-3">
                <h4 className="font-black text-sm uppercase tracking-widest text-gray-700">New Ledger Entry</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Entry Type</label>
                    <select value={form.entryType} onChange={e => setForm(f => ({...f, entryType: e.target.value}))}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none">
                      <option value="debit">Debit (Payment / Credit Note to us)</option>
                      <option value="credit">Credit (Invoice / Goods Received)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Reference Type</label>
                    <select value={form.referenceType} onChange={e => setForm(f => ({...f, referenceType: e.target.value}))}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none">
                      <option value="advance_payment">Advance Payment</option>
                      <option value="payment">Payment Against Invoice</option>
                      <option value="short_delivery">Short Delivery Credit</option>
                      <option value="credit_note">Credit Note from Supplier</option>
                      <option value="debit_note">Debit Note to Supplier</option>
                      <option value="manual">Manual Adjustment</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Amount (₹)</label>
                    <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                      placeholder="0.00" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"/>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Payment Mode</label>
                    <select value={form.paymentMode} onChange={e => setForm(f => ({...f, paymentMode: e.target.value}))}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="neft">NEFT/RTGS</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Description</label>
                    <input type="text" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                      placeholder="e.g. Advance payment for PO-2026-003"
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"/>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"/>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Notes</label>
                    <input type="text" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                      placeholder="Optional notes"
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"/>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAdd}
                    className="flex-1 bg-[#FA5600] text-white font-black uppercase tracking-widest text-xs py-2.5 rounded-xl hover:bg-[#E04A00] transition">
                    Save Entry
                  </button>
                  <button onClick={() => setShowAdd(false)}
                    className="px-4 py-2.5 border-2 border-gray-200 rounded-xl text-xs font-black text-gray-500 hover:border-gray-300 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Ledger table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h4 className="font-black text-xs uppercase tracking-widest text-gray-600">Transaction History</h4>
              </div>
              {ledgerLoading ? (
                <div className="p-4 space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
              ) : !ledger?.entries?.length ? (
                <div className="p-8 text-center text-gray-400 text-xs font-bold uppercase">No transactions yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2 font-black uppercase tracking-widest text-gray-500">Date</th>
                        <th className="text-left px-4 py-2 font-black uppercase tracking-widest text-gray-500">Description</th>
                        <th className="text-right px-4 py-2 font-black uppercase tracking-widest text-red-500">Invoiced (CR)</th>
                        <th className="text-right px-4 py-2 font-black uppercase tracking-widest text-green-600">Paid/Credit (DR)</th>
                        <th className="text-right px-4 py-2 font-black uppercase tracking-widest text-gray-500">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(ledger.entries || []).map((entry: any) => (
                        <tr key={entry._id} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                            {entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-xs">
                            <p className="font-bold truncate">{entry.description}</p>
                            {entry.referenceType && <p className="text-[8px] text-gray-400 uppercase">{entry.referenceType.replace(/_/g,' ')}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-red-600">
                            {entry.entryType === 'credit' ? fmt(entry.amount) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-green-600">
                            {entry.entryType === 'debit' ? fmt(entry.amount) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-black">
                            <span className={entry.runningBalance > 0 ? 'text-orange-600' : entry.runningBalance < 0 ? 'text-blue-600' : 'text-gray-400'}>
                              {entry.runningBalance !== 0 ? fmt(entry.runningBalance) : '—'}
                            </span>
                            <p className="text-[8px] text-gray-400">{entry.runningBalance > 0 ? 'payable' : entry.runningBalance < 0 ? 'receivable' : ''}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
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
            <button onClick={() => withDupCheck(`supplier-${form.name}-${form.phone}`, editId ? 'Update Supplier' : 'Add Supplier', handleSubmit)} className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition">{editId ? 'Update' : 'Add'}</button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : suppliers.length === 0 ? <EmptyState icon="👥" text="No suppliers yet" /> : (
        <div className="space-y-3">
          {suppliers.map(s => (
            <div key={s._id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 font-black text-[#FA5600] text-lg">{(s.name || '?')[0].toUpperCase()}</div>
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

// ─── REGENERATE BOOKS ────────────────────────────────────────────────────────
function RegenerateModule({ showMsg }: any) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scope, setScope] = useState<'ledger' | 'full'>('ledger');

  const runRegenerate = async () => {
    const scopeLabel = scope === 'full' ? 'FULL (ledger + cashflow)' : 'LEDGER ONLY';
    if (!window.confirm(`⚠️ This will DELETE and REBUILD all PO-linked ${scopeLabel} entries.\n\nThis cannot be undone. Continue?`)) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/business?module=regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        showMsg(`✅ Regenerated: ${data.ledgerCreated} ledger entries rebuilt`, 'success');
      } else {
        showMsg(data.error || 'Failed', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
        <div>
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">🔄 Regenerate Books</h3>
          <p className="text-xs text-gray-400 mt-1">Rebuilds all financial entries from your transaction data. Use this to fix incorrect ledger or cashflow entries.</p>
        </div>

        {/* Scope selector */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setScope('ledger')}
            className={`p-4 rounded-xl border-2 text-left transition ${scope === 'ledger' ? 'border-[#FA5600] bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <p className="font-black text-sm text-gray-800">📒 Ledger Only</p>
            <p className="text-xs text-gray-400 mt-1">Rebuilds supplier ledger entries only. Safe — cashflow untouched.</p>
          </button>
          <button onClick={() => setScope('full')}
            className={`p-4 rounded-xl border-2 text-left transition ${scope === 'full' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <p className="font-black text-sm text-gray-800">⚡ Full Regenerate</p>
            <p className="text-xs text-gray-400 mt-1">Rebuilds both ledger AND cashflow entries. Use with caution.</p>
          </button>
        </div>

        {/* Warning */}
        <div className={`rounded-xl p-3 text-xs font-bold ${scope === 'full' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
          {scope === 'full'
            ? '⚠️ Full regenerate will delete ALL PO-linked cashflow entries and rebuild them. Manual cashflow entries are preserved.'
            : '✅ Safe mode — only rebuilds supplier ledger entries from POs. Your cashflow entries are untouched.'}
        </div>

        {/* What will be rebuilt */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Will Rebuild:</p>
          <p className="text-xs text-gray-600 font-semibold">✅ Advance payment ledger entries</p>
          <p className="text-xs text-gray-600 font-semibold">✅ Goods received ledger entries</p>
          <p className="text-xs text-gray-600 font-semibold">✅ Short delivery credit notes</p>
          {scope === 'full' && <>
            <p className="text-xs text-gray-600 font-semibold">✅ Advance payment cashflow entries</p>
          </>}
          <p className="text-[10px] text-gray-400 font-bold mt-2">🔒 Preserved: Manual ledger entries, expenses, financing, sales</p>
        </div>

        <button onClick={runRegenerate} disabled={loading}
          className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition ${scope === 'full' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#FA5600] hover:bg-[#E04A00] text-white'} disabled:opacity-50`}>
          {loading ? '⏳ Regenerating...' : `🔄 Run ${scope === 'full' ? 'Full' : 'Ledger'} Regenerate`}
        </button>
      </div>

      {/* Result log */}
      {result && (
        <div className="bg-white rounded-2xl border-2 border-green-200 p-5 space-y-3">
          <p className="font-black text-sm uppercase tracking-widest text-green-700">✅ Regeneration Complete</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="font-black text-lg text-red-600">{result.ledgerDeleted}</p>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Ledger Entries Deleted</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="font-black text-lg text-green-600">{result.ledgerCreated}</p>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Ledger Entries Created</p>
            </div>
            {result.cashDeleted > 0 && <>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="font-black text-lg text-red-600">{result.cashDeleted}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Cashflow Deleted</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="font-black text-lg text-green-600">{result.cashCreated}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Cashflow Created</p>
              </div>
            </>}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 space-y-1 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Processing Log:</p>
            {result.log?.map((line: string, i: number) => (
              <p key={i} className="text-xs font-mono text-gray-600">{line}</p>
            ))}
          </div>
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

// ─── FINANCING ───────────────────────────────────────────────────────────────
const FINANCING_TYPES = [
  { value: 'opening_capital',  label: 'Opening Capital',  desc: 'Initial money you put in',     color: 'bg-green-100 text-green-700',  dir: 'income'  },
  { value: 'capital_infusion', label: 'Capital Infusion', desc: 'Adding more money later',       color: 'bg-green-100 text-green-700',  dir: 'income'  },
  { value: 'loan_received',    label: 'Loan Received',    desc: 'Borrowed money',                color: 'bg-blue-100 text-blue-700',    dir: 'income'  },
  { value: 'loan_repayment',   label: 'Loan Repayment',   desc: 'Paying back a loan',            color: 'bg-red-100 text-red-600',      dir: 'expense' },
  { value: 'owner_withdrawal', label: 'Owner Withdrawal', desc: 'Taking money out for yourself', color: 'bg-orange-100 text-orange-700',dir: 'expense' },
];

function FinancingModule({ showMsg }: any) {
  const { token } = useAuth();
  const [entries, setEntries]   = useState<any[]>([]);
  const [summary, setSummary]   = useState<any>({});
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [form, setForm] = useState({
    type: 'capital_infusion',
    amount: '',
    cashAmount: '',
    bankAmount: '',
    source: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const isSplit = Number(form.cashAmount) > 0 || Number(form.bankAmount) > 0;

  const fetchData = () => {
    setLoading(true);
    fetch('/api/business?module=financing', { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setSummary(d.summary || {}); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setForm({ type: 'capital_infusion', amount: '', cashAmount: '', bankAmount: '', source: '', date: new Date().toISOString().split('T')[0], notes: '' });
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (e: any) => {
    setEditId(e._id);
    setForm({
      type: e.type,
      amount: String(e.amount),
      cashAmount: String(e.cashAmount || ''),
      bankAmount: String(e.bankAmount || ''),
      source: e.source || '',
      date: new Date(e.date).toISOString().split('T')[0],
      notes: e.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      showMsg('Please enter a valid amount.', 'error'); return;
    }
    const cashAmt = Number(form.cashAmount) || 0;
    const bankAmt = Number(form.bankAmount) || 0;
    if (cashAmt + bankAmt > 0 && Math.abs(cashAmt + bankAmt - Number(form.amount)) > 1) {
      showMsg('Cash + Bank amounts must equal the total amount.', 'error'); return;
    }

    setFormLoading(true);
    try {
      const body: any = {
        type: form.type,
        amount: Number(form.amount),
        cashAmount: cashAmt,
        bankAmount: bankAmt,
        source: form.source,
        date: form.date,
        notes: form.notes,
      };
      if (editId) body.id = editId;

      const res = await fetch('/api/business?module=financing', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success || data._id) {
        showMsg(editId ? '✅ Entry updated!' : '✅ Entry recorded!', 'success');
        resetForm();
        fetchData();
      } else {
        showMsg(data.error || 'Failed.', 'error');
      }
    } catch { showMsg('Network error.', 'error'); }
    finally { setFormLoading(false); }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this financing entry? This will also remove it from Cash Flow.')) return;
    await fetch('/api/business?module=financing', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ id }),
    });
    showMsg('Entry deleted.', 'success');
    fetchData();
  };

  const selectedType = FINANCING_TYPES.find(t => t.value === form.type);

  return (
    <div className="space-y-4">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center">
          <p className="text-lg font-black text-green-700">{fmt(summary.netCapital || 0)}</p>
          <p className="text-[10px] font-bold text-green-600 uppercase">Net Capital</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 text-center">
          <p className="text-lg font-black text-blue-700">{fmt(summary.totalCapital || 0)}</p>
          <p className="text-[10px] font-bold text-blue-600 uppercase">Total Invested</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center">
          <p className="text-lg font-black text-red-700">{fmt(summary.totalWithdrawn || 0)}</p>
          <p className="text-[10px] font-bold text-red-600 uppercase">Withdrawn</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${(summary.outstandingLoan || 0) > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-lg font-black ${(summary.outstandingLoan || 0) > 0 ? 'text-orange-700' : 'text-gray-500'}`}>{fmt(summary.outstandingLoan || 0)}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase">Loan Balance</p>
        </div>
      </div>

      {/* ── Cash vs Bank split ── */}
      {(summary.totalCash > 0 || summary.totalBank > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-sm">💵</span>
            </div>
            <div>
              <p className="font-black text-sm text-gray-900">{fmt(summary.totalCash || 0)}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Cash In Hand</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-sm">🏦</span>
            </div>
            <div>
              <p className="font-black text-sm text-gray-900">{fmt(summary.totalBank || 0)}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase">In Bank</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Entry Button ── */}
      <div className="flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition"
        >
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">
              {editId ? 'Edit Entry' : 'New Financing Entry'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Entry Type *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FINANCING_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 transition ${form.type === t.value ? 'border-[#FA5600] bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${t.color}`}>
                      {t.dir === 'income' ? '↑ IN' : '↓ OUT'}
                    </span>
                    <span className="text-sm font-black text-gray-800">{t.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 ml-0">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Total Amount */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Total Amount (₹) *</label>
              <input type="number" min="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="e.g. 10000"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                Source / Reference
              </label>
              <input value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                placeholder={form.type === 'loan_received' ? 'Bank name or lender' : 'e.g. Personal savings'}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Notes</label>
              <input value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
          </div>

          {/* Cash / Bank split — optional */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
              Split by Mode <span className="text-gray-300 font-bold normal-case tracking-normal">(optional — leave blank if all cash or all bank)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">💵 Cash Amount</label>
                <input type="number" min="0" value={form.cashAmount}
                  onChange={e => setForm(f => ({ ...f, cashAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">🏦 Bank Amount</label>
                <input type="number" min="0" value={form.bankAmount}
                  onChange={e => setForm(f => ({ ...f, bankAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
            </div>
            {isSplit && Number(form.amount) > 0 && (
              <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold ${Math.abs((Number(form.cashAmount) || 0) + (Number(form.bankAmount) || 0) - Number(form.amount)) <= 1 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {Math.abs((Number(form.cashAmount) || 0) + (Number(form.bankAmount) || 0) - Number(form.amount)) <= 1
                  ? `✅ Cash + Bank = ₹${((Number(form.cashAmount) || 0) + (Number(form.bankAmount) || 0)).toLocaleString('en-IN')} — matches total`
                  : `⚠️ Cash (₹${Number(form.cashAmount || 0).toLocaleString('en-IN')}) + Bank (₹${Number(form.bankAmount || 0).toLocaleString('en-IN')}) = ₹${((Number(form.cashAmount) || 0) + (Number(form.bankAmount) || 0)).toLocaleString('en-IN')} — must equal ₹${Number(form.amount).toLocaleString('en-IN')}`
                }
              </div>
            )}
          </div>

          {/* Preview */}
          {form.amount && selectedType && (
            <div className={`rounded-xl px-4 py-3 text-xs font-bold ${selectedType.dir === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {selectedType.dir === 'income' ? '↑ Income' : '↓ Expense'}: {selectedType.label}
              {form.source ? ` — ${form.source}` : ''} · ₹{Number(form.amount || 0).toLocaleString('en-IN')}
              <span className="text-gray-400 font-normal ml-1">(will sync to Cash Flow automatically)</span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => withDupCheck(`financing-${form.type}-${form.amount}-${form.source}`, 'Financing Entry', handleSubmit)} disabled={formLoading}
              className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60">
              {formLoading ? 'Saving...' : editId ? 'Update Entry' : 'Record Entry'}
            </button>
            <button onClick={resetForm} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Entry List ── */}
      {loading ? <LoadingCards count={3} /> : entries.length === 0 ? (
        <EmptyState icon="💼" text="No financing entries yet — record your opening capital to get started" />
      ) : (
        <div className="space-y-2">
          {entries.map((e: any) => {
            const typeInfo = FINANCING_TYPES.find(t => t.value === e.type);
            return (
              <div key={e._id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm ${typeInfo?.dir === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {typeInfo?.dir === 'income' ? '↑' : '↓'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-sm text-gray-900">{typeInfo?.label || e.type}</p>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${typeInfo?.color || 'bg-gray-100 text-gray-500'}`}>
                      {typeInfo?.dir === 'income' ? 'Money In' : 'Money Out'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {e.source ? `${e.source} · ` : ''}
                    {e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    {e.cashAmount > 0 && e.bankAmount > 0 && ` · 💵 ₹${e.cashAmount?.toLocaleString('en-IN')} + 🏦 ₹${e.bankAmount?.toLocaleString('en-IN')}`}
                    {e.notes ? ` · ${e.notes}` : ''}
                  </p>
                </div>
                <p className={`font-black text-sm shrink-0 ${typeInfo?.dir === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {typeInfo?.dir === 'income' ? '+' : '-'}{fmt(e.amount)}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(e)} className="text-blue-400 hover:text-blue-600 transition">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteEntry(e._id)} className="text-gray-300 hover:text-red-400 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
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

// ─── USERS MODULE (admin only) ────────────────────────────────────────────────
const ROLE_COLORS: Record<UserRole, string> = {
  admin:        'bg-purple-100 text-purple-800',
  manager:      'bg-blue-100 text-blue-700',
  associate:    'bg-orange-100 text-orange-700',
  cashier:      'bg-green-100 text-green-700',
  delivery_boy: 'bg-indigo-100 text-indigo-700',
};
const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin', manager: 'Manager', associate: 'Associate', cashier: 'Cashier', delivery_boy: 'Delivery Boy',
};

function UsersModule({ showMsg }: any) {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'associate' as UserRole, password: '', pin: '' });
  const [showPass, setShowPass] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const isPinRole = ['associate', 'cashier'].includes(form.role);
  const isDeliveryBoyRole = form.role === 'delivery_boy';

  // Build request headers using the JWT token from AuthContext
  function usersHeaders(withContentType = false): Record<string, string> {
    return {
      ...(withContentType ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(token),
    };
  }

  const loadUsers = () => {
    setLoading(true);
    fetch('/api/business?module=users', { headers: usersHeaders() })
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const openAdd = () => {
    setEditUser(null);
    setForm({ name: '', email: '', role: 'associate', password: '', pin: '' });
    setShowPass(false); setShowForm(true);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email || '', role: u.role, password: '', pin: '' });
    setShowPass(false); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { showMsg('Name is required.', 'error'); return; }
    if (['admin', 'manager'].includes(form.role) && !editUser && (!form.email || !form.password)) {
      showMsg('Email and password required for this role.', 'error'); return;
    }
    if (['associate', 'cashier'].includes(form.role) && !editUser && form.pin.length < 4) {
      showMsg('4-digit PIN required.', 'error'); return;
    }
    if (form.role === 'delivery_boy' && !editUser && !form.password) {
      showMsg('Password required for delivery boy.', 'error'); return;
    }
    setFormLoading(true);
    try {
      const body: any = { name: form.name, role: form.role };
      if (editUser) body.id = editUser._id;
      if (form.email) body.email = form.email;
      if (['admin', 'manager'].includes(form.role) && form.password) body.password = form.password;
      if (['associate', 'cashier'].includes(form.role) && form.pin) body.pin = form.pin;
      if (form.role === 'delivery_boy' && form.password) body.password = form.password;
      const res = await fetch('/api/business?module=users', {
        method: editUser ? 'PUT' : 'POST',
        headers: usersHeaders(true),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success || data._id) {
        showMsg(editUser ? '✅ User updated!' : '✅ User created!', 'success');
        setShowForm(false); loadUsers();
      } else { showMsg(data.error || 'Failed.', 'error'); }
    } catch { showMsg('Network error.', 'error'); }
    finally { setFormLoading(false); }
  };

  const toggleActive = async (u: any) => {
    try {
      await fetch('/api/business?module=users', {
        method: 'PUT',
        headers: usersHeaders(true),
        body: JSON.stringify({ id: u._id, active: !u.active }),
      });
      showMsg(u.active ? 'User deactivated.' : '✅ User activated.', 'success');
      loadUsers();
    } catch { showMsg('Failed.', 'error'); }
  };

  // Access already guarded by AdminPanel login

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 font-bold">{users.filter(u => u.active).length} active staff</p>
        <button onClick={openAdd} className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
          <span key={r} className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r]}</span>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">{editUser ? 'Edit User' : 'New User'}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ravi Kumar"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole, pin: '', password: '' }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white">
                <option value="admin">Admin (full access)</option>
                <option value="manager">Manager (reports + POS)</option>
                <option value="associate">Associate (POS only)</option>
                <option value="cashier">Cashier (checkout only)</option>
                <option value="delivery_boy">Delivery Boy (delivery app + password)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Email {isPinRole || isDeliveryBoyRole ? '(optional)' : '*'}</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="staff@tags.com"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
            </div>
            {(!isPinRole || isDeliveryBoyRole) && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                  Password {editUser ? '(leave blank to keep)' : '*'}{isDeliveryBoyRole ? ' — used for Staff Login' : ''}
                </label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none pr-10" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            {isPinRole && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">PIN {editUser ? '(leave blank to keep)' : '* (4–6 digits)'}</label>
                <input type="password" inputMode="numeric" value={form.pin}
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="e.g. 1234"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => withDupCheck(`user-${form.name}-${form.role}`, editUser ? 'Update User' : 'Create User', handleSubmit)} disabled={formLoading}
              className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60">
              {formLoading ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <LoadingCards count={3} /> : users.length === 0 ? (
        <EmptyState icon="👤" text="No users yet — add your first team member" />
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u._id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 ${!u.active ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 font-black text-[#FA5600] text-lg">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-sm text-gray-900">{u.name}</p>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role as UserRole]}`}>{ROLE_LABELS[u.role as UserRole]}</span>
                  {!u.active && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {u.email || '— PIN only'} · Last login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(u)} className="text-blue-400 hover:text-blue-600 text-xs font-bold uppercase transition flex items-center gap-1">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => toggleActive(u)} className={`text-xs font-bold uppercase transition flex items-center gap-1 ${u.active ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}`}>
                  {u.active ? <><UserX className="w-3.5 h-3.5" /> Deactivate</> : <><UserCheck className="w-3.5 h-3.5" /> Activate</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BusinessEmbed;
