'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Child = { id: string; firstName: string; lastName: string; admissionNo: string };
type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Exam = { id: string; name: string; status: string };
type ScorecardEntry = {
  subject: { name: string }; marksObtained: number | null; isAbsent: boolean;
  maxMarks: number; passingMarks: number; percentage: number; grade: string; isPassed: boolean;
};
type Scorecard = {
  student: { firstName: string; lastName: string };
  entries: ScorecardEntry[];
  summary: { total: number; maxTotal: number; percentage: number; rank: number };
};

export default function ParentMarksPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/students/child'), apiFetch('/academic/years')])
      .then(([kids, ys]) => {
        const children = Array.isArray(kids) ? kids : [];
        setChildren(children);
        if (children.length > 0) setSelectedChildId(children[0].id);
        if (children.length === 0) setNotLinked(true);
        setYears(ys);
        const current = ys.find((y: AcademicYear) => y.isCurrent) ?? ys[0];
        if (current) setCurrentYearId(current.id);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!currentYearId) return;
    apiFetch(`/exams?yearId=${currentYearId}`)
      .then((e: Exam[]) => setExams(e.filter((ex) => ex.status === 'completed' || ex.status === 'active')))
      .catch(() => {});
  }, [currentYearId]);

  useEffect(() => {
    if (!selectedExamId || !selectedChildId) return;
    setLoading(true);
    apiFetch(`/exams/${selectedExamId}/scorecard/${selectedChildId}`)
      .then(setScorecard)
      .catch(() => setScorecard(null))
      .finally(() => setLoading(false));
  }, [selectedExamId, selectedChildId]);

  if (notLinked) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5 text-sm text-ds-warning-text">
          Your child's record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  const GRADE_COLORS: Record<string, string> = {
    'A+': 'text-ds-success-text', A: 'text-ds-success-text', B: 'text-ds-brand', C: 'text-ds-warning-text', D: 'text-orange-600', F: 'text-ds-error-text',
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Child's Marks & Results</h1>
      <p className="text-sm text-ds-text3 mb-6">Exam scorecards</p>

      <div className="flex flex-wrap gap-4 mb-6">
        {children.length > 1 && (
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Child</label>
            <select value={selectedChildId} onChange={(e) => { setSelectedChildId(e.target.value); setScorecard(null); }}
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none">
              {children.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Academic Year</label>
          <select value={currentYearId} onChange={(e) => setCurrentYearId(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Examination</label>
          <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none">
            <option value="">Select exam...</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {exams.length === 0 && currentYearId && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-8 text-center">
          <p className="text-ds-text3 text-sm">No completed exams for this year.</p>
        </div>
      )}

      {loading && <p className="text-sm text-ds-text3">Loading scorecard...</p>}

      {scorecard && !loading && (
        <>
          <div className="rounded-xl p-5 mb-5 grid grid-cols-3 gap-4" style={{ background: 'linear-gradient(135deg, var(--brand-dark) 0%, #2d1a0e 100%)', color: '#fcfbf7' }}>
            <div>
              <p className="text-xs" style={{ color: 'rgba(247,197,118,0.7)' }}>Total Marks</p>
              <p className="text-xl font-bold mt-0.5">{scorecard.summary.total} / {scorecard.summary.maxTotal}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'rgba(247,197,118,0.7)' }}>Percentage</p>
              <p className="text-xl font-bold mt-0.5">{scorecard.summary.percentage?.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'rgba(247,197,118,0.7)' }}>Class Rank</p>
              <p className="text-xl font-bold mt-0.5">#{scorecard.summary.rank ?? '—'}</p>
            </div>
          </div>

          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ds-bg2">
                <tr>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Subject</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Marks</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Max</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">%</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Grade</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {scorecard.entries.map((e, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3 text-ds-text1 font-medium">{e.subject.name}</td>
                    <td className="px-5 py-3 text-center text-ds-text1">
                      {e.isAbsent ? <span className="text-xs text-ds-text3">Absent</span> : (e.marksObtained ?? '—')}
                    </td>
                    <td className="px-5 py-3 text-center text-ds-text2">{e.maxMarks}</td>
                    <td className="px-5 py-3 text-center text-ds-text2">{e.isAbsent ? '—' : `${e.percentage?.toFixed(0)}%`}</td>
                    <td className={`px-5 py-3 text-center font-bold ${GRADE_COLORS[e.grade] ?? 'text-ds-text2'}`}>{e.isAbsent ? '—' : e.grade}</td>
                    <td className="px-5 py-3 text-center">
                      {e.isAbsent
                        ? <span className="text-xs bg-ds-bg2 text-ds-text2 px-2 py-0.5 rounded-full">Absent</span>
                        : e.isPassed
                          ? <span className="text-xs bg-ds-success-bg text-ds-success-text px-2 py-0.5 rounded-full">Pass</span>
                          : <span className="text-xs bg-ds-error-bg text-ds-error-text px-2 py-0.5 rounded-full">Fail</span>}
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
