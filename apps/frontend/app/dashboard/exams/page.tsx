'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface AcademicUnit { id: string; name: string; displayName?: string; }
interface Subject { id: string; name: string; code?: string; }
interface Exam {
  id: string; name: string; status: string;
  startDate?: string; endDate?: string;
  academicYear: { name: string };
  _count?: { subjects: number };
}
interface ExamSubject {
  id: string; subjectId: string; academicUnitId: string;
  maxMarks: number; passingMarks: number; examDate?: string;
  subject: Subject; academicUnit: AcademicUnit;
}
interface CompletenessEntry {
  examSubjectId: string; subject: Subject; academicUnit: AcademicUnit;
  maxMarks: number; totalStudents: number; enteredCount: number; complete: boolean;
}
interface Completeness {
  totalSlots: number; completeSlots: number; allComplete: boolean;
  entries: CompletenessEntry[];
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active — Teachers can enter marks',
  completed: 'Completed — Score cards visible to students',
};

export default function ExamsPage() {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<'list' | 'configure' | 'progress'>('list');
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Create exam form
  const [newExamName, setNewExamName] = useState('');
  const [newExamStart, setNewExamStart] = useState('');
  const [newExamEnd, setNewExamEnd] = useState('');
  const [creating, setCreating] = useState(false);

  // Selected exam for configuration
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);

  // Add exam subject
  const [addSubUnit, setAddSubUnit] = useState('');
  const [addSubSubject, setAddSubSubject] = useState('');
  const [addSubMax, setAddSubMax] = useState('100');
  const [addSubPass, setAddSubPass] = useState('35');
  const [addSubDate, setAddSubDate] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [unitSubjects, setUnitSubjects] = useState<Subject[]>([]);
  const [loadingUnitSubjects, setLoadingUnitSubjects] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  useEffect(() => {
    if (!user?.institutionId) return;
    Promise.all([
      apiFetch('/academic/years'),
      apiFetch('/academic/units/leaf'),
      apiFetch('/subjects'),
    ]).then(([y, u, s]) => {
      const ys: AcademicYear[] = Array.isArray(y) ? y : [];
      setYears(ys);
      const cur = ys.find((yr) => yr.isCurrent);
      if (cur) setSelectedYear(cur.id);
      setUnits(Array.isArray(u) ? u : u.data || []);
      setSubjects(Array.isArray(s) ? s : []);
    }).catch(() => {});
  }, [user?.institutionId]);

  useEffect(() => {
    if (!selectedYear) return;
    apiFetch(`/exams?yearId=${selectedYear}`)
      .then((res) => setExams(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [selectedYear]);

  // Fetch subjects mapped to the selected class (not all subjects)
  useEffect(() => {
    if (!addSubUnit) { setUnitSubjects([]); return; }
    setLoadingUnitSubjects(true);
    apiFetch(`/subjects/units/${addSubUnit}`)
      .then((res) => {
        // Response is array of AcademicUnitSubject with nested subject
        const mapped: Subject[] = (Array.isArray(res) ? res : []).map(
          (us: { subject: Subject }) => us.subject,
        );
        setUnitSubjects(mapped);
      })
      .catch(() => setUnitSubjects([]))
      .finally(() => setLoadingUnitSubjects(false));
  }, [addSubUnit]);

  const createExam = async () => {
    if (!newExamName.trim() || !selectedYear) return;
    setCreating(true);
    setError(null);
    try {
      const exam = await apiFetch('/exams', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: selectedYear,
          name: newExamName.trim(),
          startDate: newExamStart || undefined,
          endDate: newExamEnd || undefined,
        }),
      }) as Exam;
      setExams((prev) => [exam, ...prev]);
      setNewExamName(''); setNewExamStart(''); setNewExamEnd('');
      showSuccess('Exam created. Now configure subjects per class.');
      openConfigure(exam);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create exam');
    } finally {
      setCreating(false);
    }
  };

  const openConfigure = async (exam: Exam) => {
    setSelectedExam(exam);
    setTab('configure');
    const subs = await apiFetch(`/exams/${exam.id}/subjects`).catch(() => []);
    setExamSubjects(Array.isArray(subs) ? subs : []);
  };

  const addExamSubject = async () => {
    if (!selectedExam || !addSubUnit || !addSubSubject) {
      return setError('Select both class and subject');
    }
    setAddingSubject(true);
    setError(null);
    try {
      await apiFetch(`/exams/${selectedExam.id}/subjects`, {
        method: 'POST',
        body: JSON.stringify({
          academicUnitId: addSubUnit,
          subjectId: addSubSubject,
          maxMarks: parseInt(addSubMax),
          passingMarks: parseInt(addSubPass),
          examDate: addSubDate || undefined,
        }),
      });
      const subs = await apiFetch(`/exams/${selectedExam.id}/subjects`);
      setExamSubjects(Array.isArray(subs) ? subs : []);
      setAddSubSubject(''); setAddSubDate('');
      showSuccess('Subject added');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed');
    } finally {
      setAddingSubject(false);
    }
  };

  const removeExamSubject = async (id: string) => {
    if (!selectedExam) return;
    try {
      await apiFetch(`/exams/${selectedExam.id}/subjects/${id}`, { method: 'DELETE' });
      setExamSubjects((prev) => prev.filter((s) => s.id !== id));
      showSuccess('Removed');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed');
    }
  };

  const updateStatus = async (examId: string, status: string) => {
    setError(null);
    try {
      await apiFetch(`/exams/${examId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setExams((prev) => prev.map((e) => e.id === examId ? { ...e, status } : e));
      if (selectedExam?.id === examId) setSelectedExam((e) => e ? { ...e, status } : e);
      const labels: Record<string, string> = {
        active: 'Exam is now active. Teachers can enter marks from their portal.',
        completed: 'Exam completed. Score cards are now visible to students.',
        draft: 'Exam moved back to draft.',
      };
      showSuccess(labels[status] || 'Status updated');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to update status');
    }
  };

  const deleteExam = async (id: string) => {
    if (!confirm('Delete this exam and all its data?')) return;
    try {
      await apiFetch(`/exams/${id}`, { method: 'DELETE' });
      setExams((prev) => prev.filter((e) => e.id !== id));
      if (selectedExam?.id === id) { setSelectedExam(null); setTab('list'); }
      showSuccess('Exam deleted');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed');
    }
  };

  // Group exam subjects by class for display
  const subjectsByClass = examSubjects.reduce<Record<string, ExamSubject[]>>((acc, es) => {
    const key = es.academicUnitId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(es);
    return acc;
  }, {});

  const inp = 'border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white';
  const openProgress = async (exam: Exam) => {
    setSelectedExam(exam);
    setTab('progress');
    setCompleteness(null);
    const c = await apiFetch(`/exams/${exam.id}/completeness`).catch(() => null);
    setCompleteness(c as Completeness | null);
  };

  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Examinations</h1>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button className={tabBtn('list')} onClick={() => setTab('list')}>All Exams</button>
        {selectedExam && (
          <button className={tabBtn('configure')} onClick={() => setTab('configure')}>
            Configure: {selectedExam.name}
          </button>
        )}
        {selectedExam && (
          <button className={tabBtn('progress')} onClick={() => openProgress(selectedExam)}>
            Mark Entry Progress
          </button>
        )}
      </div>

      {/* ── Exam List ── */}
      {tab === 'list' && (
        <div className="space-y-5">
          {/* Create exam */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Create New Exam</p>
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Academic Year *</label>
                <select className={inp + ' w-full'} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  <option value="">Select Year</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' ✓' : ''}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">Exam Name *</label>
                <input className={inp + ' w-full'} placeholder="e.g. Unit Test 1, Half Yearly, Final"
                  value={newExamName} onChange={(e) => setNewExamName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Start Date</label>
                <input type="date" className={inp + ' w-full'} value={newExamStart}
                  onChange={(e) => setNewExamStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">End Date</label>
                <input type="date" className={inp + ' w-full'} value={newExamEnd}
                  onChange={(e) => setNewExamEnd(e.target.value)} />
              </div>
            </div>
            <button onClick={createExam}
              disabled={creating || !newExamName.trim() || !selectedYear}
              className="mt-3 bg-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {creating ? 'Creating...' : '+ Create Exam'}
            </button>
          </div>

          {/* Exam cards */}
          {exams.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No exams for this year. Create one above.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {exams.map((e) => (
                <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{e.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[e.status]}`}>
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{e.academicYear.name}</p>
                  {(e.startDate || e.endDate) && (
                    <p className="text-xs text-gray-500 mb-2">
                      {e.startDate && new Date(e.startDate).toLocaleDateString('en-IN')}
                      {e.startDate && e.endDate && ' – '}
                      {e.endDate && new Date(e.endDate).toLocaleDateString('en-IN')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mb-3">{e._count?.subjects ?? 0} subject(s) configured</p>

                  <p className="text-xs text-gray-500 italic mb-3">{STATUS_LABEL[e.status]}</p>

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openConfigure(e)}
                      className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800">
                      Configure
                    </button>
                    {e.status === 'active' && (
                      <button onClick={() => openProgress(e)}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                        Mark Entry Progress
                      </button>
                    )}
                    {e.status === 'draft' && (
                      <button onClick={() => updateStatus(e.id, 'active')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        Activate
                      </button>
                    )}
                    {e.status === 'active' && (
                      <button onClick={() => updateStatus(e.id, 'completed')}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                        Mark Complete
                      </button>
                    )}
                    {e.status === 'completed' && (
                      <button onClick={() => updateStatus(e.id, 'active')}
                        className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
                        Reopen
                      </button>
                    )}
                    <button onClick={() => deleteExam(e.id)}
                      className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 ml-auto">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mark Entry Progress ── */}
      {tab === 'progress' && selectedExam && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-lg">{selectedExam.name} — Mark Entry Progress</h2>
              <p className="text-sm text-gray-400">How many students have marks entered per class & subject</p>
            </div>
            {completeness && (
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">{completeness.completeSlots}/{completeness.totalSlots}</p>
                <p className="text-xs text-gray-400">subject slots complete</p>
                {completeness.allComplete && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                    All marks entered — ready to complete
                  </span>
                )}
              </div>
            )}
          </div>

          {!completeness ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : completeness.entries.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
              No subjects configured for this exam yet.
            </div>
          ) : (
            <>
              {/* Group by class */}
              {Object.entries(
                completeness.entries.reduce<Record<string, CompletenessEntry[]>>((acc, e) => {
                  const k = e.academicUnit.id;
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(e);
                  return acc;
                }, {})
              ).map(([, entries]) => {
                const unit = entries[0].academicUnit;
                return (
                  <div key={unit.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <span className="font-medium text-gray-800 text-sm">{unit.displayName || unit.name}</span>
                      <span className="text-xs text-gray-400">
                        {entries.filter((e) => e.complete).length}/{entries.length} complete
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500">
                          <th className="px-5 py-2 text-left">Subject</th>
                          <th className="px-5 py-2 text-center">Max Marks</th>
                          <th className="px-5 py-2 text-center">Entered</th>
                          <th className="px-5 py-2 text-center">Total Students</th>
                          <th className="px-5 py-2 text-center">Progress</th>
                          <th className="px-5 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {entries.map((e) => {
                          const pct = e.totalStudents > 0 ? Math.round((e.enteredCount / e.totalStudents) * 100) : 0;
                          return (
                            <tr key={e.examSubjectId} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-medium text-gray-800">{e.subject.name}</td>
                              <td className="px-5 py-3 text-center text-gray-600">{e.maxMarks}</td>
                              <td className="px-5 py-3 text-center text-gray-600">{e.enteredCount}</td>
                              <td className="px-5 py-3 text-center text-gray-600">{e.totalStudents}</td>
                              <td className="px-5 py-3 text-center">
                                <div className="w-24 mx-auto">
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${e.complete ? 'bg-green-500' : 'bg-indigo-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{pct}%</p>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center">
                                {e.complete
                                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Complete</span>
                                  : e.totalStudents === 0
                                    ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">No students</span>
                                    : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {completeness.allComplete && selectedExam.status === 'active' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-800">All marks entered for every class & subject</p>
                    <p className="text-xs text-green-600 mt-0.5">You can now complete this exam to release scorecards to students.</p>
                  </div>
                  <button
                    onClick={() => { void updateStatus(selectedExam.id, 'completed'); setTab('list'); }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Complete &amp; Release Scorecards
                  </button>
                </div>
              )}
            </>
          )}

          <button onClick={() => setTab('list')}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Back to All Exams
          </button>
        </div>
      )}

      {/* ── Configure Exam ── */}
      {tab === 'configure' && selectedExam && (
        <div className="space-y-5">
          {/* Exam header */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-lg">{selectedExam.name}</h2>
              <p className="text-sm text-gray-400">Configure which subjects each class will be tested on</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLOR[selectedExam.status]}`}>
              {selectedExam.status}
            </span>
          </div>

          {/* Workflow guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Exam Workflow</p>
            <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
              <li>Add subjects for each class below (class + subject + max marks is mandatory)</li>
              <li>Go back to All Exams and click <strong>Activate</strong> — teachers can then enter marks from their portal</li>
              <li>Once all marks are entered, click <strong>Mark Complete</strong> — score cards become visible to students</li>
            </ol>
          </div>

          {/* Add subject form */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Add Subject to Class *
            </p>
            <div className="grid grid-cols-5 gap-3 items-end">
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">Class *</label>
                <select className={inp + ' w-full'} value={addSubUnit}
                  onChange={(e) => { setAddSubUnit(e.target.value); setAddSubSubject(''); setUnitSubjects([]); }}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">Subject *</label>
                <select className={inp + ' w-full'} value={addSubSubject}
                  onChange={(e) => setAddSubSubject(e.target.value)}
                  disabled={!addSubUnit || loadingUnitSubjects}>
                  <option value="">
                    {!addSubUnit ? 'Select class first' : loadingUnitSubjects ? 'Loading...' : unitSubjects.length === 0 ? 'No subjects assigned' : 'Select Subject'}
                  </option>
                  {unitSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Max Marks</label>
                <input type="number" className={inp + ' w-full'} value={addSubMax}
                  onChange={(e) => setAddSubMax(e.target.value)} min="1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Pass Marks</label>
                <input type="number" className={inp + ' w-full'} value={addSubPass}
                  onChange={(e) => setAddSubPass(e.target.value)} min="1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Exam Date</label>
                <input type="date" className={inp + ' w-full'} value={addSubDate}
                  onChange={(e) => setAddSubDate(e.target.value)} />
              </div>
            </div>
            <button onClick={addExamSubject}
              disabled={addingSubject || !addSubUnit || !addSubSubject}
              className="mt-3 bg-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {addingSubject ? 'Adding...' : '+ Add'}
            </button>
            {!addSubUnit && (
              <p className="text-xs text-amber-600 mt-2">Select a class first — subjects are configured per class.</p>
            )}
          </div>

          {/* Configured subjects grouped by class */}
          {examSubjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
              No subjects configured yet. Select class and subject above to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(subjectsByClass).map(([unitId, subjects]) => {
                const unit = units.find((u) => u.id === unitId);
                return (
                  <div key={unitId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                      <span className="font-medium text-gray-800 text-sm">
                        {unit?.displayName || unit?.name || unitId}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">{subjects.length} subject(s)</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500">
                          <th className="px-5 py-2 text-left">Subject</th>
                          <th className="px-5 py-2 text-center">Max Marks</th>
                          <th className="px-5 py-2 text-center">Pass Marks</th>
                          <th className="px-5 py-2 text-center">Exam Date</th>
                          <th className="px-5 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {subjects.map((es) => (
                          <tr key={es.id} className="hover:bg-gray-50">
                            <td className="px-5 py-2.5 font-medium text-gray-800">{es.subject.name}</td>
                            <td className="px-5 py-2.5 text-center text-gray-600">{es.maxMarks}</td>
                            <td className="px-5 py-2.5 text-center text-gray-600">{es.passingMarks}</td>
                            <td className="px-5 py-2.5 text-center text-gray-500 text-xs">
                              {es.examDate ? new Date(es.examDate).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right">
                              <button onClick={() => removeExamSubject(es.id)}
                                className="text-xs text-red-400 hover:text-red-600">Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action bar */}
          <div className="flex gap-3">
            <button onClick={() => setTab('list')}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Back to All Exams
            </button>
            {selectedExam.status === 'draft' && examSubjects.length > 0 && (
              <button onClick={() => updateStatus(selectedExam.id, 'active')}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Activate Exam (Enable Teacher Mark Entry)
              </button>
            )}
            {selectedExam.status === 'active' && (
              <button onClick={() => updateStatus(selectedExam.id, 'completed')}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Mark Complete (Release Score Cards to Students)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
