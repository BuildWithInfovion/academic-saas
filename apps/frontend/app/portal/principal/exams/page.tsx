'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Exam = { id: string; name: string; status: string };
type Unit = { id: string; name: string; displayName: string };
type SummaryRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  rollNo?: string;
  total: number;
  maxTotal: number;
  percentage: number;
  rank: number;
  isPassed: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-ds-bg2 text-ds-text2',
  active: 'bg-ds-info-bg text-ds-info-text',
  completed: 'bg-ds-success-bg text-ds-success-text',
};

export default function PrincipalExamsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/academic/years'), apiFetch('/academic/units/leaf')])
      .then(([y, u]) => {
        setYears(y);
        setUnits(u);
        const cur: AcademicYear = y.find((yr: AcademicYear) => yr.isCurrent) ?? y[0];
        if (cur) setSelectedYearId(cur.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedYearId) return;
    setSelectedExamId('');
    setSummary([]);
    apiFetch(`/exams?yearId=${selectedYearId}`)
      .then((e: Exam[]) => setExams(e))
      .catch(() => setExams([]));
  }, [selectedYearId]);

  useEffect(() => {
    if (!selectedExamId || !selectedUnitId) { setSummary([]); return; }
    setLoading(true);
    apiFetch(`/exams/${selectedExamId}/summary?unitId=${selectedUnitId}`)
      .then((s: SummaryRow[]) => setSummary(Array.isArray(s) ? s : []))
      .catch(() => setSummary([]))
      .finally(() => setLoading(false));
  }, [selectedExamId, selectedUnitId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const passCount = summary.filter((s) => s.isPassed).length;

  const inp = 'border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Exam Results</h1>
      <p className="text-sm text-ds-text3 mb-6">Class-wise exam results and rankings</p>

      {/* Filters */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Academic Year</label>
            <select className={inp} value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Examination</label>
            <select className={inp} value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
              <option value="">Select exam...</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Class</label>
            <select className={inp} value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
              <option value="">Select class...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
        </div>

        {/* Exam list summary */}
        {exams.length > 0 && !selectedExamId && (
          <div className="mt-4 pt-4 border-t border-ds-border">
            <p className="text-xs font-medium text-ds-text2 mb-2">All Exams — {years.find(y => y.id === selectedYearId)?.name}</p>
            <div className="flex flex-wrap gap-2">
              {exams.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExamId(e.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ds-border hover:border-gray-400 text-xs font-medium text-ds-text1 transition-colors"
                >
                  {e.name}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[e.status] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                    {e.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {selectedExamId && selectedUnitId && (
        <>
          {/* Summary cards */}
          {summary.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4">
                <p className="text-2xl font-bold text-ds-text1">{summary.length}</p>
                <p className="text-sm text-ds-text2 mt-1">Total Students</p>
                <p className="text-xs text-ds-text3">{selectedUnit?.displayName || selectedUnit?.name}</p>
              </div>
              <div className="bg-ds-success-bg border border-ds-success-border rounded-xl p-4">
                <p className="text-2xl font-bold text-ds-success-text">{passCount}</p>
                <p className="text-sm text-ds-success-text font-medium mt-1">Passed</p>
                <p className="text-xs text-ds-text3">{summary.length > 0 ? `${((passCount / summary.length) * 100).toFixed(0)}% pass rate` : ''}</p>
              </div>
              <div className="bg-ds-error-bg border border-ds-error-border rounded-xl p-4">
                <p className="text-2xl font-bold text-ds-error-text">{summary.length - passCount}</p>
                <p className="text-sm text-ds-error-text font-medium mt-1">Failed</p>
              </div>
              <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4">
                <p className="text-2xl font-bold text-ds-text1">
                  {summary.length > 0 ? `${(summary.reduce((a, s) => a + s.percentage, 0) / summary.length).toFixed(1)}%` : '—'}
                </p>
                <p className="text-sm text-ds-text2 mt-1">Class Average</p>
              </div>
            </div>
          )}

          {/* Results table */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ds-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-ds-text1 text-sm">
                  {selectedExam?.name} — {selectedUnit?.displayName || selectedUnit?.name}
                </h2>
                <p className="text-xs text-ds-text3 mt-0.5">Ranked by total marks</p>
              </div>
              {selectedExam && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[selectedExam.status] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                  {selectedExam.status.charAt(0).toUpperCase() + selectedExam.status.slice(1)}
                </span>
              )}
            </div>

            {loading ? (
              <p className="p-8 text-center text-sm text-ds-text3">Loading results...</p>
            ) : summary.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-ds-text3 text-sm">No results recorded yet for this exam and class.</p>
                {selectedExam?.status === 'draft' && (
                  <p className="text-xs text-ds-text3 mt-1">Exam is still in draft status. Activate it to allow mark entry.</p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-ds-bg2">
                  <tr>
                    <th className="text-center px-4 py-3 text-ds-text2 font-medium text-xs w-12">Rank</th>
                    <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Student</th>
                    <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Adm No</th>
                    <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Total</th>
                    <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">%</th>
                    <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {summary.map((s) => (
                    <tr key={s.studentId} className={s.rank === 1 ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3 text-center">
                        {s.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ds-warning-bg text-ds-warning-text text-xs font-bold">1</span>
                        ) : (
                          <span className="text-ds-text3 text-xs font-medium">#{s.rank}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-medium text-ds-text1">{s.firstName} {s.lastName}</td>
                      <td className="px-5 py-3 text-ds-text2 font-mono text-xs">{s.admissionNo}</td>
                      <td className="px-5 py-3 text-center text-ds-text1 font-semibold">
                        {s.total} / {s.maxTotal}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`font-semibold ${s.percentage >= 75 ? 'text-ds-success-text' : s.percentage >= 35 ? 'text-ds-warning-text' : 'text-ds-error-text'}`}>
                          {s.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {s.isPassed
                          ? <span className="text-xs bg-ds-success-bg text-ds-success-text px-2 py-0.5 rounded-full font-medium">Pass</span>
                          : <span className="text-xs bg-ds-error-bg text-ds-error-text px-2 py-0.5 rounded-full font-medium">Fail</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {(!selectedExamId || !selectedUnitId) && exams.length > 0 && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center">
          <p className="text-ds-text3 text-sm">Select an exam and a class to view results.</p>
        </div>
      )}

      {selectedYearId && exams.length === 0 && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center">
          <p className="text-ds-text3 text-sm">No examinations configured for this academic year.</p>
          <p className="text-xs text-ds-text3 mt-1">Use the Operator dashboard to create exams.</p>
        </div>
      )}
    </div>
  );
}
