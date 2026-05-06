import React, { useState, useEffect } from 'react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'playgear2024';

interface Category {
  _id: string;
  name: string;
  parentId: string | null;
}

export function ManageCategories() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMainCategory, setNewMainCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [selectedParent, setSelectedParent] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handlePasswordSubmit = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      setPasswordError('Incorrect password.');
      setPasswordInput('');
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      showMessage('Failed to load categories.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchCategories();
  }, [isAuthenticated]);

  const showMessage = (text: string, type: string) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const addMainCategory = async () => {
    if (!newMainCategory.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMainCategory.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`✅ "${newMainCategory}" added!`, 'success');
        setNewMainCategory('');
        fetchCategories();
      } else {
        showMessage(data.error || 'Failed to add category.', 'error');
      }
    } catch {
      showMessage('Something went wrong.', 'error');
    }
  };

  const addSubCategory = async () => {
    if (!newSubCategory.trim() || !selectedParent) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubCategory.trim(), parentId: selectedParent }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`✅ "${newSubCategory}" added!`, 'success');
        setNewSubCategory('');
        fetchCategories();
      } else {
        showMessage(data.error || 'Failed to add subcategory.', 'error');
      }
    } catch {
      showMessage('Something went wrong.', 'error');
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also delete all its subcategories.`)) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`🗑️ "${name}" deleted.`, 'success');
        fetchCategories();
      }
    } catch {
      showMessage('Failed to delete.', 'error');
    }
  };

  const startEditing = (cat: Category) => {
    setEditingId(cat._id);
    setEditingName(cat.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editingName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('✅ Category updated!', 'success');
        setEditingId(null);
        setEditingName('');
        fetchCategories();
      } else {
        showMessage(data.error || 'Failed to update.', 'error');
      }
    } catch {
      showMessage('Something went wrong.', 'error');
    }
  };

  const mainCategories = categories.filter(c => !c.parentId);
  const getSubCategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your password to manage categories</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded-lg p-3 text-center text-lg focus:ring-2 focus:ring-orange-400 outline-none mb-3"
          />
          {passwordError && <p className="text-red-500 text-sm text-center mb-3">{passwordError}</p>}
          <button onClick={handlePasswordSubmit}
            className="w-full bg-[#FA5600] text-white font-bold py-3 rounded-lg hover:bg-[#E04A00] transition">
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8 mt-6 mb-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900">Manage Categories</h1>
        <button onClick={() => setIsAuthenticated(false)}
          className="text-sm text-gray-400 hover:text-red-500 transition">🔓 Lock</button>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg text-center font-semibold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Add Main Category */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-black text-gray-800 mb-4">➕ Add Main Category</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newMainCategory}
            onChange={(e) => setNewMainCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMainCategory()}
            placeholder="e.g. Electronics, Toys, Fashion..."
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none"
          />
          <button onClick={addMainCategory}
            className="bg-[#FA5600] text-white font-bold px-6 rounded-lg hover:bg-[#E04A00] transition whitespace-nowrap">
            Add
          </button>
        </div>
      </div>

      {/* Add Subcategory */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-black text-gray-800 mb-4">➕ Add Subcategory</h2>
        <div className="flex flex-col gap-3">
          <select
            value={selectedParent}
            onChange={(e) => setSelectedParent(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none"
          >
            <option value="">Select Main Category</option>
            {mainCategories.map(cat => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <input
              type="text"
              value={newSubCategory}
              onChange={(e) => setNewSubCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubCategory()}
              placeholder="e.g. RC Toys, Boys Toys, Kids Toys..."
              className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-orange-400 outline-none"
              disabled={!selectedParent}
            />
            <button onClick={addSubCategory} disabled={!selectedParent}
              className={`font-bold px-6 rounded-lg transition whitespace-nowrap text-white ${selectedParent ? 'bg-[#FA5600] hover:bg-[#E04A00]' : 'bg-gray-300 cursor-not-allowed'}`}>
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Category List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-black text-gray-800 mb-4">📋 All Categories</h2>

        {loading ? (
          <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
        ) : mainCategories.length === 0 ? (
          <p className="text-gray-400 text-sm">No categories yet. Add one above!</p>
        ) : (
          <div className="space-y-4">
            {mainCategories.map(cat => (
              <div key={cat._id} className="border border-gray-200 rounded-xl overflow-hidden">

                {/* Main Category Row */}
                <div className="flex justify-between items-center bg-orange-50 px-4 py-3 gap-2">
                  {editingId === cat._id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(cat._id)}
                        className="flex-1 border border-orange-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveEdit(cat._id)}
                        className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-lg hover:bg-green-600 transition">
                        Save
                      </button>
                      <button onClick={cancelEditing}
                        className="bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-lg hover:bg-gray-300 transition">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-black text-gray-900 uppercase tracking-wide text-sm">
                        📁 {cat.name}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => startEditing(cat)}
                          className="text-blue-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition">
                          Edit
                        </button>
                        <button onClick={() => deleteCategory(cat._id, cat.name)}
                          className="text-red-400 hover:text-red-600 text-xs font-bold uppercase tracking-widest transition">
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Subcategories */}
                <div className="divide-y divide-gray-100">
                  {getSubCategories(cat._id).length === 0 ? (
                    <p className="text-xs text-gray-400 px-6 py-2 italic">No subcategories yet</p>
                  ) : (
                    getSubCategories(cat._id).map(sub => (
                      <div key={sub._id} className="flex justify-between items-center px-6 py-2 hover:bg-gray-50 gap-2">
                        {editingId === sub._id ? (
                          <div className="flex gap-2 flex-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit(sub._id)}
                              className="flex-1 border border-orange-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(sub._id)}
                              className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-lg hover:bg-green-600 transition">
                              Save
                            </button>
                            <button onClick={cancelEditing}
                              className="bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-lg hover:bg-gray-300 transition">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-gray-700">↳ {sub.name}</span>
                            <div className="flex gap-2">
                              <button onClick={() => startEditing(sub)}
                                className="text-blue-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition">
                                Edit
                              </button>
                              <button onClick={() => deleteCategory(sub._id, sub.name)}
                                className="text-red-400 hover:text-red-600 text-xs font-bold uppercase tracking-widest transition">
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
