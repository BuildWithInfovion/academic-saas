'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { usePortalAuthStore } from '@/store/portal-auth.store';

type Institution = { name: string; board?: string; address?: string; phone?: string; email?: string; logoUrl?: string; principalName?: string };

type Child = {
  id: string; firstName: string; lastName: string; admissionNo: string;
  academicUnit?: { displayName?: string; name?: string };
};

type LedgerInstallment = {
  id: string; label: string; amount: number; dueDate?: string | null;
  concession: number; netAmount: number; paid: number; balance: number;
  status: 'paid' | 'partial' | 'due' | 'overdue';
};

type LedgerItem = {
  feePlanItemId: string; feeCategoryId: string; categoryName: string;
  totalAmount: number; concession: number; netAmount: number;
  installments: LedgerInstallment[]; totalPaid: number; totalBalance: number;
};

type Ledger = {
  student: { id: string; name: string; admissionNo: string; className: string };
  plan: { id: string; name: string } | null;
  items: LedgerItem[];
  totalAnnual: number; totalConcession: number; totalNet: number;
  totalPaid: number; totalBalance: number;
};

type CollectionEntry = {
  id: string; receiptNo: string; amount: number; paymentMode: string;
  paidOn: string; categoryName: string; installmentLabel?: string | null;
  remarks?: string | null; source: 'legacy' | 'v2';
};

type AcademicYear = { id: string; name: string; isCurrent: boolean };

type ChildDue = {
  studentId: string; studentName: string; admissionNo: string; className: string;
  upcomingDues: {
    feeHeadId: string; feeHeadName: string; installmentName: string | null;
    dueDate: string; daysFromToday: number; amount: number; isPaid: boolean;
  }[];
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  paid:    { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  partial: { bg: '#fef9c3', color: '#854d0e', label: 'Partial' },
  due:     { bg: '#dbeafe', color: '#1d4ed8', label: 'Due' },
  overdue: { bg: '#fee2e2', color: '#dc2626', label: 'Overdue' },
};

export default function ParentFeesPage() {
  const user = usePortalAuthStore((s) => s.user);
  const [notLinked, setNotLinked] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [history, setHistory] = useState<CollectionEntry[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [institution, setInstitution] = useState<Institution>({ name: user?.institutionName ?? 'School' });
  const [childDues, setChildDues] = useState<ChildDue[]>([]);
  const [activeTab, setActiveTab] = useState<'ledger' | 'history'>('ledger');

  useEffect(() => {
    Promise.all([
      apiFetch('/students/child'),
      apiFetch('/academic/years'),
      apiFetch('/academic/institution'),
      apiFetch('/fees/my-children/upcoming-dues').catch(() => []),
    ])
      .then(([kids, yrs, inst, dues]) => {
        const childList = Array.isArray(kids) ? kids : [];
        setChildren(childList);
        if (childList.length === 0) { setNotLinked(true); return; }
        setSelectedChildId(childList[0].id);
        const yearList = Array.isArray(yrs) ? yrs : [];
        setYears(yearList);
        const cur = yearList.find((y: AcademicYear) => y.isCurrent) ?? yearList[0];
        if (cur) setYearId(cur.id);
        if (inst) setInstitution(inst as Institution);
        setChildDues(Array.isArray(dues) ? dues : []);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!selectedChildId || !yearId) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/fees/ledger/student/${selectedChildId}?yearId=${yearId}`),
      apiFetch(`/fees/collections/student/${selectedChildId}`),
    ])
      .then(([ldg, hist]) => {
        setLedger(ldg as Ledger);
        const payments = (hist as any)?.payments ?? [];
        setHistory(payments);
        setHistTotal((hist as any)?.total ?? 0);
      })
      .catch(() => { setLedger(null); setHistory([]); })
      .finally(() => setLoading(false));
  }, [selectedChildId, yearId]);

  if (notLinked) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5 text-sm text-ds-warning-text">
          Your child's record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  // Upcoming dues from legacy endpoint — still useful as a quick alert
  const unpaidDues = childDues.flatMap((cd) =>
    cd.upcomingDues.filter((d) => !d.isPaid).map((d) => ({ ...d, studentName: cd.studentName, className: cd.className }))
  ).sort((a, b) => a.daysFromToday - b.daysFromToday);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Fee Status</h1>
      <p className="text-sm text-ds-text3 mb-6">Fee dues and payment history for your child</p>

      {/* Upcoming due alerts */}
      {unpaidDues.length > 0 && (
        <div className="mb-6 rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Upcoming Due Dates</span>
            {unpaidDues.some((d) => d.daysFromToday < 0) && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {unpaidDues.filter((d) => d.daysFromToday < 0).length} overdue
              </span>
            )}
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {unpaidDues.slice(0, 5).map((d, i) => {
              const overdue = d.daysFromToday < 0;
              const today = d.daysFromToday === 0;
              const urgent = d.daysFromToday <= 7 && d.daysFromToday >= 0;
              const timingLabel = overdue
                ? `${Math.abs(d.daysFromToday)} day${Math.abs(d.daysFromToday) !== 1 ? 's' : ''} overdue`
                : today ? 'Due today'
                : `Due in ${d.daysFromToday} day${d.daysFromToday !== 1 ? 's' : ''}`;
              const chipCls = overdue ? 'bg-red-100 text-red-700' : urgent ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-700';
              return (
                <div key={i} className={`px-5 py-3 flex items-center justify-between ${overdue ? 'bg-red-50/30' : ''}`}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                      {d.feeHeadName}
                      {d.installmentName && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {d.installmentName}</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {d.studentName} · Due {new Date(d.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chipCls}`}>{timingLabel}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{fmt(d.amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Child selector */}
      {children.length > 1 && (
        <div className="mb-5 flex gap-3 items-center">
          <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Child</label>
          <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}
            className="field" style={{ width: 'auto' }}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
          <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Year</label>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)}
            className="field" style={{ width: 'auto' }}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
      )}
      {children.length === 1 && years.length > 1 && (
        <div className="mb-5 flex gap-3 items-center">
          <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Academic Year</label>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)}
            className="field" style={{ width: 'auto' }}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>
      ) : (
        <>
          {/* Summary cards */}
          {ledger && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Annual Fee', val: ledger.totalAnnual, cls: '' },
                { label: 'Concession', val: ledger.totalConcession, cls: 'text-indigo-600' },
                { label: 'Total Paid', val: ledger.totalPaid, cls: 'text-green-700' },
                { label: 'Balance Due', val: ledger.totalBalance, cls: ledger.totalBalance > 0 ? 'text-red-600' : 'text-green-700' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className={`text-xl font-bold ${cls}`} style={!cls ? { color: 'var(--text-1)' } : {}}>{fmt(val)}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-2)' }}>
            {([['ledger', 'Installment Details'], ['history', 'Payment History']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === key ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'}`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'ledger' && (
            <>
              {!ledger ? (
                <p className="py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No fee data available.</p>
              ) : !ledger.plan ? (
                <div className="rounded-xl p-5 text-sm text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  No fee plan assigned for this academic year. Please contact the school.
                </div>
              ) : (
                <>
                  {ledger.plan && (
                    <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
                      Fee Plan: <span className="font-medium" style={{ color: 'var(--text-2)' }}>{ledger.plan.name}</span>
                    </p>
                  )}
                  {ledger.items.map((item) => (
                    <div key={item.feePlanItemId} className="rounded-xl overflow-hidden mb-4"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{item.categoryName}</span>
                          {item.concession > 0 && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                              Concession {fmt(item.concession)}
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs" style={{ color: 'var(--text-3)' }}>
                          Paid {fmt(item.totalPaid)} of {fmt(item.netAmount)}
                          {item.totalBalance > 0 && (
                            <span className="ml-2 font-semibold text-red-600">Balance {fmt(item.totalBalance)}</span>
                          )}
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead style={{ background: 'var(--bg-2)' }}>
                          <tr>
                            <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Installment</th>
                            <th className="text-right px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Amount</th>
                            <th className="text-right px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Paid</th>
                            <th className="text-right px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Balance</th>
                            <th className="px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.installments.map((inst) => {
                            const chip = STATUS_CHIP[inst.status] ?? STATUS_CHIP.due;
                            return (
                              <tr key={inst.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                                <td className="px-5 py-3">
                                  <span className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>{inst.label}</span>
                                  {inst.dueDate && (
                                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                                      Due {new Date(inst.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-right text-xs" style={{ color: 'var(--text-2)' }}>{fmt(inst.netAmount)}</td>
                                <td className="px-5 py-3 text-right text-xs font-medium text-green-700">{fmt(inst.paid)}</td>
                                <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: inst.balance > 0 ? '#dc2626' : '#15803d' }}>
                                  {fmt(inst.balance)}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                    style={{ background: chip.bg, color: chip.color }}>
                                    {chip.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Payment History</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {history.length} payment(s) · Total {fmt(histTotal)}
                </p>
              </div>
              {history.length === 0 ? (
                <p className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No payments recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: 'var(--bg-2)' }}>
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Receipt No</th>
                        <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Fee / Installment</th>
                        <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Date</th>
                        <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Mode</th>
                        <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((c) => (
                        <tr key={c.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-3)' }}>{c.receiptNo}</td>
                          <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-1)' }}>
                            {c.categoryName}
                            {c.installmentLabel && <span style={{ color: 'var(--text-3)' }}> · {c.installmentLabel}</span>}
                          </td>
                          <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                            {new Date(c.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3 text-xs capitalize" style={{ color: 'var(--text-2)' }}>{c.paymentMode}</td>
                          <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-1)' }}>
                            {fmt(c.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
