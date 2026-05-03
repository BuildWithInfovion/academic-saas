'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { FeeCategory } from '@/lib/types';
import { STANDARD_CATEGORIES, CATEGORY_TYPES } from './fees-utils';

const TYPE_COLORS: Record<string, string> = {
  TUITION: 'bg-blue-100 text-blue-800',
  TRANSPORT: 'bg-orange-100 text-orange-800',
  EXAM: 'bg-purple-100 text-purple-800',
  LAB: 'bg-teal-100 text-teal-800',
  LIBRARY: 'bg-emerald-100 text-emerald-800',
  ACTIVITY: 'bg-pink-100 text-pink-800',
  SPORTS: 'bg-yellow-100 text-yellow-800',
  DEVELOPMENT: 'bg-indigo-100 text-indigo-800',
  HOSTEL: 'bg-cyan-100 text-cyan-800',
  CUSTOM: 'bg-slate-100 text-slate-700',
};

export function CategoriesTab() {
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('CUSTOM');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => apiFetch<FeeCategory[]>('/fees/categories').then(setCategories);
  useEffect(() => { void load(); }, []);

  const addStandard = async (name: string, type: string) => {
    try { await apiFetch('/fees/categories', { method: 'POST', body: JSON.stringify({ name, type }) }); await load(); }
    catch (e: any) { if (!e.message?.includes('already exists')) showToast(e.message); }
  };

  const addCustom = async () => {
    if (!newName.trim()) return;
    try { await apiFetch('/fees/categories', { method: 'POST', body: JSON.stringify({ name: newName.trim(), type: newType }) }); setNewName(''); setAdding(false); await load(); }
    catch (e: any) { showToast(e.message); }
  };

  const deleteCat = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try { await apiFetch(`/fees/categories/${id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { showToast(e.message); }
  };

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Quick-Add Standard Categories</h3>
          <div className="grid grid-cols-2 gap-2">
            {STANDARD_CATEGORIES.map((s) => {
              const exists = categories.some((c) => c.name === s.name);
              return (
                <button key={s.name} onClick={() => void addStandard(s.name, s.type)} disabled={exists} className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${exists ? 'bg-green-50 border-green-200 text-green-700 cursor-default' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700'}`}>
                  {exists ? '✓ ' : '+ '}{s.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Add Custom Category</h3>
          {adding ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addCustom()} placeholder="Category name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {CATEGORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void addCustom()} className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Add</button>
                <button onClick={() => { setAdding(false); setNewName(''); }} className="px-4 py-2 border border-slate-300 text-sm text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">+ Add Custom Category</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">All Categories ({categories.length})</h3>
        </div>
        {categories.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No categories yet. Add standard categories above.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[c.type] ?? TYPE_COLORS['CUSTOM']}`}>{c.type}</span>
                <span className="flex-1 text-sm text-slate-800 font-medium">{c.name}</span>
                <button onClick={() => void deleteCat(c.id)} className="text-slate-400 hover:text-red-500 text-sm px-2 py-1 rounded hover:bg-red-50">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
