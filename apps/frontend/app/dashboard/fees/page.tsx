'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface FeeHead { id: string; name: string; isCustom: boolean; }
interface AcademicUnit { id: string; name: string; displayName?: string; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface Student { id: string; firstName: string; lastName: string; admissionNo: string; academicUnitId?: string; }
interface FeePayment { id: string; receiptNo: string; amount: number; paymentMode: string; paidOn: string; feeHead: FeeHead; remarks?: string; }
interface FeeStructure { id: string; feeHeadId: string; amount: number; installmentName?: string; dueDate?: string; feeHead: FeeHead; }
interface Defaulter { id: string; firstName: string; lastName: string; admissionNo: string; due: number; paid: number; balance: number; }

const MODE_OPTIONS = ['cash', 'online', 'cheque', 'dd', 'neft', 'upi'];
const STANDARD_FEE_HEADS = ['Tuition Fee', 'Library Fee', 'Lab Fee', 'Activity Fee', 'Sports Fee', 'Exam Fee', 'Development Fee', 'Transport Fee'];

export default function FeesPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'collect' | 'structure' | 'defaulters' | 'heads' | 'daily'>('collect');

  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  // ── Collect Fee ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentPayments, setStudentPayments] = useState<FeePayment[]>([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [pForm, setPForm] = useState({ feeHeadId: '', amount: '', paymentMode: 'cash', paidOn: new Date().toISOString().split('T')[0], remarks: '' });
  const [paying, setPaying] = useState(false);

  // ── Fee Structure ──────────────────────────────────────────────────────────
  const [structUnit, setStructUnit] = useState('');
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [structForm, setStructForm] = useState({ feeHeadId: '', amount: '', installmentName: '', dueDate: '' });
  const [savingStruct, setSavingStruct] = useState(false);
  const [loadingStructures, setLoadingStructures] = useState(false);

  // ── Defaulters ─────────────────────────────────────────────────────────────
  const [defUnit, setDefUnit] = useState('');
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [loadingDef, setLoadingDef] = useState(false);

  // ── Fee Heads ──────────────────────────────────────────────────────────────
  const [newHeadName, setNewHeadName] = useState('');
  const [addingHead, setAddingHead] = useState(false);

  // ── Daily Collection ───────────────────────────────────────────────────────
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState<{ payments: any[]; total: number } | null>(null);

  useEffect(() => {
    if (!user?.institutionId) return;
    Promise.all([
      apiFetch('/fees/heads'),
      apiFetch('/academic/units/leaf'),
      apiFetch('/academic/years'),
    ]).then(([heads, u, y]) => {
      setFeeHeads(Array.isArray(heads) ? heads : []);
      setUnits(Array.isArray(u) ? u : u.data || []);
      const ys: AcademicYear[] = Array.isArray(y) ? y : y.data || [];
      setYears(ys);
      const cur = ys.find((yr) => yr.isCurrent);
      if (cur) setCurrentYearId(cur.id);
    }).catch(() => {});
  }, [user?.institutionId]);

  useEffect(() => {
    if (!user?.institutionId) return;
    apiFetch('/students?page=1&limit=500').then((res) => {
      setStudents(res.data || res || []);
    }).catch(() => {});
  }, [user?.institutionId]);

  // ── Collect Fee handlers ───────────────────────────────────────────────────
  const filteredStudents = searchQuery.length >= 2
    ? students.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const selectStudent = async (s: Student) => {
    setSelectedStudent(s);
    setSearchQuery(`${s.firstName} ${s.lastName} (${s.admissionNo})`);
    try {
      const res = await apiFetch(`/fees/payments/student/${s.id}`);
      setStudentPayments(res.payments || []);
      setPaymentTotal(res.total || 0);
    } catch { setStudentPayments([]); }
  };

  const recordPayment = async () => {
    if (!selectedStudent) return setError('Select a student first');
    if (!pForm.feeHeadId) return setError('Select a fee head');
    if (!pForm.amount || parseFloat(pForm.amount) <= 0) return setError('Enter a valid amount');
    setPaying(true);
    setError(null);
    try {
      await apiFetch('/fees/payments', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          feeHeadId: pForm.feeHeadId,
          academicYearId: currentYearId || undefined,
          amount: parseFloat(pForm.amount),
          paymentMode: pForm.paymentMode,
          paidOn: pForm.paidOn,
          remarks: pForm.remarks || undefined,
        }),
      });
      showSuccess('Payment recorded');
      setPForm((f) => ({ ...f, amount: '', remarks: '' }));
      const res = await apiFetch(`/fees/payments/student/${selectedStudent.id}`);
      setStudentPayments(res.payments || []);
      setPaymentTotal(res.total || 0);
    } catch (e: any) {
      setError(e.message || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  // ── Fee Structure handlers ─────────────────────────────────────────────────
  const loadStructures = async (unitId: string) => {
    if (!unitId || !currentYearId) return;
    setLoadingStructures(true);
    try {
      const res = await apiFetch(`/fees/structures?unitId=${unitId}&yearId=${currentYearId}`);
      setStructures(Array.isArray(res) ? res : []);
    } catch { setStructures([]); }
    finally { setLoadingStructures(false); }
  };

  useEffect(() => {
    if (structUnit && currentYearId) loadStructures(structUnit);
  }, [structUnit, currentYearId]);

  const saveStructure = async () => {
    if (!structUnit || !structForm.feeHeadId || !structForm.amount) return setError('Fill class, fee head, and amount');
    if (!currentYearId) return setError('No active academic year');
    setSavingStruct(true);
    setError(null);
    try {
      await apiFetch('/fees/structures', {
        method: 'POST',
        body: JSON.stringify({
          academicUnitId: structUnit,
          academicYearId: currentYearId,
          feeHeadId: structForm.feeHeadId,
          amount: parseFloat(structForm.amount),
          installmentName: structForm.installmentName || undefined,
          dueDate: structForm.dueDate || undefined,
        }),
      });
      showSuccess('Fee structure saved');
      setStructForm({ feeHeadId: '', amount: '', installmentName: '', dueDate: '' });
      await loadStructures(structUnit);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSavingStruct(false);
    }
  };

  const deleteStructure = async (id: string) => {
    if (!confirm('Remove this fee structure entry?')) return;
    try {
      await apiFetch(`/fees/structures/${id}`, { method: 'DELETE' });
      setStructures((prev) => prev.filter((s) => s.id !== id));
      showSuccess('Removed');
    } catch (e: any) { setError(e.message || 'Failed'); }
  };

  const totalFeeForClass = structures.reduce((sum, s) => sum + s.amount, 0);

  // ── Defaulters handlers ────────────────────────────────────────────────────
  const loadDefaulters = async () => {
    if (!currentYearId) return setError('No academic year selected');
    setLoadingDef(true);
    setError(null);
    try {
      const url = defUnit
        ? `/fees/defaulters?yearId=${currentYearId}&unitId=${defUnit}`
        : `/fees/defaulters?yearId=${currentYearId}`;
      const res = await apiFetch(url);
      setDefaulters(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load defaulters');
    } finally {
      setLoadingDef(false);
    }
  };

  // ── Fee Head handlers ──────────────────────────────────────────────────────
  const addFeeHead = async (name: string) => {
    if (!name.trim()) return;
    setAddingHead(true);
    try {
      const head = await apiFetch('/fees/heads', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setFeeHeads((prev) => [...prev, head]);
      setNewHeadName('');
      showSuccess(`"${name}" added`);
    } catch (e: any) {
      setError(e.message || 'Failed to add fee head');
    } finally {
      setAddingHead(false);
    }
  };

  const deleteFeeHead = async (id: string) => {
    if (!confirm('Delete this fee head?')) return;
    try {
      await apiFetch(`/fees/heads/${id}`, { method: 'DELETE' });
      setFeeHeads((prev) => prev.filter((h) => h.id !== id));
      showSuccess('Fee head deleted');
    } catch (e: any) {
      setError(e.message || 'Failed');
    }
  };

  // ── Daily Collection ───────────────────────────────────────────────────────
  const loadDailyCollection = async () => {
    try {
      const res = await apiFetch(`/fees/payments/daily?date=${dailyDate}`);
      setDailyData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load daily collection');
    }
  };

  const inp = 'border border-gray-300 p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white';
  const lbl = 'text-xs font-medium text-gray-600 block mb-1';
  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Fee Management</h1>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        <button className={tabBtn('collect')} onClick={() => setTab('collect')}>Collect Fee</button>
        <button className={tabBtn('structure')} onClick={() => setTab('structure')}>Fee Structure</button>
        <button className={tabBtn('defaulters')} onClick={() => { setTab('defaulters'); }}>Defaulters</button>
        <button className={tabBtn('daily')} onClick={() => { setTab('daily'); loadDailyCollection(); }}>Daily Collection</button>
        <button className={tabBtn('heads')} onClick={() => setTab('heads')}>Fee Heads</button>
      </div>

      {/* ── Collect Fee ── */}
      {tab === 'collect' && (
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3 space-y-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Student</p>
              <div className="relative">
                <input className={inp} placeholder="Search by name or admission no..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedStudent(null); }}
                />
                {filteredStudents.length > 0 && !selectedStudent && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                    {filteredStudents.map((s) => (
                      <button key={s.id} onClick={() => selectStudent(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0">
                        <span className="font-medium">{s.firstName} {s.lastName}</span>
                        <span className="text-gray-400 text-xs ml-2 font-mono">{s.admissionNo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Record Payment</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Fee Head *</label>
                  <select className={inp} value={pForm.feeHeadId} onChange={(e) => setPForm((f) => ({ ...f, feeHeadId: e.target.value }))}>
                    <option value="">Select Fee Head</option>
                    {feeHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Amount (₹) *</label>
                  <input className={inp} type="number" min="1" step="1" placeholder="0"
                    value={pForm.amount} onChange={(e) => setPForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Payment Mode</label>
                  <select className={inp} value={pForm.paymentMode} onChange={(e) => setPForm((f) => ({ ...f, paymentMode: e.target.value }))}>
                    {MODE_OPTIONS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Date</label>
                  <input type="date" className={inp} value={pForm.paidOn}
                    onChange={(e) => setPForm((f) => ({ ...f, paidOn: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Remarks</label>
                  <input className={inp} placeholder="Optional" value={pForm.remarks}
                    onChange={(e) => setPForm((f) => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>
              <button onClick={recordPayment} disabled={paying || !selectedStudent}
                className="mt-4 w-full bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {paying ? 'Recording...' : '+ Record Payment'}
              </button>
              {!selectedStudent && <p className="text-xs text-gray-400 mt-2 text-center">Select a student above first</p>}
            </div>
          </div>

          <div className="col-span-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {selectedStudent ? `${selectedStudent.firstName}'s Payments` : 'Payment History'}
                </p>
                {paymentTotal > 0 && (
                  <span className="text-sm font-semibold text-green-700">₹{paymentTotal.toLocaleString('en-IN')}</span>
                )}
              </div>
              {!selectedStudent ? (
                <p className="text-sm text-gray-400 text-center py-6">Select a student to view history</p>
              ) : studentPayments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No payments recorded</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {studentPayments.map((p) => (
                    <div key={p.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{p.feeHead.name}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{p.receiptNo}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">₹{p.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-gray-400">{new Date(p.paidOn).toLocaleDateString('en-IN')}</span>
                        <span className="text-xs text-gray-400 uppercase">{p.paymentMode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Fee Structure ── */}
      {tab === 'structure' && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            Set the annual fee amount per fee head for each class. This defines what each student in a class owes.
          </div>

          {/* Controls */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex gap-4 items-end flex-wrap mb-4">
              <div className="flex-1 min-w-[200px]">
                <label className={lbl}>Class *</label>
                <select className={inp} value={structUnit} onChange={(e) => setStructUnit(e.target.value)}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Academic Year</label>
                <select className={inp} value={currentYearId} onChange={(e) => setCurrentYearId(e.target.value)}>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' ✓' : ''}</option>)}
                </select>
              </div>
            </div>

            {structUnit && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Add Fee Entry</p>
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div>
                    <label className={lbl}>Fee Head *</label>
                    <select className={inp} value={structForm.feeHeadId}
                      onChange={(e) => setStructForm((f) => ({ ...f, feeHeadId: e.target.value }))}>
                      <option value="">Select</option>
                      {feeHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Amount (₹) *</label>
                    <input type="number" className={inp} min="0" placeholder="e.g. 5000"
                      value={structForm.amount}
                      onChange={(e) => setStructForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Installment</label>
                    <input className={inp} placeholder="e.g. Term 1, Annual"
                      value={structForm.installmentName}
                      onChange={(e) => setStructForm((f) => ({ ...f, installmentName: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Due Date</label>
                    <input type="date" className={inp}
                      value={structForm.dueDate}
                      onChange={(e) => setStructForm((f) => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                </div>
                <button onClick={saveStructure} disabled={savingStruct || !structForm.feeHeadId || !structForm.amount}
                  className="mt-3 bg-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {savingStruct ? 'Saving...' : '+ Add to Structure'}
                </button>
              </>
            )}
          </div>

          {/* Structure table */}
          {structUnit && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <span className="font-medium text-gray-800">
                  Fee Structure — {units.find((u) => u.id === structUnit)?.displayName || units.find((u) => u.id === structUnit)?.name}
                </span>
                {totalFeeForClass > 0 && (
                  <span className="text-sm font-semibold text-gray-700">
                    Total Annual: ₹{totalFeeForClass.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              {loadingStructures ? (
                <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
              ) : structures.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No fee structure defined for this class yet. Add fee entries above.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Fee Head</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Installment</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Due Date</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Amount (₹)</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {structures.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{s.feeHead.name}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{s.installmentName || 'Annual'}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {s.dueDate ? new Date(s.dueDate).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-800">
                          ₹{s.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => deleteStructure(s.id)}
                            className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-5 py-3 text-gray-700" colSpan={3}>Total</td>
                      <td className="px-5 py-3 text-right text-gray-800">₹{totalFeeForClass.toLocaleString('en-IN')}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Defaulters ── */}
      {tab === 'defaulters' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className={lbl}>Academic Year</label>
                <select className={inp} value={currentYearId} onChange={(e) => setCurrentYearId(e.target.value)}>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' ✓' : ''}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className={lbl}>Class (optional — leave blank for all classes)</label>
                <select className={inp} value={defUnit} onChange={(e) => setDefUnit(e.target.value)}>
                  <option value="">All Classes</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <button onClick={loadDefaulters} disabled={loadingDef || !currentYearId}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {loadingDef ? 'Loading...' : 'Load Defaulters'}
              </button>
            </div>
          </div>

          {defaulters.length === 0 && !loadingDef ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Click &ldquo;Load Defaulters&rdquo; to see students with outstanding balance.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <span className="font-medium text-gray-800">{defaulters.length} student(s) with outstanding balance</span>
                <span className="text-sm font-semibold text-red-600">
                  Total Due: ₹{defaulters.reduce((s, d) => s + d.balance, 0).toLocaleString('en-IN')}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Student</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Total Due (₹)</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Paid (₹)</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {defaulters.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-800">{d.firstName} {d.lastName}</div>
                        <div className="text-xs text-gray-400 font-mono">{d.admissionNo}</div>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">₹{d.due.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right text-green-700">₹{d.paid.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right font-semibold text-red-600">₹{d.balance.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Daily Collection ── */}
      {tab === 'daily' && (
        <div>
          <div className="flex gap-3 items-end mb-5">
            <div>
              <label className={lbl}>Date</label>
              <input type="date" className={inp} value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
            </div>
            <button onClick={loadDailyCollection}
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
              Load
            </button>
          </div>
          {dailyData && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between">
                <span className="font-medium text-gray-800">
                  {new Date(dailyDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="font-semibold text-green-700">Total: ₹{dailyData.total.toLocaleString('en-IN')}</span>
              </div>
              {dailyData.payments.length === 0 ? (
                <p className="p-8 text-center text-gray-400 text-sm">No collections on this date</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Receipt No', 'Student', 'Fee Head', 'Amount', 'Mode'].map((h) => (
                        <th key={h} className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyData.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{p.receiptNo}</td>
                        <td className="px-5 py-3 font-medium">{p.student.firstName} {p.student.lastName}</td>
                        <td className="px-5 py-3 text-gray-600">{p.feeHead.name}</td>
                        <td className="px-5 py-3 font-semibold">₹{p.amount.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3 text-gray-500 uppercase text-xs">{p.paymentMode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Fee Heads ── */}
      {tab === 'heads' && (
        <div className="max-w-lg space-y-4">
          {/* Quick-add standard heads */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Standard Fee Heads</p>
            <p className="text-xs text-gray-500 mb-3">Click to add any that are not already in your list:</p>
            <div className="flex flex-wrap gap-2">
              {STANDARD_FEE_HEADS.filter((name) => !feeHeads.some((h) => h.name === name)).map((name) => (
                <button key={name} onClick={() => addFeeHead(name)} disabled={addingHead}
                  className="px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-600 hover:border-black hover:text-black transition-colors disabled:opacity-50">
                  + {name}
                </button>
              ))}
              {STANDARD_FEE_HEADS.every((name) => feeHeads.some((h) => h.name === name)) && (
                <p className="text-xs text-gray-400">All standard heads added.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Add Custom Head</p>
            <div className="flex gap-2">
              <input className={inp + ' flex-1'} placeholder="e.g. Uniform Fee, Computer Fee"
                value={newHeadName} onChange={(e) => setNewHeadName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addFeeHead(newHeadName); }} />
              <button onClick={() => addFeeHead(newHeadName)} disabled={addingHead || !newHeadName.trim()}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {addingHead ? '...' : 'Add'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-800">All Fee Heads ({feeHeads.length})</span>
            </div>
            {feeHeads.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">No fee heads configured. Add standard heads above.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {feeHeads.map((h) => (
                  <li key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-800">{h.name}</span>
                    <div className="flex items-center gap-3">
                      {h.isCustom && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Custom</span>}
                      <button onClick={() => deleteFeeHead(h.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
