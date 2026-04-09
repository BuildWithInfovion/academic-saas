'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Exam = { id: string; name: string; status: string };
type ScorecardEntry = {
  subject: { name: string }; marksObtained: number | null; isAbsent: boolean;
  maxMarks: number; passingMarks: number; percentage: number; grade: string; isPassed: boolean;
};
type Scorecard = { student: { firstName: string; lastName: string }; entries: ScorecardEntry[]; summary: { total: number; maxTotal: number; percentage: number; rank: number } };

export default function StudentMarksPage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/students/me'), apiFetch('/academic/years')])
      .then(([s, years]) => {
        setStudentId(s.id);
        setYears(years);
        const current = years.find((y: AcademicYear) => y.isCurrent) ?? years[0];
        if (current) setCurrentYearId(current.id);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!currentYearId) return;
    apiFetch(`/exams?yearId=${currentYearId}`)
      .then((e: Exam[]) => {
        setExams(e.filter((ex) => ex.status === 'completed'));
      })
      .catch(() => {});
  }, [currentYearId]);

  useEffect(() => {
    if (!selectedExamId || !studentId) return;
    setLoading(true);
    apiFetch(`/exams/${selectedExamId}/scorecard/${studentId}`)
      .then(setScorecard)
      .catch(() => setScorecard(null))
      .finally(() => setLoading(false));
  }, [selectedExamId, studentId]);

  if (notLinked) return (
    <div className="p-8">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
        Student profile not linked. Contact school admin.
      </div>
    </div>
  );

  const GRADE_COLORS: Record<string, string> = {
    'A+': 'text-green-700', A: 'text-green-600', B: 'text-blue-600', C: 'text-amber-600', D: 'text-orange-600', F: 'text-red-600',
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Marks & Results</h1>
      <p className="text-sm text-gray-400 mb-6">Your exam scorecards</p>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Academic Year</label>
          <select value={currentYearId} onChange={(e) => setCurrentYearId(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Examination</label>
          <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none">
            <option value="">Select exam...</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {exams.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-400 text-sm">No completed exams for this year.</p>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading scorecard...</p>}

      {scorecard && !loading && (
        <>
          {/* Summary banner */}
          <div className="bg-black text-white rounded-xl p-5 mb-5 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Total Marks</p>
              <p className="text-xl font-bold mt-0.5">{scorecard.summary.total} / {scorecard.summary.maxTotal}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Percentage</p>
              <p className="text-xl font-bold mt-0.5">{scorecard.summary.percentage?.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Class Rank</p>
              <p className="text-xl font-bold mt-0.5">#{scorecard.summary.rank ?? '—'}</p>
            </div>
          </div>

          {/* Subject-wise */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Subject</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Marks</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Max</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">%</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Grade</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scorecard.entries.map((e, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3 text-gray-800 font-medium">{e.subject.name}</td>
                    <td className="px-5 py-3 text-center text-gray-700">
                      {e.isAbsent ? <span className="text-xs text-gray-400">Absent</span> : (e.marksObtained ?? '—')}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-500">{e.maxMarks}</td>
                    <td className="px-5 py-3 text-center text-gray-600">{e.isAbsent ? '—' : `${e.percentage?.toFixed(0)}%`}</td>
                    <td className={`px-5 py-3 text-center font-bold ${GRADE_COLORS[e.grade] ?? 'text-gray-600'}`}>{e.isAbsent ? '—' : e.grade}</td>
                    <td className="px-5 py-3 text-center">
                      {e.isAbsent
                        ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Absent</span>
                        : e.isPassed
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Pass</span>
                          : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Fail</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
