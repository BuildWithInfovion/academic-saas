'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  academicUnit: { id: string; name: string; displayName: string | null } | null;
};

type AcademicYear = { id: string; name: string; isCurrent: boolean };

type Exam = { id: string; name: string; status: string };

type ScorecardEntry = {
  subject: { name: string };
  marksObtained: number | null;
  isAbsent: boolean;
  maxMarks: number;
  passingMarks: number;
  percentage: number;
  grade: string;
  isPassed: boolean;
};

type Scorecard = {
  student: { firstName: string; lastName: string };
  entries: ScorecardEntry[];
  summary: { total: number; maxTotal: number; percentage: number; rank: number };
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-green-700', A: 'text-green-600', B: 'text-blue-600',
  C: 'text-amber-600', D: 'text-orange-600', F: 'text-red-600',
};

export default function ParentExamsPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loadingScorecard, setLoadingScorecard] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/students/child'), apiFetch('/academic/years')])
      .then(([kids, ys]) => {
        const children = Array.isArray(kids) ? (kids as Child[]) : [];
        setChildren(children);
        if (children.length === 0) { setNotLinked(true); return; }
        setSelectedChildId(children[0].id);
        setYears(ys);
        const cur: AcademicYear = ys.find((y: AcademicYear) => y.isCurrent) ?? ys[0];
        if (cur) setSelectedYearId(cur.id);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!selectedYearId) return;
    setSelectedExamId('');
    setScorecard(null);
    apiFetch(`/exams?yearId=${selectedYearId}`)
      .then((e: Exam[]) => setExams(e))
      .catch(() => setExams([]));
  }, [selectedYearId]);

  useEffect(() => {
    if (!selectedExamId || !selectedChildId) { setScorecard(null); return; }
    setLoadingScorecard(true);
    apiFetch(`/exams/${selectedExamId}/scorecard/${selectedChildId}`)
      .then((s) => setScorecard(s as Scorecard))
      .catch(() => setScorecard(null))
      .finally(() => setLoadingScorecard(false));
  }, [selectedExamId, selectedChildId]);

  if (notLinked) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          Your child's record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const completedExams = exams.filter((e) => e.status === 'completed');
  const activeExams = exams.filter((e) => e.status === 'active');
  const upcomingExams = exams.filter((e) => e.status === 'draft');

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Exam Schedule & Results</h1>
      <p className="text-sm text-gray-400 mb-6">View exams and your child's scorecards</p>

      {/* Child + Year selectors */}
      <div className="flex flex-wrap gap-4 mb-6">
        {children.length > 1 && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Child</label>
            <select
              value={selectedChildId}
              onChange={(e) => { setSelectedChildId(e.target.value); setScorecard(null); }}
              className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Academic Year</label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
          >
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
      </div>

      {/* Exam status overview */}
      {exams.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-blue-700">{activeExams.length}</p>
            <p className="text-sm text-blue-700 font-medium mt-1">In Progress</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-700">{completedExams.length}</p>
            <p className="text-sm text-green-700 font-medium mt-1">Completed</p>
          </div>
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-700">{upcomingExams.length}</p>
            <p className="text-sm text-gray-600 font-medium mt-1">Upcoming</p>
          </div>
        </div>
      )}

      {/* All exams list */}
      {exams.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">All Examinations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click a completed exam to view {selectedChild?.firstName}'s scorecard
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {exams.map((e) => (
              <div
                key={e.id}
                onClick={() => e.status === 'completed' ? setSelectedExamId(selectedExamId === e.id ? '' : e.id) : undefined}
                className={`px-5 py-3 flex items-center justify-between ${
                  e.status === 'completed' ? 'cursor-pointer hover:bg-gray-50' : ''
                } ${selectedExamId === e.id ? 'bg-blue-50' : ''}`}
              >
                <p className="text-sm font-medium text-gray-800">{e.name}</p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[e.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {e.status === 'active' ? 'In Progress' : e.status === 'completed' ? 'Completed' : 'Upcoming'}
                  </span>
                  {e.status === 'completed' && (
                    <span className="text-xs text-indigo-600 font-medium">
                      {selectedExamId === e.id ? 'Hide results ↑' : 'View results →'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {exams.length === 0 && selectedYearId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-400 text-sm">No examinations scheduled for this academic year.</p>
        </div>
      )}

      {/* Scorecard */}
      {selectedExamId && (
        loadingScorecard ? (
          <p className="text-sm text-gray-400">Loading scorecard...</p>
        ) : !scorecard ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">No marks recorded yet for {selectedChild?.firstName} in {selectedExam?.name}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-black text-white px-5 py-4">
              <p className="text-xs text-gray-400 mb-1">{selectedExam?.name}</p>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-xl font-bold">{scorecard.summary.total} / {scorecard.summary.maxTotal}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Percentage</p>
                  <p className="text-xl font-bold">{scorecard.summary.percentage?.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Class Rank</p>
                  <p className="text-xl font-bold">#{scorecard.summary.rank ?? '—'}</p>
                </div>
              </div>
            </div>
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
                    <td className={`px-5 py-3 text-center font-bold ${GRADE_COLORS[e.grade] ?? 'text-gray-600'}`}>
                      {e.isAbsent ? '—' : e.grade}
                    </td>
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
        )
      )}
    </div>
  );
}
