'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { Search, Plus, Pencil, Trash2, Check, X, ChevronDown, SlidersHorizontal } from 'lucide-react';

const EMOJI_ICONS = ['🍔', '🚗', '💡', '🎬', '💪', '🛍️', '🍽️', '📦', '🏥', '📚', '✈️', '🏠', '💻', '🎮', '⚽', '🛒', '☕', '🎵', '💊', '🐾', '🧴', '🍕', '🚂', '🎪'];
const PRESET_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280', '#f97316', '#84cc16'];

interface DeleteState {
  categoryId: string;
  reassignToId: string;
}

interface EditState {
  categoryId: string;
  name: string;
}

interface AddState {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'both';
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

export default function CategoryFilterBar() {
  const {
    categories, selectedCategoryIds, setSelectedCategoryIds,
    addCategory, updateCategory, deleteCategory, selectedMonth, selectedYear, getCategoryTotal,
    currency,
  } = useBudgetStore();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [addState, setAddState] = useState<AddState | null>(null);
  const [filterTab, setFilterTab] = useState<'expense' | 'income'>('expense');
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 320 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Global filter only applies to expense views — show expense categories
  const expenseCategories = categories.filter(c => c.type !== 'income');
  const incomeCategories = categories.filter(c => c.type === 'income' || c.type === 'both');
  const tabCategories = filterTab === 'expense' ? expenseCategories : incomeCategories;

  // Compute dropdown position from trigger button rect (escapes all overflow clipping)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = 320;
    // Keep panel within viewport horizontally
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8);
    setDropdownPos({
      top: rect.bottom + 6,
      left: Math.max(8, left),
      width: panelWidth,
    });
  }, []);

  const openDropdown = () => {
    updatePosition();
    setIsOpen(true);
  };

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setEditState(null);
    setDeleteState(null);
    setAddState(null);
    setSearch('');
  }, []);

  // Close on outside click (check both trigger and panel)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closeDropdown]);

  // Reposition on scroll/resize so panel tracks the button
  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, { capture: true });
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Focus search when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => searchRef.current?.focus(), 60);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDropdown(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeDropdown]);

  const allSelected = selectedCategoryIds.length === 0;
  const filteredCats = tabCategories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (id: string) => allSelected || selectedCategoryIds.includes(id);

  const toggle = (id: string) => {
    if (allSelected) {
      setSelectedCategoryIds([id]);
    } else {
      const current = new Set(selectedCategoryIds);
      if (current.has(id)) {
        current.delete(id);
        setSelectedCategoryIds(current.size === 0 ? [] : [...current]);
      } else {
        current.add(id);
        setSelectedCategoryIds(current.size === expenseCategories.length ? [] : [...current]);
      }
    }
  };

  const selectAll = () => setSelectedCategoryIds([]);

  const triggerLabel = allSelected
    ? 'All Categories'
    : `${selectedCategoryIds.length} of ${expenseCategories.length} selected`;

  // ── Edit category ─────────────────────────────────────────────────────────
  const startEdit = (id: string, name: string) => {
    setEditState({ categoryId: id, name });
    setDeleteState(null);
  };
  const saveEdit = () => {
    if (!editState || !editState.name.trim()) return;
    updateCategory(editState.categoryId, { name: editState.name.trim() });
    setEditState(null);
  };

  // ── Delete category ───────────────────────────────────────────────────────
  const startDelete = (id: string) => {
    const deletingCat = categories.find(c => c.id === id);
    const isIncome = deletingCat?.type === 'income';
    const fallback = isIncome
      ? (categories.find(c => c.id !== id && c.name === 'Other Income') ?? categories.find(c => c.id !== id && c.type === 'income'))
      : (categories.find(c => c.id !== id && c.name === 'Other Expenses') ?? categories.find(c => c.id !== id && c.type !== 'income'));
    setDeleteState({ categoryId: id, reassignToId: fallback?.id ?? '' });
    setEditState(null);
  };
  const confirmDelete = () => {
    if (!deleteState) return;
    deleteCategory(deleteState.categoryId, deleteState.reassignToId || undefined);
    setDeleteState(null);
    if (!allSelected) {
      setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== deleteState.categoryId));
    }
  };

  // ── Add category ──────────────────────────────────────────────────────────
  const startAdd = () => {
    setAddState({ name: '', icon: '📦', color: '#6b7280', type: filterTab === 'income' ? 'income' : 'expense' });
    setEditState(null);
    setDeleteState(null);
  };
  const confirmAdd = () => {
    if (!addState || !addState.name.trim()) return;
    addCategory({
      id: `cat_${Date.now()}`,
      name: addState.name.trim(),
      icon: addState.icon,
      color: addState.color,
      type: addState.type,
    });
    setAddState(null);
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        onClick={() => isOpen ? closeDropdown() : openDropdown()}
        className="flex items-center gap-2 rounded-xl text-sm font-semibold transition-all"
        style={{
          padding: '8px 14px',
          background: allSelected ? '#fff' : '#4f46e5',
          color: allSelected ? '#374151' : '#fff',
          border: allSelected ? '1px solid #e8ecf0' : '1px solid #4f46e5',
          boxShadow: allSelected
            ? '0 1px 4px rgba(0,0,0,0.06)'
            : '0 2px 8px rgba(79,70,229,0.3)',
          flexShrink: 0,
        }}
      >
        <SlidersHorizontal size={14} />
        {triggerLabel}
        <ChevronDown
          size={13}
          style={{
            opacity: 0.7,
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {/* ── Dropdown panel — rendered at document body level via fixed positioning ── */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #e8ecf0',
            borderRadius: 16,
            boxShadow: '0 16px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            animation: 'cfbDropIn 0.18s cubic-bezier(0.34,1.4,0.64,1) forwards',
          }}
        >
          {/* ── Header: search + actions ── */}
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f3f4f6' }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
              />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search categories…"
                style={{
                  width: '100%',
                  background: '#f4f6f9',
                  border: '1px solid #e8ecf0',
                  borderRadius: 10,
                  padding: '7px 10px 7px 30px',
                  fontSize: 12,
                  color: '#111827',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                onBlur={e => { e.target.style.borderColor = '#e8ecf0'; }}
              />
            </div>

            {/* All / Reset row */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={selectAll}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: allSelected ? '#4f46e5' : '#f4f6f9',
                  color: allSelected ? '#fff' : '#6b7280',
                  border: allSelected ? '1px solid #4f46e5' : '1px solid #e8ecf0',
                  fontFamily: 'inherit',
                  transition: 'all 0.12s',
                }}
              >
                All Categories
              </button>
              <button
                onClick={() => setSelectedCategoryIds([])}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: '#f4f6f9', border: '1px solid #e8ecf0', color: '#6b7280',
                  fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* ── Expense / Income tab strip ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', background: '#fafbfc' }}>
            {(['expense', 'income'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: 'transparent', border: 'none', fontFamily: 'inherit',
                  color: filterTab === tab ? '#4f46e5' : '#9ca3af',
                  borderBottom: filterTab === tab ? '2px solid #4f46e5' : '2px solid transparent',
                  textTransform: 'capitalize',
                  transition: 'color 0.15s',
                }}
              >
                {tab === 'expense' ? `Expense (${expenseCategories.length})` : `Income (${incomeCategories.length})`}
              </button>
            ))}
          </div>

          {/* ── Category list ── */}
          <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
            {filteredCats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 12px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>🔍</div>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                  {search ? `No categories matching "${search}"` : 'No categories yet'}
                </p>
              </div>
            ) : (
              filteredCats.map(cat => {
                const isEditingThis = editState?.categoryId === cat.id;
                const isDeletingThis = deleteState?.categoryId === cat.id;
                const monthTotal = getCategoryTotal(cat.id, selectedMonth, selectedYear);
                const sel = isSelected(cat.id);

                return (
                  <div key={cat.id}>
                    {/* Main row */}
                    {!isDeletingThis && (
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px',
                          background: filterTab === 'expense' && sel ? `${cat.color}10` : 'transparent',
                          cursor: isEditingThis ? 'default' : 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onClick={() => {
                          if (!isEditingThis && filterTab === 'expense') toggle(cat.id);
                        }}
                        onMouseEnter={e => {
                          if (!isEditingThis) (e.currentTarget as HTMLDivElement).style.background =
                            filterTab === 'expense' && sel ? `${cat.color}18` : '#f9fafb';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.background =
                            filterTab === 'expense' && sel ? `${cat.color}10` : 'transparent';
                        }}
                      >
                        {/* Checkbox — expense tab only */}
                        {filterTab === 'expense' && (
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            background: sel ? cat.color : '#fff',
                            border: `1.5px solid ${sel ? cat.color : '#d1d5db'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.12s, border-color 0.12s',
                          }}>
                            {sel && <Check size={10} color="#fff" strokeWidth={3} />}
                          </div>
                        )}

                        {/* Category icon */}
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: `${cat.color}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                        }}>
                          {cat.icon}
                        </div>

                        {/* Name / edit input */}
                        {isEditingThis ? (
                          <input
                            autoFocus
                            type="text"
                            value={editState.name}
                            onChange={e => setEditState({ ...editState, name: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') setEditState(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              flex: 1, borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: '#f4f6f9', border: '1.5px solid #4f46e5',
                              padding: '3px 8px', color: '#111827', fontFamily: 'inherit', outline: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: 12, fontWeight: 600, color: '#111827', margin: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {cat.name}
                            </p>
                            {monthTotal > 0 && (
                              <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
                                {currency === 'INR' ? '₹' : '$'}{monthTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} this month
                              </p>
                            )}
                          </div>
                        )}

                        {/* Edit / Delete actions */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                          onClick={e => e.stopPropagation()}
                        >
                          {isEditingThis ? (
                            <>
                              <button
                                onClick={saveEdit}
                                style={{ color: '#10b981', padding: '3px 4px', borderRadius: 5, background: '#ecfdf5', border: 'none', cursor: 'pointer' }}
                                title="Save"
                              >
                                <Check size={12} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => setEditState(null)}
                                style={{ color: '#9ca3af', padding: '3px 4px', borderRadius: 5, background: '#f4f6f9', border: 'none', cursor: 'pointer' }}
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(cat.id, cat.name)}
                                style={{ color: '#9ca3af', padding: '4px', borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}
                                title="Rename"
                                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={() => startDelete(cat.id)}
                                style={{ color: '#9ca3af', padding: '4px', borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}
                                title="Delete"
                                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#f87171'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Delete confirmation */}
                    {isDeletingThis && (
                      <div style={{
                        padding: '10px 12px',
                        background: '#fef2f2',
                        borderTop: '1px solid #fee2e2',
                        borderBottom: '1px solid #fee2e2',
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4, marginTop: 0 }}>
                          Delete &quot;{cat.name}&quot;?
                        </p>
                        <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8, marginTop: 0 }}>
                          Reassign transactions to:
                        </p>
                        <select
                          value={deleteState.reassignToId}
                          onChange={e => setDeleteState({ ...deleteState, reassignToId: e.target.value })}
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 12, marginBottom: 8,
                            background: '#fff', border: '1px solid #e8ecf0', color: '#111827',
                            fontFamily: 'inherit', outline: 'none',
                          }}
                        >
                          {categories
                            .filter(c => c.id !== cat.id && (c.type === cat.type || c.type === 'both' || cat.type === 'both'))
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={confirmDelete}
                            style={{
                              flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                              background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
                            }}
                          >
                            Delete &amp; Reassign
                          </button>
                          <button
                            onClick={() => setDeleteState(null)}
                            style={{
                              flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              background: '#f4f6f9', color: '#6b7280', border: '1px solid #e8ecf0', cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Add new category ── */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 12px 10px' }}>
            {!addState ? (
              <button
                onClick={startAdd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  color: '#4f46e5', background: '#f0f0ff', border: '1px dashed #c7d2fe',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e8e9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f0f0ff')}
              >
                <Plus size={13} />
                Add {filterTab === 'income' ? 'Income' : 'Expense'} Category
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  New {addState.type} category
                </p>

                {/* Name */}
                <input
                  autoFocus
                  type="text"
                  value={addState.name}
                  onChange={e => setAddState({ ...addState, name: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAddState(null); }}
                  placeholder="Category name"
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
                    background: '#f4f6f9', border: '1.5px solid #e8ecf0', color: '#111827',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                  onBlur={e => { e.target.style.borderColor = '#e8ecf0'; }}
                />

                {/* Type */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['expense', 'income', 'both'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setAddState({ ...addState, type: t })}
                      style={{
                        flex: 1, padding: '5px 4px', borderRadius: 7, fontSize: 10, fontWeight: 600,
                        background: addState.type === t ? '#4f46e5' : '#f4f6f9',
                        color: addState.type === t ? '#fff' : '#6b7280',
                        border: addState.type === t ? '1px solid #4f46e5' : '1px solid #e8ecf0',
                        cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Icon + Color */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={addState.icon}
                    onChange={e => setAddState({ ...addState, icon: e.target.value })}
                    style={{
                      flex: '0 0 auto', padding: '6px 8px', borderRadius: 8, fontSize: 16,
                      background: '#f4f6f9', border: '1px solid #e8ecf0', color: '#111827',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  >
                    {EMOJI_ICONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                    {PRESET_COLORS.map(clr => (
                      <button
                        key={clr}
                        onClick={() => setAddState({ ...addState, color: clr })}
                        style={{
                          width: 18, height: 18, borderRadius: 4, background: clr,
                          border: 'none', cursor: 'pointer',
                          outline: addState.color === clr ? `2.5px solid ${clr}` : 'none',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Confirm / Cancel */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={confirmAdd}
                    disabled={!addState.name.trim()}
                    style={{
                      flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: addState.name.trim() ? '#4f46e5' : '#e8ecf0',
                      color: addState.name.trim() ? '#fff' : '#9ca3af',
                      border: 'none', cursor: addState.name.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                    }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddState(null)}
                    style={{
                      flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: '#f4f6f9', color: '#6b7280', border: '1px solid #e8ecf0',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
