'use client';

import { useState, useRef, useEffect } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { getCategoryBudget } from '@/types';
import { ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

const EMOJI_ICONS = ['🍔', '🚗', '💡', '🎬', '💪', '🛍️', '🍽️', '📦', '🏥', '📚', '✈️', '🏠', '💻', '🎮', '⚽', '🛒'];

export default function BudgetEditor() {
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategory, selectedMonth, selectedYear, currency } = useBudgetStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    icon: '📦',
    budget: '',
    color: '#6b7280',
  });

  const totalBudget = categories.reduce((sum, cat) => sum + getCategoryBudget(cat, selectedMonth, selectedYear), 0);

  const handleEditStart = (category: any) => {
    setEditingId(category.id);
    setEditData({ ...category, budget: getCategoryBudget(category, selectedMonth, selectedYear) });
  };

  const handleSave = () => {
    if (!editData.name || !editData.budget || editData.budget < 0) {
      alert('Please fill in all fields with valid values');
      return;
    }
    const budgetKey = `${selectedYear}-${selectedMonth}`;
    const newBudget = parseFloat(editData.budget);
    updateCategory(editingId!, {
      name: editData.name,
      icon: editData.icon,
      color: editData.color,
      monthlyBudgets: { ...categories.find(c => c.id === editingId)?.monthlyBudgets, [budgetKey]: newBudget },
    });
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleAddCategory = () => {
    if (!newCategoryForm.name || !newCategoryForm.budget) {
      alert('Please fill in all fields');
      return;
    }

    const newCategory = {
      id: `cat_${Date.now()}`,
      name: newCategoryForm.name,
      icon: newCategoryForm.icon,
      color: newCategoryForm.color,
      budget: parseFloat(newCategoryForm.budget),
      monthlyBudgets: { [`${selectedYear}-${selectedMonth}`]: parseFloat(newCategoryForm.budget) },
    };

    addCategory(newCategory);
    setNewCategoryForm({
      name: '',
      icon: '📦',
      budget: '',
      color: '#6b7280',
    });
    setShowAddForm(false);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      reorderCategory(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < categories.length - 1) {
      reorderCategory(index, index + 1);
    }
  };

  return (
    <div className="dark-card glow-amber" ref={cardRef} style={{ border: '1px solid rgba(217,119,6,0.15)' }}>
      <div
        className="flex items-center justify-between cursor-pointer p-7"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #d97706, #b45309)' }} />
          <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>MANAGE CATEGORIES</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Total Budget</p>
            <p className="graffiti-font text-3xl" style={{ color: '#d97706' }}>
              {formatCurrency(totalBudget, currency)}
            </p>
          </div>
          <ChevronDown
            size={24}
            style={{ color: '#d97706' }}
            className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="px-7 pb-7 space-y-6">
          {/* Add Category Form */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-neon-green w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add New Category
            </button>
          )}

          {showAddForm && (
            <div className="p-6 rounded-xl space-y-4" style={{ background: '#f8f9fc', border: '1px solid #e2e8f0' }}>
              <h3 className="graffiti-font text-xl" style={{ color: '#1e293b' }}>Add New Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={newCategoryForm.name}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, name: e.target.value })}
                    placeholder="e.g., Pet Care"
                    className="dark-input w-full px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
                    Budget Amount
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={newCategoryForm.budget}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, budget: e.target.value })}
                    placeholder="0.00"
                    className="dark-input w-full px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
                    Icon
                  </label>
                  <select
                    value={newCategoryForm.icon}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, icon: e.target.value })}
                    className="dark-select w-full px-4 py-2 text-lg"
                  >
                    {EMOJI_ICONS.map((emoji) => (
                      <option key={emoji} value={emoji}>{emoji}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
                    Color
                  </label>
                  <input
                    type="color"
                    value={newCategoryForm.color}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, color: e.target.value })}
                  className="w-full rounded-lg h-10 cursor-pointer" style={{ background: '#f8f9fc', border: '1px solid #e2e8f0' }}
                />
              </div>
            </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleAddCategory}
                  className="btn-neon-green flex-1 px-4 py-2 rounded-lg"
                >
                  Add Category
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg font-bold transition-colors" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Categories List */}
          <div className="space-y-4">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className="p-5 rounded-xl transition-colors duration-200" style={{ background: '#f8f9fc', border: '1px solid #e2e8f0' }}
              >
                {editingId === category.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
                          Name
                        </label>
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          className="dark-input w-full px-4 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
                          Budget
                        </label>
                        <input
                          type="number"
                          step="100"
                          value={editData.budget}
                          onChange={(e) =>
                            setEditData({ ...editData, budget: e.target.value })
                          }
                          className="dark-input w-full px-4 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
                          Icon
                        </label>
                        <select
                          value={editData.icon}
                          onChange={(e) =>
                            setEditData({ ...editData, icon: e.target.value })
                          }
                          className="dark-select w-full px-4 py-2 text-lg"
                        >
                          {EMOJI_ICONS.map((emoji) => (
                            <option key={emoji} value={emoji}>
                              {emoji}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
                          Color
                        </label>
                        <input
                          type="color"
                          value={editData.color}
                          onChange={(e) =>
                            setEditData({ ...editData, color: e.target.value })
                          }
                          className="w-full rounded-lg h-10 cursor-pointer" style={{ background: '#f8f9fc', border: '1px solid #e2e8f0' }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={handleSave}
                        className="btn-neon-green flex-1 px-4 py-2 rounded-lg"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-2 rounded-lg font-bold transition-colors" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-4xl">{category.icon}</span>
                      <div>
                        <p className="font-bold" style={{ color: '#0f172a' }}>{category.name}</p>
                        <p className="text-sm font-mono" style={{ color: '#475569' }}>
                          {formatCurrency(getCategoryBudget(category, selectedMonth, selectedYear), currency)}
                        </p>
                      </div>
                      <div
                        className="w-5 h-5 rounded-full ml-auto"
                        style={{ backgroundColor: category.color }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move up"
                        className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: '#64748b', background: '#f1f5f9' }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === categories.length - 1}
                        title="Move down"
                        className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: '#64748b', background: '#f1f5f9' }}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        onClick={() => handleEditStart(category)}
                        className="px-4 py-2 rounded-lg font-bold text-sm transition-all" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', boxShadow: '0 4px 12px rgba(168,85,247,0.3)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-2 rounded-lg transition-all hover:scale-110" style={{ color: '#fb7185', background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}
                        title="Delete category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
