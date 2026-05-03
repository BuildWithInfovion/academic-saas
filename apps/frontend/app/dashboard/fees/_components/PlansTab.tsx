'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { AcademicYear, AcademicUnit, FeeCategory, FeePlan } from '@/lib/types';
import { fmt } from './fees-utils';

export function PlansTab({ years, units }: { years: AcademicYear[]; units: AcademicUnit[] }) {
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const [selYear, setSelYear] = useState<string>('');
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FeePlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<{ planId: string; itemId?: string } | null>(null);
  const [editItemCat, setEditItemCat] = useState('');
  const [editItemAmt, setEditItemAmt] = useState('');
  const [addingInst, setAddingInst] = useState<{ itemId: string } | null>(null);
  const [instLabel, setInstLabel] = useState('');
  const [instAmt, setInstAmt] = useState('');
  const [instDate, setInstDate] = useState('');
  const [assigningPlan, setAssigningPlan] = useState<string | null>(null);
  const [assignedUnits, setAssignedUnits] = useState<Set<string>>(new Set());
  const [copyingPlan, setCopyingPlan] = useState<FeePlan | null>(null);
  const [copyTargetYear, setCopyTargetYear] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const yearId = selYear || currentYear?.id || '';

  useEffect(() => { if (currentYear) setSelYear(currentYear.id); }, [currentYear]);

  const loadPlans = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try { const p = await apiFetch<FeePlan[]>(`/fees/plans?yearId=${yearId}`); setPlans(p); }
    catch { } finally { setLoading(false); }
  }, [yearId]);

  useEffect(() => { void loadPlans(); }, [loadPlans]);
  useEffect(() => { void apiFetch<FeeCategory[]>('/fees/categories').then(setCategories); }, []);

  const createPlan = async () => {
    if (!newPlanName.trim() || !yearId) return;
    try {
      await apiFetch('/fees/plans', { method: 'POST', body: JSON.stringify({ name: newPlanName.trim(), academicYearId: yearId }) });
      setNewPlanName(''); setCreating(false); await loadPlans();
    } catch (e: any) { showToast(e.message); }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Delete this fee plan?')) return;
    await apiFetch(`/fees/plans/${planId}`, { method: 'DELETE' }); await loadPlans();
    if (selectedPlan?.id === planId) setSelectedPlan(null);
  };

  const addItem = async () => {
    if (!selectedPlan || !editItemCat || !editItemAmt) return;
    try {
      await apiFetch(`/fees/plans/${selectedPlan.id}/items`, { method: 'POST', body: JSON.stringify({ feeCategoryId: editItemCat, totalAmount: parseFloat(editItemAmt) }) });
      setEditingItem(null); setEditItemCat(''); setEditItemAmt('');
      const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p); await loadPlans();
    } catch (e: any) { showToast(e.message); }
  };

  const deleteItem = async (itemId: string) => {
    if (!selectedPlan || !confirm('Remove this fee item?')) return;
    try { await apiFetch(`/fees/plans/${selectedPlan.id}/items/${itemId}`, { method: 'DELETE' }); const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p); await loadPlans(); }
    catch (e: any) { showToast(e.message); }
  };

  const addInst = async () => {
    if (!selectedPlan || !addingInst || !instLabel || !instAmt) return;
    try {
      await apiFetch(`/fees/plans/${selectedPlan.id}/items/${addingInst.itemId}/installments`, { method: 'POST', body: JSON.stringify({ label: instLabel, amount: parseFloat(instAmt), dueDate: instDate || undefined }) });
      setAddingInst(null); setInstLabel(''); setInstAmt(''); setInstDate('');
      const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p);
    } catch (e: any) { showToast(e.message); }
  };

  const deleteInst = async (itemId: string, instId: string) => {
    if (!selectedPlan || !confirm('Delete this installment?')) return;
    try { await apiFetch(`/fees/plans/${selectedPlan.id}/items/${itemId}/installments/${instId}`, { method: 'DELETE' }); const p = await apiFetch<FeePlan>(`/fees/plans/${selectedPlan.id}`); setSelectedPlan(p); }
    catch (e: any) { showToast(e.message); }
  };

  const openAssign = (plan: FeePlan) => {
    setAssigningPlan(plan.id);
    setAssignedUnits(new Set(plan.classMaps.map((c) => c.academicUnitId)));
  };

  const saveAssign = async () => {
    if (!assigningPlan) return;
    try {
      await apiFetch(`/fees/plans/${assigningPlan}/classes`, { method: 'POST', body: JSON.stringify({ academicUnitIds: [...assignedUnits] }) });
      setAssigningPlan(null); await loadPlans();
      if (selectedPlan?.id === assigningPlan) { const p = await apiFetch<FeePlan>(`/fees/plans/${assigningPlan}`); setSelectedPlan(p); }
    } catch (e: any) { showToast(e.message); }
  };

  const handleCopy = async () => {
    if (!copyingPlan || !copyTargetYear) return;
    try {
      await apiFetch(`/fees/plans/${copyingPlan.id}/copy`, { method: 'POST', body: JSON.stringify({ targetAcademicYearId: copyTargetYear }) });
      showToast('Plan copied!'); setCopyingPlan(null); setCopyTargetYear(''); await loadPlans();
    } catch (e: any) { showToast(e.message); }
  };

  const unitName = (u: AcademicUnit) => u.displayName || u.name;
  const totalFee = (plan: FeePlan) => plan.items.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">{toast}</div>}

      {assigningPlan && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-900 mb-4">Assign Classes to Plan</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {units.map((u) => (
                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={assignedUnits.has(u.id)} onChange={() => setAssignedUnits((p) => { const n = new Set(p); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })} className="rounded border-slate-300 text-indigo-600" />
                  <span className="text-sm text-slate-800">{unitName(u)}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAssigningPlan(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => void saveAssign()} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {copyingPlan && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">Copy Plan to Another Year</h3>
            <p className="text-sm text-slate-500 mb-4">Copying: <strong>{copyingPlan.name}</strong></p>
            <select value={copyTargetYear} onChange={(e) => setCopyTargetYear(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-5">
              <option value="">Select target year…</option>
              {years.filter((y) => y.id !== copyingPlan.academicYearId).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => { setCopyingPlan(null); setCopyTargetYear(''); }} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => void handleCopy()} disabled={!copyTargetYear} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Copy</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold text-slate-800 text-lg flex-1">Fee Plans</h2>
        <select value={selYear} onChange={(e) => setSelYear(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
        </select>
        <button onClick={() => setCreating(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ New Plan</button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Plan Name</label>
            <input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void createPlan()} placeholder="e.g. Regular Students Plan" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
          </div>
          <button onClick={() => void createPlan()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Create</button>
          <button onClick={() => { setCreating(false); setNewPlanName(''); }} className="px-4 py-2 border border-slate-300 text-sm text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
        </div>
      )}

      {loading && <div className="text-center py-10 text-slate-400 text-sm">Loading plans…</div>}

      {!loading && plans.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="text-slate-400 text-sm">No fee plans for this academic year.</div>
          <div className="text-slate-400 text-xs mt-1">Create one to start collecting fees using the plan-based system.</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all ${selectedPlan?.id === plan.id ? 'border-indigo-500 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`} onClick={() => setSelectedPlan(plan)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-slate-900">{plan.name}</div>
                {plan.description && <div className="text-xs text-slate-500 mt-0.5">{plan.description}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setCopyingPlan(plan); setCopyTargetYear(''); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Copy to another year">⧉</button>
                <button onClick={(e) => { e.stopPropagation(); void deletePlan(plan.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">✕</button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Fee items</span><span className="font-medium">{plan.items.length}</span></div>
              <div className="flex justify-between text-slate-600"><span>Annual total</span><span className="font-medium text-slate-900">{fmt(totalFee(plan))}</span></div>
              <div className="flex justify-between text-slate-600"><span>Classes</span><span className="font-medium">{plan.classMaps.length > 0 ? plan.classMaps.map((c) => unitName(c.academicUnit)).join(', ') : <span className="text-amber-600">None assigned</span>}</span></div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); openAssign(plan); }} className="mt-3 w-full px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50">Assign Classes</button>
          </div>
        ))}
      </div>

      {selectedPlan && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Editing: {selectedPlan.name}</h3>
            <div className="text-sm text-slate-500">Annual total: <span className="font-semibold text-slate-900">{fmt(totalFee(selectedPlan))}</span></div>
          </div>
          <div className="divide-y divide-slate-100">
            {selectedPlan.items.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium text-slate-900">{item.feeCategory.name}</span>
                    <span className="text-xs text-slate-500 ml-2">({item.feeCategory.type})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">{fmt(item.totalAmount)}</span>
                    <button onClick={() => void deleteItem(item.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                </div>
                <div className="space-y-1.5 ml-4">
                  {item.installments.map((inst) => (
                    <div key={inst.id} className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                      <span className="text-slate-700 flex-1">{inst.label}</span>
                      <span className="text-slate-500">{inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No due date'}</span>
                      <span className="font-medium text-slate-800">{fmt(inst.amount)}</span>
                      <button onClick={() => void deleteInst(item.id, inst.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                  {addingInst?.itemId === item.id ? (
                    <div className="flex gap-2 ml-5 flex-wrap">
                      <input value={instLabel} onChange={(e) => setInstLabel(e.target.value)} placeholder="Label (e.g. Term 1)" className="border border-slate-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <input type="number" value={instAmt} onChange={(e) => setInstAmt(e.target.value)} placeholder="Amount" className="border border-slate-300 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <input type="date" value={instDate} onChange={(e) => setInstDate(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <button onClick={() => void addInst()} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">Add</button>
                      <button onClick={() => setAddingInst(null)} className="px-2 py-1 border border-slate-300 text-xs rounded hover:bg-slate-50">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingInst({ itemId: item.id }); setInstLabel(''); setInstAmt(''); setInstDate(''); }} className="ml-5 text-xs text-indigo-600 hover:text-indigo-800">+ Add installment</button>
                  )}
                </div>
              </div>
            ))}

            <div className="p-5">
              {editingItem?.planId === selectedPlan.id ? (
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Fee Category</label>
                    <select value={editItemCat} onChange={(e) => setEditItemCat(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select category…</option>
                      {categories.filter((c) => !selectedPlan.items.find((i) => i.feeCategoryId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Annual Amount (₹)</label>
                    <input type="number" value={editItemAmt} onChange={(e) => setEditItemAmt(e.target.value)} placeholder="e.g. 12000" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <button onClick={() => void addItem()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Add</button>
                  <button onClick={() => setEditingItem(null)} className="px-4 py-2 border border-slate-300 text-sm text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setEditingItem({ planId: selectedPlan.id }); setEditItemCat(''); setEditItemAmt(''); }} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add Fee Item</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
