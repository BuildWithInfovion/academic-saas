'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

function printFeeReceipt(payment: Payment, child: Child, institutionName: string) {
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
    <div class="row"><span class="label">Student Name</span><span class="value">${child.firstName} ${child.lastName}</span></div>
    <div class="row"><span class="label">Admission No</span><span class="value">${child.admissionNo}</span></div>
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

type Child = { id: string; firstName: string; lastName: string; admissionNo: string };
type Payment = {
  id: string; receiptNo: string; amount: number; paymentMode: string;
  paidOn: string; remarks?: string; feeHead: { name: string };
};
type Balance = {
  totalDue: number; totalPaid: number; balance: number;
  breakdown: { feeHeadName: string; due: number; paid: number; balance: number }[];
};

export default function ParentFeesPage() {
  const user = useAuthStore((s) => s.user);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [currentYearId, setCurrentYearId] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/students/child'), apiFetch('/academic/years')])
      .then(([kids, years]) => {
        const children = Array.isArray(kids) ? kids : [];
        setChildren(children);
        if (children.length > 0) setSelectedChildId(children[0].id);
        if (children.length === 0) setNotLinked(true);
        const current = years.find((y: any) => y.isCurrent) ?? years[0];
        if (current) setCurrentYearId(current.id);
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
    <div className="p-8 max-w-4xl">
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
            <div className="grid grid-cols-3 gap-4 mb-6">
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
                          onClick={() => child && printFeeReceipt(p, child, user?.institutionName ?? 'School')}
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
