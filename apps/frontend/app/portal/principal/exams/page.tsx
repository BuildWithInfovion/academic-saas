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
  draft: 'bg-gray-100 text-gray-500',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
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

  const inp = 'border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Exam Results</h1>
      <p className="text-sm text-gray-400 mb-6">Class-wise exam results and rankings</p>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Academic Year</label>
            <select className={inp} value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Examination</label>
            <select className={inp} value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
              <option value="">Select exam...</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Class</label>
            <select className={inp} value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
              <option value="">Select class...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
        </div>

        {/* Exam list summary */}
        {exams.length > 0 && !selectedExamId && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">All Exams — {years.find(y => y.id === selectedYearId)?.name}</p>
            <div className="flex flex-wrap gap-2">
              {exams.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExamId(e.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 text-xs font-medium text-gray-700 transition-colors"
                >
                  {e.name}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[e.status] ?? 'bg-gray-100 text-gray-500'}`}>
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
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-gray-800">{summary.length}</p>
                <p className="text-sm text-gray-600 mt-1">Total Students</p>
                <p className="text-xs text-gray-400">{selectedUnit?.displayName || selectedUnit?.name}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-2xl font-bold text-green-700">{passCount}</p>
                <p className="text-sm text-green-700 font-medium mt-1">Passed</p>
                <p className="text-xs text-gray-400">{summary.length > 0 ? `${((passCount / summary.length) * 100).toFixed(0)}% pass rate` : ''}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-2xl font-bold text-red-700">{summary.length - passCount}</p>
                <p className="text-sm text-red-700 font-medium mt-1">Failed</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-gray-800">
                  {summary.length > 0 ? `${(summary.reduce((a, s) => a + s.percentage, 0) / summary.length).toFixed(1)}%` : '—'}
                </p>
                <p className="text-sm text-gray-600 mt-1">Class Average</p>
              </div>
            </div>
          )}

          {/* Results table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 text-sm">
                  {selectedExam?.name} — {selectedUnit?.displayName || selectedUnit?.name}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Ranked by total marks</p>
              </div>
              {selectedExam && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[selectedExam.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {selectedExam.status.charAt(0).toUpperCase() + selectedExam.status.slice(1)}
                </span>
              )}
            </div>

            {loading ? (
              <p className="p-8 text-center text-sm text-gray-400">Loading results...</p>
            ) : summary.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-gray-400 text-sm">No results recorded yet for this exam and class.</p>
                {selectedExam?.status === 'draft' && (
                  <p className="text-xs text-gray-400 mt-1">Exam is still in draft status. Activate it to allow mark entry.</p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs w-12">Rank</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Student</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Adm No</th>
                    <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Total</th>
                    <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">%</th>
                    <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summary.map((s) => (
                    <tr key={s.studentId} className={s.rank === 1 ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3 text-center">
                        {s.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">1</span>
                        ) : (
                          <span className="text-gray-400 text-xs font-medium">#{s.rank}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-800">{s.firstName} {s.lastName}</td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.admissionNo}</td>
                      <td className="px-5 py-3 text-center text-gray-700 font-semibold">
                        {s.total} / {s.maxTotal}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`font-semibold ${s.percentage >= 75 ? 'text-green-600' : s.percentage >= 35 ? 'text-amber-600' : 'text-red-600'}`}>
                          {s.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {s.isPassed
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Pass</span>
                          : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Fail</span>}
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-400 text-sm">Select an exam and a class to view results.</p>
        </div>
      )}

      {selectedYearId && exams.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-400 text-sm">No examinations configured for this academic year.</p>
          <p className="text-xs text-gray-400 mt-1">Use the Operator dashboard to create exams.</p>
        </div>
      )}
    </div>
  );
}
