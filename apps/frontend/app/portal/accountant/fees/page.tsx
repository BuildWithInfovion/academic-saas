'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { usePortalAuthStore } from '@/store/portal-auth.store';

function printFeeReceipt(payment: Payment, studentName: string, admissionNo: string, institutionName: string) {
  const date = new Date(payment.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html><html><head><title>Fee Receipt ${payment.receiptNo}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:0}
  .receipt{max-width:480px;margin:32px auto;border:2px solid #1e293b;padding:0}
  .header{background:#1e293b;color:white;padding:16px 20px;text-align:center}
  .header h1{margin:0;font-size:18px;letter-spacing:1px}
  .header p{margin:4px 0 0;font-size:11px;opacity:.8}
  .receipt-no{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;font-size:12px}
  .body{padding:20px}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border:none}
  .label{color:#64748b;font-size:12px}
  .value{font-weight:600;text-align:right}
  .total{background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:12px 16px;margin-top:14px;display:flex;justify-content:space-between;align-items:center}
  .total .amount{font-size:22px;font-weight:700;color:#16a34a}
  .footer{text-align:center;color:#94a3b8;font-size:10px;padding:12px;border-top:1px solid #e2e8f0}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="receipt">
  <div class="header"><h1>${institutionName}</h1><p>Fee Payment Receipt</p></div>
  <div class="receipt-no"><span>Receipt No: <strong>${payment.receiptNo}</strong></span><span>Date: ${date}</span></div>
  <div class="body">
    <div class="row"><span class="label">Student Name</span><span class="value">${studentName}</span></div>
    <div class="row"><span class="label">Admission No</span><span class="value">${admissionNo}</span></div>
    <div class="row"><span class="label">Fee Head</span><span class="value">${payment.feeHead?.name ?? '—'}</span></div>
    <div class="row"><span class="label">Payment Mode</span><span class="value">${payment.paymentMode?.toUpperCase()}</span></div>
    ${payment.remarks ? `<div class="row"><span class="label">Remarks</span><span class="value">${payment.remarks}</span></div>` : ''}
    <div class="total"><span>Amount Paid</span><span class="amount">₹${payment.amount.toLocaleString('en-IN')}</span></div>
  </div>
  <div class="footer">This is a computer-generated receipt. No signature required.</div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=560,height=700');
  if (w) { w.document.write(html); w.document.close(); }
}

type Student = { id: string; firstName: string; lastName: string; admissionNo: string };
type Payment = {
  id: string; receiptNo: string; amount: number; paymentMode: string;
  paidOn: string; remarks?: string; feeHead: { name: string };
};
type Balance = {
  totalDue: number; totalPaid: number; balance: number;
  breakdown: { feeHeadName: string; due: number; paid: number; balance: number }[];
};
type FeeHead = { id: string; name: string };
type AcademicYear = { id: string; name: string; isCurrent: boolean };

export default function AccountantFeesPage() {
  const user = usePortalAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ feeHeadId: '', amount: '', paymentMode: 'cash', remarks: '' });
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/fees/heads'), apiFetch('/academic/years')])
      .then(([heads, yrs]) => {
        setFeeHeads(Array.isArray(heads) ? heads : []);
        const yearList = Array.isArray(yrs) ? yrs : [];
        setYears(yearList);
        const cur = yearList.find((y: AcademicYear) => y.isCurrent) ?? yearList[0];
        if (cur) setCurrentYearId(cur.id);
      })
      .catch(() => {});
  }, []);

  const searchStudents = useCallback(async () => {
    if (!search.trim()) return;
    setLoadingStudents(true); setError(null);
    try {
      const res = await apiFetch(`/students?search=${encodeURIComponent(search.trim())}`);
      setStudents(Array.isArray(res) ? res : (res as any)?.students ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoadingStudents(false); }
  }, [search]);

  const selectStudent = async (s: Student) => {
    setSelectedStudent(s);
    setStudents([]);
    setSearch('');
    setLoadingDetails(true);
    try {
      const [pRes, bal] = await Promise.all([
        apiFetch(`/fees/payments/student/${s.id}`),
        currentYearId ? apiFetch(`/fees/payments/student/${s.id}/balance?yearId=${currentYearId}`) : Promise.resolve(null),
      ]);
      const list = Array.isArray(pRes) ? pRes : (pRes as any)?.payments ?? [];
      setPayments(list);
      setBalance(bal);
    } catch { /* ignore */ }
    finally { setLoadingDetails(false); }
  };

  const handlePay = async () => {
    if (!selectedStudent || !payForm.feeHeadId || !payForm.amount) return;
    if (parseFloat(payForm.amount) <= 0) { setError('Amount must be greater than 0'); return; }
    setPaying(true); setError(null);
    try {
      await apiFetch('/fees/payments', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          feeHeadId: payForm.feeHeadId,
          amount: parseFloat(payForm.amount),
          paymentMode: payForm.paymentMode,
          remarks: payForm.remarks.trim() || undefined,
        }),
      });
      setSuccess('Payment recorded successfully');
      setPayForm({ feeHeadId: '', amount: '', paymentMode: 'cash', remarks: '' });
      setShowPayForm(false);
      // Reload details
      await selectStudent(selectedStudent);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally { setPaying(false); }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>Fee Collection</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Search students to view dues and record payments</p>

      {error   && <div className="alert alert-error mb-4 text-sm">{error}</div>}
      {success && <div className="alert alert-success mb-4 text-sm">{success}</div>}

      {/* Student search */}
      <div className="mb-6">
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Search Student</label>
        <div className="flex gap-2">
          <input
            className="field flex-1"
            placeholder="Name or admission number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchStudents()}
          />
          <button onClick={searchStudents} disabled={loadingStudents} className="btn-primary px-4 text-sm">
            {loadingStudents ? 'Searching…' : 'Search'}
          </button>
        </div>

        {students.length > 0 && (
          <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b last:border-0 flex items-center justify-between"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="font-medium" style={{ color: 'var(--text-1)' }}>{s.firstName} {s.lastName}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>{s.admissionNo}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedStudent && (
        <>
          {/* Selected student header */}
          <div className="flex items-center justify-between mb-5 p-4 rounded-xl" style={{ background: 'rgba(174,85,37,0.06)', border: '1px solid rgba(174,85,37,0.2)' }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {selectedStudent.firstName} {selectedStudent.lastName}
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>{selectedStudent.admissionNo}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPayForm((v) => !v)} className="btn-primary text-sm">
                + Record Payment
              </button>
              <button onClick={() => { setSelectedStudent(null); setPayments([]); setBalance(null); setShowPayForm(false); }}
                className="btn-secondary text-sm">
                Clear
              </button>
            </div>
          </div>

          {/* Payment form */}
          {showPayForm && (
            <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--brand)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Record Payment</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Fee Head</label>
                  <select className="field" value={payForm.feeHeadId} onChange={(e) => setPayForm((f) => ({ ...f, feeHeadId: e.target.value }))}>
                    <option value="">Select fee head…</option>
                    {feeHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Amount (₹)</label>
                  <input
                    type="number" min="1" className="field"
                    placeholder="0"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Payment Mode</label>
                  <select className="field" value={payForm.paymentMode} onChange={(e) => setPayForm((f) => ({ ...f, paymentMode: e.target.value }))}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="dd">DD</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Remarks (optional)</label>
                  <input
                    className="field"
                    placeholder="Optional remarks…"
                    value={payForm.remarks}
                    onChange={(e) => setPayForm((f) => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePay} disabled={paying} className="btn-primary text-sm">
                  {paying ? 'Saving…' : 'Save Payment'}
                </button>
                <button onClick={() => setShowPayForm(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          {loadingDetails ? (
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>
          ) : (
            <>
              {/* Balance summary */}
              {balance && (
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>₹{(balance.totalDue ?? 0).toLocaleString('en-IN')}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Total Due</p>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                    <p className="text-2xl font-bold text-green-700">₹{(balance.totalPaid ?? 0).toLocaleString('en-IN')}</p>
                    <p className="text-sm mt-1 text-green-700 font-medium">Total Paid</p>
                  </div>
                  <div className={`rounded-xl border p-5 ${(balance.balance ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-2xl font-bold ${(balance.balance ?? 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      ₹{(balance.balance ?? 0).toLocaleString('en-IN')}
                    </p>
                    <p className={`text-sm font-medium mt-1 ${(balance.balance ?? 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {(balance.balance ?? 0) > 0 ? 'Outstanding' : 'No Dues'}
                    </p>
                  </div>
                </div>
              )}

              {/* Breakdown */}
              {balance?.breakdown && balance.breakdown.length > 0 && (
                <div className="rounded-xl overflow-hidden mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Fee Breakdown</h2>
                  </div>
                  <table className="data-table w-full">
                    <thead><tr><th>Fee Head</th><th className="text-right">Due</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead>
                    <tbody>
                      {balance.breakdown.map((b, i) => (
                        <tr key={i}>
                          <td>{b.feeHeadName}</td>
                          <td className="text-right">₹{(b.due ?? 0).toLocaleString('en-IN')}</td>
                          <td className="text-right">₹{(b.paid ?? 0).toLocaleString('en-IN')}</td>
                          <td className={`text-right font-semibold ${(b.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{(b.balance ?? 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment history */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Payment History</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{payments.length} payment(s)</p>
                </div>
                {payments.length === 0 ? (
                  <p className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No payments recorded.</p>
                ) : (
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Fee Head</th>
                        <th>Date</th>
                        <th>Mode</th>
                        <th className="text-right">Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>{p.receiptNo}</td>
                          <td>{p.feeHead?.name ?? '—'}</td>
                          <td className="text-xs">{new Date(p.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="capitalize text-xs">{p.paymentMode}</td>
                          <td className="text-right font-semibold">₹{p.amount.toLocaleString('en-IN')}</td>
                          <td className="text-right">
                            <button
                              onClick={() => selectedStudent && printFeeReceipt(p, `${selectedStudent.firstName} ${selectedStudent.lastName}`, selectedStudent.admissionNo, user?.institutionName ?? 'School')}
                              className="text-xs font-medium hover:underline"
                              style={{ color: 'var(--brand)' }}
                            >
                              Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
