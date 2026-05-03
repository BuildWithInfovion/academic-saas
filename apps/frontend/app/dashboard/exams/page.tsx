'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { AcademicYear, AcademicUnit, Subject } from '@/lib/types';
interface Exam {
  id: string; name: string; status: string;
  startDate?: string; endDate?: string;
  examCenter?: string; reportingTime?: string;
  academicYear: { name: string };
  _count?: { subjects: number };
}
interface ExamSubject {
  id: string; subjectId: string; academicUnitId: string;
  maxMarks: number; passingMarks: number; examDate?: string; examTime?: string;
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
  draft: 'bg-ds-bg2 text-ds-text2',
  active: 'bg-ds-success-bg text-ds-success-text',
  completed: 'bg-ds-info-bg text-ds-info-text',
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
  const [newExamCenter, setNewExamCenter] = useState('');
  const [newExamReportingTime, setNewExamReportingTime] = useState('');
  const [creating, setCreating] = useState(false);

  // Selected exam for configuration
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);

  // Bulk add state
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkSelectedUnits, setBulkSelectedUnits] = useState<Set<string>>(new Set());
  const [bulkMax, setBulkMax] = useState('100');
  const [bulkPass, setBulkPass] = useState('35');
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTime, setBulkTime] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);

  // Clone from exam
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [cloning, setCloning] = useState(false);

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

  const createExam = async () => {
    if (!newExamName.trim() || !selectedYear) return;
    if (newExamStart && newExamEnd && newExamStart >= newExamEnd) {
      setError('Exam start date must be before the end date');
      return;
    }
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
          examCenter: newExamCenter.trim() || undefined,
          reportingTime: newExamReportingTime.trim() || undefined,
        }),
      }) as Exam;
      setExams((prev) => [exam, ...prev]);
      setNewExamName(''); setNewExamStart(''); setNewExamEnd('');
      setNewExamCenter(''); setNewExamReportingTime('');
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
    setBulkSubject(''); setBulkSelectedUnits(new Set());
    setBulkMax('100'); setBulkPass('35'); setBulkDate(''); setBulkTime('');
    setCloneSourceId('');
    const subs = await apiFetch(`/exams/${exam.id}/subjects`).catch(() => []);
    setExamSubjects(Array.isArray(subs) ? subs : []);
  };

  const bulkAddSubjects = async () => {
    if (!selectedExam || !bulkSubject || bulkSelectedUnits.size === 0) {
      setError('Select a subject and at least one class');
      return;
    }
    setBulkAdding(true);
    setError(null);
    try {
      await apiFetch(`/exams/${selectedExam.id}/bulk-subjects`, {
        method: 'POST',
        body: JSON.stringify({
          subjectId: bulkSubject,
          academicUnitIds: Array.from(bulkSelectedUnits),
          maxMarks: parseInt(bulkMax) || 100,
          passingMarks: parseInt(bulkPass) || 35,
          examDate: bulkDate || undefined,
          examTime: bulkTime.trim() || undefined,
        }),
      });
      const subs = await apiFetch(`/exams/${selectedExam.id}/subjects`);
      setExamSubjects(Array.isArray(subs) ? subs : []);
      setBulkSubject(''); setBulkSelectedUnits(new Set()); setBulkDate(''); setBulkTime('');
      showSuccess(`Subject added to ${bulkSelectedUnits.size} class(es)`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed');
    } finally {
      setBulkAdding(false);
    }
  };

  const cloneSubjects = async () => {
    if (!selectedExam || !cloneSourceId) return;
    const sourceName = exams.find((e) => e.id === cloneSourceId)?.name ?? 'selected exam';
    if (!confirm(`Copy all subject configurations from "${sourceName}"? Existing entries will be overwritten.`)) return;
    setCloning(true);
    setError(null);
    try {
      const result = await apiFetch(`/exams/${selectedExam.id}/clone-subjects`, {
        method: 'POST',
        body: JSON.stringify({ sourceExamId: cloneSourceId }),
      }) as { cloned: number };
      const subs = await apiFetch(`/exams/${selectedExam.id}/subjects`);
      setExamSubjects(Array.isArray(subs) ? subs : []);
      setCloneSourceId('');
      showSuccess(`Copied ${result.cloned} subject configuration(s) from "${sourceName}"`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to clone');
    } finally {
      setCloning(false);
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

  const activateExam = async (exam: Exam) => {
    const subjectCount = selectedExam?.id === exam.id ? examSubjects.length : exam._count?.subjects ?? 0;
    if (subjectCount === 0) {
      setError('Cannot activate — no subjects configured yet. Add at least one class-subject combination first.');
      return;
    }
    await updateStatus(exam.id, 'active');
  };

  const completeExam = async (exam: Exam) => {
    setError(null);
    try {
      const c = await apiFetch(`/exams/${exam.id}/completeness`) as Completeness;
      if (c.totalSlots > 0 && !c.allComplete) {
        const incomplete = c.totalSlots - c.completeSlots;
        const pending = c.entries
          .filter((e) => !e.complete)
          .slice(0, 3)
          .map((e) => `${e.academicUnit.displayName || e.academicUnit.name} — ${e.subject.name} (${e.enteredCount}/${e.totalStudents})`)
          .join(', ');
        const suffix = c.entries.filter((e) => !e.complete).length > 3 ? '...' : '';
        if (!confirm(`${incomplete} subject slot(s) still have pending marks:\n${pending}${suffix}\n\nMark as complete anyway? Students will see partial or missing scorecards.`)) return;
      }
    } catch { /* ignore completeness errors — let backend validate */ }
    await updateStatus(exam.id, 'completed');
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

  const openProgress = async (exam: Exam) => {
    setSelectedExam(exam);
    setTab('progress');
    setCompleteness(null);
    const c = await apiFetch(`/exams/${exam.id}/completeness`).catch(() => null);
    setCompleteness(c as Completeness | null);
  };

  // Derived: units that already have bulkSubject configured in this exam
  const unitIdsWithBulkSubject = new Set(
    examSubjects.filter((es) => es.subjectId === bulkSubject).map((es) => es.academicUnitId)
  );

  const toggleBulkUnit = (unitId: string) => {
    setBulkSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId); else next.add(unitId);
      return next;
    });
  };

  const selectAllUnits = () => setBulkSelectedUnits(new Set(units.map((u) => u.id)));
  const clearAllUnits = () => setBulkSelectedUnits(new Set());

  // Group configured subjects by class for display
  const subjectsByClass = examSubjects.reduce<Record<string, ExamSubject[]>>((acc, es) => {
    const key = es.academicUnitId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(es);
    return acc;
  }, {});

  const inp = 'border border-ds-border-strong p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';

  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-black text-black' : 'border-transparent text-ds-text2 hover:text-ds-text1'}`;

  // Exams available to clone from (all exams except the selected one)
  const cloneableExams = exams.filter((e) => e.id !== selectedExam?.id && (e._count?.subjects ?? 0) > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-4">Examinations</h1>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      <div className="flex gap-1 border-b border-ds-border mb-6">
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
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">Create New Exam</p>
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Academic Year *</label>
                <select className={inp + ' w-full'} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  <option value="">Select Year</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' ✓' : ''}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-ds-text2 block mb-1">Exam Name *</label>
                <input className={inp + ' w-full'} placeholder="e.g. Unit Test 1, Half Yearly, Final"
                  value={newExamName} onChange={(e) => setNewExamName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Start Date</label>
                <input type="date" className={inp + ' w-full'} value={newExamStart}
                  onChange={(e) => setNewExamStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">End Date</label>
                <input type="date" className={inp + ' w-full'} value={newExamEnd}
                  onChange={(e) => setNewExamEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Exam Center <span className="text-ds-text3 font-normal">(for admit cards)</span></label>
                <input className={inp + ' w-full'} placeholder="e.g. Main Block — Room 101"
                  value={newExamCenter} onChange={(e) => setNewExamCenter(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Reporting Time <span className="text-ds-text3 font-normal">(for admit cards)</span></label>
                <input className={inp + ' w-full'} placeholder="e.g. 30 minutes before exam"
                  value={newExamReportingTime} onChange={(e) => setNewExamReportingTime(e.target.value)} />
              </div>
            </div>
            <button onClick={createExam}
              disabled={creating || !newExamName.trim() || !selectedYear}
              className="mt-3 btn-brand px-5 py-2 rounded-lg">
              {creating ? 'Creating...' : '+ Create Exam'}
            </button>
          </div>

          {/* Exam cards */}
          {exams.length === 0 ? (
            <div className="text-center py-16 text-ds-text3 text-sm">No exams for this year. Create one above.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {exams.map((e) => (
                <div key={e.id} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-ds-text1">{e.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[e.status]}`}>
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-ds-text3 mb-1">{e.academicYear.name}</p>
                  {(e.startDate || e.endDate) && (
                    <p className="text-xs text-ds-text2 mb-2">
                      {e.startDate && new Date(e.startDate).toLocaleDateString('en-IN')}
                      {e.startDate && e.endDate && ' – '}
                      {e.endDate && new Date(e.endDate).toLocaleDateString('en-IN')}
                    </p>
                  )}
                  <p className="text-xs text-ds-text3 mb-3">
                    {(e._count?.subjects ?? 0) === 0
                      ? <span className="text-ds-warning-text">No subjects configured yet</span>
                      : `${e._count?.subjects} subject slot(s) configured`}
                  </p>

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openConfigure(e)}
                      className="btn-brand px-3 py-1.5 rounded-lg text-xs">
                      Configure
                    </button>
                    {e.status === 'active' && (
                      <button onClick={() => openProgress(e)}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                        Mark Entry Progress
                      </button>
                    )}
                    {e.status === 'draft' && (
                      <button onClick={() => activateExam(e)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        Activate
                      </button>
                    )}
                    {e.status === 'active' && (
                      <button onClick={() => completeExam(e)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                        Mark Complete
                      </button>
                    )}
                    {e.status === 'completed' && (
                      <span className="px-3 py-1.5 text-xs text-ds-text3 italic">Results released</span>
                    )}
                    {e.status !== 'completed' && (
                      <button onClick={() => deleteExam(e.id)}
                        className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-ds-error-bg ml-auto">
                        Delete
                      </button>
                    )}
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
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-ds-text1 text-lg">{selectedExam.name} — Mark Entry Progress</h2>
              <p className="text-sm text-ds-text3">How many students have marks entered per class &amp; subject</p>
            </div>
            {completeness && (
              <div className="text-right">
                <p className="text-2xl font-bold text-ds-text1">{completeness.completeSlots}/{completeness.totalSlots}</p>
                <p className="text-xs text-ds-text3">subject slots complete</p>
                {completeness.allComplete && (
                  <span className="text-xs bg-ds-success-bg text-ds-success-text px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                    All marks entered — ready to complete
                  </span>
                )}
              </div>
            )}
          </div>

          {!completeness ? (
            <p className="text-sm text-ds-text3">Loading...</p>
          ) : completeness.entries.length === 0 ? (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center text-ds-text3 text-sm">
              No subjects configured for this exam yet.
            </div>
          ) : (
            <>
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
                  <div key={unit.id} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-ds-border bg-ds-bg2 flex items-center justify-between">
                      <span className="font-medium text-ds-text1 text-sm">{unit.displayName || unit.name}</span>
                      <span className="text-xs text-ds-text3">
                        {entries.filter((e) => e.complete).length}/{entries.length} complete
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-ds-text2">
                          <th className="px-5 py-2 text-left">Subject</th>
                          <th className="px-5 py-2 text-center">Max Marks</th>
                          <th className="px-5 py-2 text-center">Entered</th>
                          <th className="px-5 py-2 text-center">Total Students</th>
                          <th className="px-5 py-2 text-center">Progress</th>
                          <th className="px-5 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ds-border">
                        {entries.map((e) => {
                          const pct = e.totalStudents > 0 ? Math.round((e.enteredCount / e.totalStudents) * 100) : 0;
                          return (
                            <tr key={e.examSubjectId} className="hover:bg-ds-bg2">
                              <td className="px-5 py-3 font-medium text-ds-text1">{e.subject.name}</td>
                              <td className="px-5 py-3 text-center text-ds-text2">{e.maxMarks}</td>
                              <td className="px-5 py-3 text-center text-ds-text2">{e.enteredCount}</td>
                              <td className="px-5 py-3 text-center text-ds-text2">{e.totalStudents}</td>
                              <td className="px-5 py-3 text-center">
                                <div className="w-24 mx-auto">
                                  <div className="h-1.5 bg-ds-bg2 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${e.complete ? 'bg-green-500' : 'bg-indigo-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-ds-text3 mt-0.5">{pct}%</p>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center">
                                {e.complete
                                  ? <span className="text-xs bg-ds-success-bg text-ds-success-text px-2 py-0.5 rounded-full font-medium">Complete</span>
                                  : e.totalStudents === 0
                                    ? <span className="text-xs bg-ds-bg2 text-ds-text2 px-2 py-0.5 rounded-full">No students</span>
                                    : <span className="text-xs bg-ds-warning-bg text-ds-warning-text px-2 py-0.5 rounded-full">Pending</span>}
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
                <div className="bg-ds-success-bg border border-ds-success-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ds-success-text">All marks entered for every class &amp; subject</p>
                    <p className="text-xs text-ds-success-text mt-0.5">You can now complete this exam to release scorecards to students.</p>
                  </div>
                  <button
                    onClick={() => { void completeExam(selectedExam); setTab('list'); }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Complete &amp; Release Scorecards
                  </button>
                </div>
              )}
            </>
          )}

          <button onClick={() => setTab('list')}
            className="px-5 py-2 border border-ds-border-strong rounded-lg text-sm text-ds-text2 hover:bg-ds-bg2">
            Back to All Exams
          </button>
        </div>
      )}

      {/* ── Configure Exam ── */}
      {tab === 'configure' && selectedExam && (
        <div className="space-y-5">
          {/* Exam header */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-ds-text1 text-lg">{selectedExam.name}</h2>
              <p className="text-sm text-ds-text3">Configure which subjects each class will be tested on</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLOR[selectedExam.status]}`}>
              {selectedExam.status}
            </span>
          </div>

          {/* Workflow guide */}
          <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-4">
            <ol className="text-xs text-ds-brand space-y-0.5 list-decimal list-inside">
              <li>Select a subject, check all classes it applies to, set max &amp; pass marks — click <strong>Add to Classes</strong></li>
              <li>Repeat for each subject (or use <strong>Copy from Previous Exam</strong> to prefill everything)</li>
              <li>Click <strong>Activate</strong> — teachers will see this exam in their portal and can enter marks</li>
              <li>Once all marks are in, click <strong>Mark Complete</strong> — scorecards become visible to students</li>
            </ol>
          </div>

          {/* Copy from previous exam */}
          {cloneableExams.length > 0 && (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-ds-text2 mb-1">Copy configuration from a previous exam</p>
                <select className={inp + ' w-full max-w-xs'} value={cloneSourceId}
                  onChange={(e) => setCloneSourceId(e.target.value)}>
                  <option value="">Select exam to copy from...</option>
                  {cloneableExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {e.academicYear.name} ({e._count?.subjects} slots)
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={cloneSubjects}
                disabled={!cloneSourceId || cloning}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
              >
                {cloning ? 'Copying...' : 'Copy Configuration'}
              </button>
            </div>
          )}

          {/* Bulk Add form */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-4">Add Subject to Classes</p>

            {/* Step 1: pick subject + marks config */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-ds-text2 block mb-1">Subject *</label>
                <select className={inp + ' w-full'} value={bulkSubject}
                  onChange={(e) => { setBulkSubject(e.target.value); setBulkSelectedUnits(new Set()); }}>
                  <option value="">Select Subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Exam Date <span className="text-ds-text3 font-normal">(optional)</span></label>
                <input type="date" className={inp + ' w-full'} value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Max Marks</label>
                <input type="number" className={inp + ' w-full'} value={bulkMax} min="1"
                  onChange={(e) => setBulkMax(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Pass Marks</label>
                <input type="number" className={inp + ' w-full'} value={bulkPass} min="0"
                  onChange={(e) => setBulkPass(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Exam Time <span className="text-ds-text3 font-normal">(for admit cards)</span></label>
                <input className={inp + ' w-full'} placeholder="e.g. 10:00 AM – 12:00 PM"
                  value={bulkTime} onChange={(e) => setBulkTime(e.target.value)} />
              </div>
            </div>

            {/* Step 2: pick classes */}
            {units.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-ds-text2">Apply to Classes * <span className="text-ds-text3 font-normal">({bulkSelectedUnits.size} selected)</span></label>
                  <div className="flex gap-2">
                    <button onClick={selectAllUnits} className="text-xs text-ds-brand hover:underline">Select all</button>
                    <button onClick={clearAllUnits} className="text-xs text-ds-text3 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {units.map((u) => {
                    const checked = bulkSelectedUnits.has(u.id);
                    const alreadyAdded = bulkSubject ? unitIdsWithBulkSubject.has(u.id) : false;
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleBulkUnit(u.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          checked
                            ? 'bg-ds-brand text-white border-ds-brand-dark'
                            : 'bg-ds-surface text-ds-text1 border-ds-border-strong hover:border-gray-500'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked ? 'bg-white border-white' : 'border-current'
                        }`}>
                          {checked && <span className="text-ds-brand text-[9px] font-bold">✓</span>}
                        </span>
                        {u.displayName || u.name}
                        {alreadyAdded && !checked && <span className="opacity-50 text-[9px]">✓ added</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={bulkAddSubjects}
              disabled={bulkAdding || !bulkSubject || bulkSelectedUnits.size === 0}
              className="mt-4 btn-brand px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {bulkAdding
                ? 'Adding...'
                : bulkSelectedUnits.size > 0
                  ? `Add to ${bulkSelectedUnits.size} Class${bulkSelectedUnits.size > 1 ? 'es' : ''}`
                  : 'Select subject and classes above'}
            </button>
          </div>

          {/* Configured subjects grouped by class */}
          {examSubjects.length === 0 ? (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center text-ds-text3 text-sm">
              No subjects configured yet. Select a subject and classes above to get started.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider">
                Configured — {examSubjects.length} subject slot(s) across {Object.keys(subjectsByClass).length} class(es)
              </p>
              {Object.entries(subjectsByClass).map(([unitId, subs]) => {
                const unit = units.find((u) => u.id === unitId);
                return (
                  <div key={unitId} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-ds-border bg-ds-bg2">
                      <span className="font-medium text-ds-text1 text-sm">
                        {unit?.displayName || unit?.name || unitId}
                      </span>
                      <span className="ml-2 text-xs text-ds-text3">{subs.length} subject(s)</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-ds-text2">
                          <th className="px-5 py-2 text-left">Subject</th>
                          <th className="px-5 py-2 text-center">Max</th>
                          <th className="px-5 py-2 text-center">Pass</th>
                          <th className="px-5 py-2 text-center">Exam Date</th>
                          <th className="px-5 py-2 text-center">Time</th>
                          <th className="px-5 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ds-border">
                        {subs.map((es) => (
                          <tr key={es.id} className="hover:bg-ds-bg2">
                            <td className="px-5 py-2.5 font-medium text-ds-text1">{es.subject.name}</td>
                            <td className="px-5 py-2.5 text-center text-ds-text2">{es.maxMarks}</td>
                            <td className="px-5 py-2.5 text-center text-ds-text2">{es.passingMarks}</td>
                            <td className="px-5 py-2.5 text-center text-ds-text2 text-xs">
                              {es.examDate ? new Date(es.examDate).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td className="px-5 py-2.5 text-center text-ds-text2 text-xs">{es.examTime ?? '—'}</td>
                            <td className="px-5 py-2.5 text-right">
                              <button onClick={() => removeExamSubject(es.id)}
                                className="text-xs text-red-400 hover:text-ds-error-text">Remove</button>
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
              className="px-5 py-2 border border-ds-border-strong rounded-lg text-sm text-ds-text2 hover:bg-ds-bg2">
              Back to All Exams
            </button>
            {selectedExam.status === 'draft' && examSubjects.length > 0 && (
              <button onClick={() => activateExam(selectedExam)}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Activate Exam — Enable Teacher Mark Entry
              </button>
            )}
            {selectedExam.status === 'active' && (
              <button onClick={() => completeExam(selectedExam)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Mark Complete — Release Score Cards to Students
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
