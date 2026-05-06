'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AcademicYear, AcademicUnit, Institution, FeeCollectionEntry, Defaulter } from '@/lib/types';
import { fmt, todayStr, MODE_LABEL } from './fees-utils';

type DailyEntry = FeeCollectionEntry;

export function ReportsTab({ years, units, institution }: { years: AcademicYear[]; units: AcademicUnit[]; institution: Institution | null }) {
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const [reportTab, setReportTab] = useState<'daily' | 'defaulters' | 'trend'>('daily');
  const [selYear, setSelYear] = useState<string>('');
  const [selUnit, setSelUnit] = useState<string>('');
  const [date, setDate] = useState(todayStr());
  const [dailyData, setDailyData] = useState<{ payments: DailyEntry[]; total: number } | null>(null);
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [trend, setTrend] = useState<{ month: string; label: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (currentYear) setSelYear(currentYear.id); }, [currentYear]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (reportTab === 'daily') { void loadDaily(); }
      else if (reportTab === 'defaulters') { void loadDefaulters(); }
      else { void loadTrend(); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [reportTab, date, selYear, selUnit]);

  const loadDaily = async () => {
    setLoading(true);
    try { setDailyData(await apiFetch(`/fees/payments/daily?date=${date}`)); } catch { } finally { setLoading(false); }
  };

  const loadDefaulters = async () => {
    if (!selYear) return;
    setLoading(true);
    try {
      const d = await apiFetch<Defaulter[]>(`/fees/v2/defaulters?yearId=${selYear}${selUnit ? `&unitId=${selUnit}` : ''}`);
      setDefaulters(d);
    } catch { setDefaulters([]); } finally { setLoading(false); }
  };

  const loadTrend = async () => {
    setLoading(true);
    try { setTrend(await apiFetch('/fees/payments/monthly-trend?months=6')); } catch { } finally { setLoading(false); }
  };

  const exportCSV = () => {
    const rows = [['Student Name', 'Admission No', 'Class', 'Total Due', 'Paid', 'Outstanding'].join(','), ...defaulters.map((d) => [`"${d.firstName} ${d.lastName}"`, d.admissionNo, `"${d.className ?? ''}"`, d.due.toFixed(2), d.paid.toFixed(2), d.balance.toFixed(2)].join(','))];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `defaulters_${selYear}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const unitName = (u: AcademicUnit) => u.displayName || u.name;
  const maxTrend = Math.max(...trend.map((t) => t.amount), 1);

  const subTabs = [
    { key: 'daily', label: 'Daily Collection' },
    { key: 'defaulters', label: 'Defaulters' },
    { key: 'trend', label: 'Monthly Trend' },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {subTabs.map((t) => (
          <button key={t.key} onClick={() => setReportTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${reportTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>{t.label}</button>
        ))}
      </div>

      {reportTab === 'daily' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-4">
            <h3 className="font-semibold text-slate-800 flex-1">Daily Collection</h3>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => void loadDaily()} className="px-3 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50">Refresh</button>
          </div>
          {loading ? <div className="py-10 text-center text-slate-400 text-sm">Loading…</div> : dailyData && (
            <>
              <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">{dailyData.payments.length} transaction(s)</span>
                <span className="text-xl font-bold text-green-800">{fmt(dailyData.total)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-xs text-slate-500 uppercase">{['Receipt No', 'Student', 'Category', 'Mode', 'Amount'].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyData.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-indigo-600">{p.receiptNo}</td>
                        <td className="px-4 py-2.5"><div className="font-medium text-slate-800">{p.student.firstName} {p.student.lastName}</div><div className="text-xs text-slate-500">{p.student.admissionNo}</div></td>
                        <td className="px-4 py-2.5 text-slate-600">{p.categoryName}</td>
                        <td className="px-4 py-2.5 text-slate-600">{MODE_LABEL[p.paymentMode] ?? p.paymentMode}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{fmt(p.amount)}</td>
                      </tr>
                    ))}
                    {dailyData.payments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No collections on this date</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {reportTab === 'defaulters' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-slate-800 flex-1">Defaulters Report</h3>
            <select value={selYear} onChange={(e) => setSelYear(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
            </select>
            <select value={selUnit} onChange={(e) => setSelUnit(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Classes</option>
              {units.map((u) => <option key={u.id} value={u.id}>{unitName(u)}</option>)}
            </select>
            {defaulters.length > 0 && <button onClick={exportCSV} className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">Export CSV</button>}
          </div>
          {loading ? <div className="py-10 text-center text-slate-400 text-sm">Loading…</div> : (
            <>
              {defaulters.length > 0 && (
                <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                  <span className="text-sm text-red-700 font-medium">{defaulters.length} student(s) with outstanding dues</span>
                  <span className="text-xl font-bold text-red-700">{fmt(defaulters.reduce((s, d) => s + d.balance, 0))}</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-xs text-slate-500 uppercase">{['Student', 'Class', 'Total Due', 'Paid', 'Outstanding'].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {defaulters.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5"><div className="font-medium text-slate-800">{d.firstName} {d.lastName}</div><div className="text-xs text-slate-500">{d.admissionNo}</div></td>
                        <td className="px-4 py-2.5 text-slate-600">{d.className ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-700">{fmt(d.due)}</td>
                        <td className="px-4 py-2.5 text-green-700">{fmt(d.paid)}</td>
                        <td className="px-4 py-2.5 font-bold text-red-600">{fmt(d.balance)}</td>
                      </tr>
                    ))}
                    {defaulters.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No defaulters — all dues are cleared!</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {reportTab === 'trend' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-5">Monthly Collection Trend (Last 6 Months)</h3>
          {loading ? <div className="text-center py-8 text-slate-400 text-sm">Loading…</div> : (
            <div className="space-y-3">
              {trend.map((t) => (
                <div key={t.month} className="flex items-center gap-4">
                  <div className="text-sm text-slate-600 w-14 shrink-0">{t.label}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(t.amount / maxTrend) * 100}%` }} />
                  </div>
                  <div className="text-sm font-semibold text-slate-800 w-28 text-right">{fmt(t.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
