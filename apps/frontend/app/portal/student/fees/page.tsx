'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Payment = {
  id: string;
  receiptNo: string;
  amount: number;
  paymentMode: string;
  paidOn: string;
  remarks?: string;
  feeHead: { name: string };
};

type Balance = {
  totalDue: number;
  totalPaid: number;
  balance: number;
  breakdown: { feeHeadName: string; due: number; paid: number; balance: number }[];
};

export default function StudentFeesPage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [currentYearId, setCurrentYearId] = useState('');
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/students/me'), apiFetch('/academic/years')])
      .then(([s, years]) => {
        setStudentId(s.id);
        const current = years.find((y: any) => y.isCurrent) ?? years[0];
        if (current) setCurrentYearId(current.id);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/fees/payments/student/${studentId}`),
      currentYearId
        ? apiFetch(`/fees/payments/student/${studentId}/balance?yearId=${currentYearId}`)
        : Promise.resolve(null),
    ])
      .then(([payments, bal]) => {
        setPayments(Array.isArray(payments) ? payments : []);
        setBalance(bal);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId, currentYearId]);

  if (notLinked) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          Student profile not linked. Contact school admin.
        </div>
      </div>
    );
  }

  const PAYMENT_MODE_LABELS: Record<string, string> = {
    cash: 'Cash', online: 'Online', cheque: 'Cheque', dd: 'DD', neft: 'NEFT', upi: 'UPI',
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Fee Status</h1>
      <p className="text-sm text-gray-400 mb-6">Your fee payments and outstanding balance</p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          {/* Balance summary */}
          {balance && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <p className="text-2xl font-bold text-gray-800">₹{(balance.totalDue ?? 0).toLocaleString('en-IN')}</p>
                <p className="text-sm text-gray-600 mt-1">Total Due</p>
                <p className="text-xs text-gray-400">This academic year</p>
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

          {/* Fee head breakdown */}
          {balance?.breakdown && balance.breakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Fee Head Breakdown</h2>
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

          {/* Payment history */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">Payment History</h2>
              <p className="text-xs text-gray-400 mt-0.5">{payments.length} payment(s) recorded</p>
            </div>
            {payments.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">No payments recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Receipt No</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Fee Head</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Date</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Mode</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.receiptNo}</td>
                      <td className="px-5 py-3 text-gray-800">{p.feeHead?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {new Date(p.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-gray-600 capitalize">{PAYMENT_MODE_LABELS[p.paymentMode] ?? p.paymentMode}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800">₹{p.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
