'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { usePortalAuthStore } from '@/store/portal-auth.store';

type Institution = { name: string; board?: string; address?: string; phone?: string; email?: string };

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function printFeeReceipt(payment: Payment, child: Child, institution: Institution) {
  const date = new Date(payment.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const payModeLabel: Record<string, string> = {
    cash: 'Cash', upi: 'UPI', cheque: 'Cheque', bank_transfer: 'Bank Transfer', dd: 'Demand Draft',
  };
  const className = child.academicUnit?.displayName || child.academicUnit?.name || '';
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
    <div class="row"><span class="label">Student Name</span><span class="value">${esc(child.firstName)} ${esc(child.lastName)}</span></div>
    <div class="row"><span class="label">Admission No</span><span class="value">${esc(child.admissionNo)}</span></div>
    ${className ? `<div class="row"><span class="label">Class / Section</span><span class="value">${esc(className)}</span></div>` : ''}
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

type Child = {
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

export default function ParentFeesPage() {
  const user = usePortalAuthStore((s) => s.user);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [currentYearId, setCurrentYearId] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(false);
  const [institution, setInstitution] = useState<Institution>({ name: user?.institutionName ?? 'School' });

  useEffect(() => {
    Promise.all([
      apiFetch('/students/child'),
      apiFetch('/academic/years'),
      apiFetch('/academic/institution'),
    ])
      .then(([kids, years, inst]) => {
        const children = Array.isArray(kids) ? kids : [];
        setChildren(children);
        if (children.length > 0) setSelectedChildId(children[0].id);
        if (children.length === 0) setNotLinked(true);
        const current = years.find((y: any) => y.isCurrent) ?? years[0];
        if (current) setCurrentYearId(current.id);
        if (inst) setInstitution(inst as Institution);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/fees/payments/student/${selectedChildId}`),
      currentYearId
        ? apiFetch(`/fees/payments/student/${selectedChildId}/balance?yearId=${currentYearId}`)
        : Promise.resolve(null),
    ])
      .then(([paymentsRes, bal]) => {
        const list = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes as any)?.payments ?? [];
        setPayments(list);
        setBalance(bal);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedChildId, currentYearId]);

  if (notLinked) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          Your child's record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Child's Fee Status</h1>
      <p className="text-sm text-gray-400 mb-6">Fee dues and payment history</p>

      {children.length > 1 && (
        <div className="mb-5">
          <label className="text-xs font-medium text-gray-600 block mb-1">Child</label>
          <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none">
            {children.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          {balance && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-2xl font-bold text-gray-800">₹{(balance.totalDue ?? 0).toLocaleString('en-IN')}</p>
                <p className="text-sm text-gray-600 mt-1">Total Due</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-2xl font-bold text-green-700">₹{(balance.totalPaid ?? 0).toLocaleString('en-IN')}</p>
                <p className="text-sm text-green-700 font-medium mt-1">Total Paid</p>
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

          {balance?.breakdown && balance.breakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Fee Breakdown</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Fee Head</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Due</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Paid</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {balance.breakdown.map((b, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3 text-gray-800 font-medium">{b.feeHeadName}</td>
                      <td className="px-5 py-3 text-right text-gray-600">₹{(b.due ?? 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right text-gray-600">₹{(b.paid ?? 0).toLocaleString('en-IN')}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${(b.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{(b.balance ?? 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">Payment History</h2>
              <p className="text-xs text-gray-400 mt-0.5">{payments.length} payment(s)</p>
            </div>
            {payments.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No payments recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Receipt No</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Fee Head</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Date</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Mode</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Amount</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((p) => {
                    const child = children.find((c) => c.id === selectedChildId) ?? children[0];
                    return (
                    <tr key={p.id}>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.receiptNo}</td>
                      <td className="px-5 py-3 text-gray-800">{p.feeHead?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {new Date(p.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-gray-600 capitalize">{p.paymentMode}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800">₹{p.amount.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => child && printFeeReceipt(p, child, institution)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Print
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
