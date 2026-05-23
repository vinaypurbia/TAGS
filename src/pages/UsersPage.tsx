import React, { useState, useEffect } from 'react';
import { Plus, Edit2, UserX, UserCheck, X, Eye, EyeOff } from 'lucide-react';
import { useAuth, authHeaders, UserRole } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// UsersModule — drop this into BusinessEmbed.tsx
// 1. Add to imports at top:  import { UsersModule } from './UsersModule';
//    OR just paste the function directly into BusinessEmbed.tsx
// 2. Add 'users' to the Module type on line 8
// 3. Add to tabs array:  { id: 'users', label: 'Users', icon: Users }
// 4. Add render:          {module === 'users' && <UsersModule showMsg={showMsg} />}
// ─────────────────────────────────────────────────────────────────────────────

interface StaffUser {
  _id: string;
  name: string;
  email?: string;
  role: UserRole;
  active: boolean;
  lastLogin?: string;
  createdAt: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin:     'bg-purple-100 text-purple-800',
  manager:   'bg-blue-100 text-blue-700',
  associate: 'bg-orange-100 text-orange-700',
  cashier:   'bg-green-100 text-green-700',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin:     'Admin',
  manager:   'Manager',
  associate: 'Associate',
  cashier:   'Cashier',
};

export function UsersModule({ showMsg }: { showMsg: (text: string, type: string) => void }) {
  const { token, isAdmin } = useAuth();

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);

  const [form, setForm] = useState({ name: '', email: '', role: 'associate' as UserRole, password: '', pin: '' });
  const [showPass, setShowPass] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const isPinRole = ['associate', 'cashier'].includes(form.role);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/business?module=users', { headers: authHeaders(token) });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setEditUser(null);
    setForm({ name: '', email: '', role: 'associate', password: '', pin: '' });
    setShowPass(false);
    setShowForm(true);
  }

  function openEdit(u: StaffUser) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email || '', role: u.role, password: '', pin: '' });
    setShowPass(false);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.name) { showMsg('Name is required.', 'error'); return; }
    if (['admin', 'manager'].includes(form.role) && !editUser && (!form.email || !form.password)) {
      showMsg('Email and password required for this role.', 'error'); return;
    }
    if (['associate', 'cashier'].includes(form.role) && !editUser && form.pin.length < 4) {
      showMsg('4-digit PIN required.', 'error'); return;
    }

    setFormLoading(true);
    try {
      const body: any = { name: form.name, role: form.role };
      if (editUser) body.id = editUser._id;
      if (form.email) body.email = form.email;
      if (['admin', 'manager'].includes(form.role)) {
        if (form.password) body.password = form.password;
      }
      if (['associate', 'cashier'].includes(form.role)) {
        if (form.pin) body.pin = form.pin;
      }

      const res = await fetch('/api/business?module=users', {
        method: editUser ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success || data._id) {
        showMsg(editUser ? '✅ User updated!' : '✅ User created!', 'success');
        setShowForm(false);
        loadUsers();
      } else {
        showMsg(data.error || 'Failed.', 'error');
      }
    } catch { showMsg('Network error.', 'error'); }
    finally { setFormLoading(false); }
  }

  async function toggleActive(u: StaffUser) {
    try {
      await fetch('/api/business?module=users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ id: u._id, active: !u.active }),
      });
      showMsg(u.active ? 'User deactivated.' : '✅ User activated.', 'success');
      loadUsers();
    } catch { showMsg('Failed.', 'error'); }
  }

  if (!isAdmin) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-12 text-center">
        <p className="text-red-500 font-bold text-sm">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 font-bold">{users.filter(u => u.active).length} active staff</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-[#E04A00] transition"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Role legend */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
          <span key={r} className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${ROLE_COLORS[r]}`}>
            {ROLE_LABELS[r]}
          </span>
        ))}
      </div>

      {/* Add/Edit form — same style as other modules in BusinessEmbed */}
      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-[#FA5600] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">
              {editUser ? 'Edit User' : 'New User'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Full Name *</label>
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ravi Kumar"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Role *</label>
              <select
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole, pin: '', password: '' }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none bg-white"
              >
                <option value="admin">Admin (full access)</option>
                <option value="manager">Manager (reports + POS)</option>
                <option value="associate">Associate (POS only)</option>
                <option value="cashier">Cashier (checkout only)</option>
              </select>
            </div>

            {/* Email — required for admin/manager, optional for associate/cashier */}
            <div className={isPinRole ? '' : 'sm:col-span-1'}>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                Email {isPinRole ? '(optional)' : '*'}
              </label>
              <input
                type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="staff@tags.com"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"
              />
            </div>

            {/* Password for admin/manager */}
            {!isPinRole && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                  Password {editUser ? '(leave blank to keep)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* PIN for associate/cashier */}
            {isPinRole && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                  PIN {editUser ? '(leave blank to keep)' : '* (4–6 digits)'}
                </label>
                <input
                  type="password" inputMode="numeric"
                  value={form.pin}
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="e.g. 1234"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-[#FA5600] outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit} disabled={formLoading}
              className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-60"
            >
              {formLoading ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-3"><div className="w-10 h-10 bg-gray-200 rounded-xl shrink-0" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-1/3" /><div className="h-3 bg-gray-200 rounded w-1/4" /></div></div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">👤</div>
          <p className="text-gray-400 font-bold text-sm">No users yet — add your first team member</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u._id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 transition-opacity ${!u.active ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 font-black text-[#FA5600] text-lg">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-sm text-gray-900">{u.name}</p>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
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
                <button
                  onClick={() => toggleActive(u)}
                  className={`text-xs font-bold uppercase transition flex items-center gap-1 ${u.active ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}`}
                >
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
