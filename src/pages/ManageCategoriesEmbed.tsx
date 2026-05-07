import React, { useState, useEffect } from 'react';

interface Category {
  _id: string;
  name: string;
  parentId: string | null;
}

export function ManageCategoriesEmbed() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMainCategory, setNewMainCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [selectedParent, setSelectedParent] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // Track which main categories have their subcategory adder open
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [inlineSubName, setInlineSubName] = useState('');

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

  useEffect(() => { fetchCategories(); }, []);

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
      if (data.success || data._id) {
        showMessage(`✅ "${newMainCategory.trim()}" added!`, 'success');
        setNewMainCategory('');
        fetchCategories();
      } else {
        showMessage(data.error || 'Failed to add category.', 'error');
      }
    } catch {
      showMessage('Something went wrong.', 'error');
    }
  };

  const addSubCategory = async (parentId: string, name: string) => {
    if (!name.trim() || !parentId) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parentId }),
      });
      const data = await res.json();
      if (data.success || data._id) {
        showMessage(`✅ "${name.trim()}" added!`, 'success');
        setInlineSubName('');
        setAddingSubFor(null);
        fetchCategories();
      } else {
        showMessage(data.error || 'Failed to add subcategory.', 'error');
      }
    } catch {
      showMessage('Something went wrong.', 'error');
    }
  };

  const deleteCategory = async (id: string, name: string, hasChildren: boolean) => {
    const msg = hasChildren
      ? `Delete "${name}"? This will also delete all its subcategories.`
      : `Delete "${name}"?`;
    if (!confirm(msg)) return;
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

  const startEditing = (cat: Category) => { setEditingId(cat._id); setEditingName(cat.name); };
  const cancelEditing = () => { setEditingId(null); setEditingName(''); };

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

  return (
    <div className="space-y-6">

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-xl text-center font-semibold text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Add Main Category */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
          Add Main Category
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMainCategory}
            onChange={e => setNewMainCategory(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMainCategory()}
            placeholder="e.g. Electronics, Toys, Sports..."
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
          />
          <button
            onClick={addMainCategory}
            disabled={!newMainCategory.trim()}
            className="bg-[#FA5600] text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl hover:bg-[#E04A00] transition disabled:opacity-40">
            Add
          </button>
        </div>
      </div>

      {/* Category List with inline subcategory management */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">
          All Categories
        </h2>

        {loading ? (
          <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
        ) : mainCategories.length === 0 ? (
          <p className="text-gray-400 text-sm">No categories yet. Add one above!</p>
        ) : (
          <div className="space-y-3">
            {mainCategories.map(cat => {
              const subs = getSubCategories(cat._id);
              return (
                <div key={cat._id} className="border-2 border-gray-100 rounded-xl overflow-hidden">

                  {/* Main category row */}
                  <div className="flex justify-between items-center bg-orange-50 px-4 py-3 gap-2">
                    {editingId === cat._id ? (
                      <div className="flex gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(cat._id)}
                          className="flex-1 border border-orange-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-[#FA5600] outline-none"
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
                        <span className="font-black text-gray-900 uppercase tracking-wide text-sm flex items-center gap-2">
                          📁 {cat.name}
                          <span className="text-[10px] text-gray-400 font-bold normal-case">
                            {subs.length} sub{subs.length !== 1 ? 's' : ''}
                          </span>
                        </span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => { setAddingSubFor(addingSubFor === cat._id ? null : cat._id); setInlineSubName(''); }}
                            className="text-[#FA5600] hover:text-[#E04A00] text-xs font-black uppercase tracking-widest transition">
                            + Sub
                          </button>
                          <button onClick={() => startEditing(cat)}
                            className="text-blue-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition">
                            Edit
                          </button>
                          <button onClick={() => deleteCategory(cat._id, cat.name, subs.length > 0)}
                            className="text-red-400 hover:text-red-600 text-xs font-bold uppercase tracking-widest transition">
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Inline add subcategory row */}
                  {addingSubFor === cat._id && (
                    <div className="flex gap-2 px-4 py-3 bg-orange-50/50 border-t border-orange-100">
                      <input
                        type="text"
                        value={inlineSubName}
                        onChange={e => setInlineSubName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addSubCategory(cat._id, inlineSubName)}
                        placeholder={`New subcategory under ${cat.name}...`}
                        className="flex-1 border-2 border-orange-200 rounded-lg px-3 py-1.5 text-sm font-bold focus:border-[#FA5600] outline-none transition"
                        autoFocus
                      />
                      <button
                        onClick={() => addSubCategory(cat._id, inlineSubName)}
                        disabled={!inlineSubName.trim()}
                        className="bg-[#FA5600] text-white text-xs font-black px-3 py-1.5 rounded-lg hover:bg-[#E04A00] transition disabled:opacity-40">
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingSubFor(null); setInlineSubName(''); }}
                        className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Subcategory rows */}
                  <div className="divide-y divide-gray-100">
                    {subs.length === 0 ? (
                      <p className="text-xs text-gray-400 px-6 py-2 italic">No subcategories yet — click "+ Sub" to add one</p>
                    ) : (
                      subs.map(sub => (
                        <div key={sub._id} className="flex justify-between items-center px-6 py-2.5 hover:bg-gray-50 gap-2">
                          {editingId === sub._id ? (
                            <div className="flex gap-2 flex-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && saveEdit(sub._id)}
                                className="flex-1 border border-orange-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-[#FA5600] outline-none"
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
                              <span className="text-sm text-gray-700 flex items-center gap-1.5">
                                <span className="text-gray-400">↳</span> {sub.name}
                              </span>
                              <div className="flex gap-2">
                                <button onClick={() => startEditing(sub)}
                                  className="text-blue-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest transition">
                                  Edit
                                </button>
                                <button onClick={() => deleteCategory(sub._id, sub.name, false)}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
