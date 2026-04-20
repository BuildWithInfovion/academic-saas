'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { usePortalAuthStore } from '@/store/portal-auth.store';

type Institution = { name: string; board?: string; address?: string; phone?: string; email?: string };

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function printFeeReceipt(
  payment: Payment,
  studentName: string,
  admissionNo: string,
  studentClass: string,
  institution: Institution,
) {
  const date = new Date(payment.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const payModeLabel: Record<string, string> = {
    cash: 'Cash', upi: 'UPI', cheque: 'Cheque',
    bank_transfer: 'Bank Transfer', dd: 'Demand Draft',
  };
  const html = `<!DOCTYPE html><html><head><title>Fee Receipt — ${esc(payment.receiptNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#f1f5f9;padding:30px}
  .receipt{max-width:520px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .letterhead{background:#0f172a;color:#fff;padding:20px 24px;text-align:center}
  .letterhead h1{font-size:17px;font-weight:700;letter-spacing:.5px;margin-bottom:3px}
  .letterhead .sub{font-size:11px;opacity:.65;line-height:1.5}
  .receipt-header{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
  .receipt-header .rno{font-size:13px;font-weight:700;color:#0f172a}
  .receipt-header .rdate{font-size:12px;color:#64748b}
  .section{padding:18px 24px}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border:none}
  .label{color:#64748b;font-size:12px}
  .value{font-weight:600;font-size:12px;text-align:right;max-width:60%}
  .amount-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:0 24px 20px;display:flex;justify-content:space-between;align-items:center}
  .amount-box .lbl{font-size:12px;color:#166534;font-weight:600}
  .amount-box .amt{font-size:26px;font-weight:800;color:#15803d}
  .footer{text-align:center;color:#94a3b8;font-size:10px;padding:12px 20px;border-top:1px solid #f1f5f9;line-height:1.6}
  @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0;border:1px solid #ccc};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div class="receipt">
  <div class="letterhead">
    <h1>${esc(institution.name)}</h1>
    <div class="sub">
      ${institution.board ? `${esc(institution.board)}<br>` : ''}
      ${institution.address ? `${esc(institution.address)}<br>` : ''}
      ${[institution.phone ? `Ph: ${esc(institution.phone)}` : '', institution.email ? `Email: ${esc(institution.email)}` : ''].filter(Boolean).join('  ·  ')}
    </div>
  </div>
  <div class="receipt-header">
    <span class="rno">Receipt No: ${esc(payment.receiptNo)}</span>
    <span class="rdate">${date}</span>
  </div>
  <div class="section">
    <div class="section-title">Student Details</div>
    <div class="row"><span class="label">Student Name</span><span class="value">${esc(studentName)}</span></div>
    <div class="row"><span class="label">Admission No</span><span class="value">${esc(admissionNo)}</span></div>
    <div class="row"><span class="label">Class / Section</span><span class="value">${esc(studentClass || '—')}</span></div>
  </div>
  <div class="section" style="padding-top:0">
    <div class="section-title">Payment Details</div>
    <div class="row"><span class="label">Fee Head</span><span class="value">${esc(payment.feeHead?.name ?? '—')}</span></div>
    <div class="row"><span class="label">Payment Mode</span><span class="value">${esc(payModeLabel[payment.paymentMode] ?? payment.paymentMode?.toUpperCase())}</span></div>
    ${payment.remarks ? `<div class="row"><span class="label">Remarks</span><span class="value">${esc(payment.remarks)}</span></div>` : ''}
  </div>
  <div class="amount-box">
    <span class="lbl">Amount Paid</span>
    <span class="amt">₹${payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
  </div>
  <div class="footer">
    This is a computer-generated receipt and does not require a signature.<br>
    Issued by ${esc(institution.name)}
  </div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=600,height=800');
  if (w) { w.document.write(html); w.document.close(); }
}

type Student = {
  id: string; firstName: string; lastName: string; admissionNo: string;
  academicUnit?: { displayName?: string; name?: string };
};
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
  const [institution, setInstitution] = useState<Institution>({ name: user?.institutionName ?? 'School' });
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
    Promise.all([
      apiFetch('/fees/heads'),
      apiFetch('/academic/years'),
      apiFetch('/academic/institution'),
    ])
      .then(([heads, yrs, inst]) => {
        setFeeHeads(Array.isArray(heads) ? heads : []);
        const yearList = Array.isArray(yrs) ? yrs : [];
        setYears(yearList);
        const cur = yearList.find((y: AcademicYear) => y.isCurrent) ?? yearList[0];
        if (cur) setCurrentYearId(cur.id);
        if (inst) setInstitution(inst as Institution);
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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
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
                className="w-full text-left px-4 py-3 text-sm hover:bg-ds-bg2 border-b last:border-0 flex items-center justify-between"
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
                    <p className="text-2xl font-bold text-ds-success-text">₹{(balance.totalPaid ?? 0).toLocaleString('en-IN')}</p>
                    <p className="text-sm mt-1 text-ds-success-text font-medium">Total Paid</p>
                  </div>
                  <div className={`rounded-xl border p-5 ${(balance.balance ?? 0) > 0 ? 'bg-ds-error-bg border-ds-error-border' : 'bg-ds-success-bg border-ds-success-border'}`}>
                    <p className={`text-2xl font-bold ${(balance.balance ?? 0) > 0 ? 'text-ds-error-text' : 'text-ds-success-text'}`}>
                      ₹{(balance.balance ?? 0).toLocaleString('en-IN')}
                    </p>
                    <p className={`text-sm font-medium mt-1 ${(balance.balance ?? 0) > 0 ? 'text-ds-error-text' : 'text-ds-success-text'}`}>
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
                          <td className={`text-right font-semibold ${(b.balance ?? 0) > 0 ? 'text-ds-error-text' : 'text-ds-success-text'}`}>
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
                              onClick={() => selectedStudent && printFeeReceipt(
                                p,
                                `${selectedStudent.firstName} ${selectedStudent.lastName}`,
                                selectedStudent.admissionNo,
                                selectedStudent.academicUnit?.displayName || selectedStudent.academicUnit?.name || '',
                                institution,
                              )}
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
