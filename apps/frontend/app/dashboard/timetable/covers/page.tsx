'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Teacher { id: string; name: string | null; email: string | null; phone: string | null; }
interface AcademicUnit {
  id: string; name: string; displayName: string | null;
  parent?: { name: string; displayName: string | null } | null;
}
interface Subject { id: string; name: string; code: string | null; }
interface CoverRecord {
  id: string;
  date: string;
  dayOfWeek: number;
  periodNo: number;
  status: string; // uncovered | covered | cancelled
  absentTeacherId: string;
  substituteId: string | null;
  absentTeacher: Teacher | null;
  substitute: Teacher | null;
  subject: Subject | null;
  academicUnit: AcademicUnit;
}

const today = () => new Date().toISOString().split('T')[0];

function teacherLabel(t: Teacher | null | undefined) {
  if (!t) return '—';
  return t.name || t.email || t.phone || t.id;
}
function unitLabel(u: AcademicUnit) {
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

const STATUS_BADGE: Record<string, string> = {
  covered: 'bg-ds-success-bg text-ds-success-text border-ds-success-border',
  uncovered: 'bg-ds-error-bg text-ds-error-text border-ds-error-border',
  cancelled: 'bg-ds-bg2 text-ds-text3 border-ds-border',
};

export default function CoverManagementPage() {
  const [date, setDate] = useState(today());
  const [covers, setCovers] = useState<CoverRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingCovers, setLoadingCovers] = useState(false);

  // Mark absent flow
  const [absentTeacherId, setAbsentTeacherId] = useState('');
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const [markResult, setMarkResult] = useState<string | null>(null);

  // Assign substitute flow
  const [assigningId, setAssigningId] = useState<string | null>(null); // cover ID being assigned
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };
  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(null), 5000); };

  useEffect(() => {
    apiFetch('/users?role=teacher')
      .then((t: unknown) => setTeachers(Array.isArray(t) ? (t as Teacher[]) : []))
      .catch(() => {});
  }, []);

  const loadCovers = useCallback(() => {
    if (!date) return;
    setLoadingCovers(true);
    apiFetch(`/covers/date/${date}`)
      .then((c: unknown) => setCovers(Array.isArray(c) ? (c as CoverRecord[]) : []))
      .catch(() => {})
      .finally(() => setLoadingCovers(false));
  }, [date]);

  useEffect(() => { loadCovers(); }, [loadCovers]);

  const handleMarkAbsent = async () => {
    if (!absentTeacherId) return;
    setMarkingAbsent(true);
    setMarkResult(null);
    try {
      const res = await apiFetch('/covers/mark-absent', {
        method: 'POST',
        body: JSON.stringify({ teacherId: absentTeacherId, date }),
      }) as { message: string };
      setMarkResult(res.message);
      setAbsentTeacherId('');
      loadCovers();
    } catch (e: unknown) {
      showError((e as Error).message || 'Failed to mark absent');
    } finally {
      setMarkingAbsent(false);
    }
  };

  const openAssignPanel = async (cover: CoverRecord) => {
    setAssigningId(cover.id);
    setSelectedSubstituteId('');
    try {
      const res = await apiFetch(
        `/covers/available-teachers?date=${date}&dayOfWeek=${cover.dayOfWeek}&periodNo=${cover.periodNo}`
      );
      setAvailableTeachers(Array.isArray(res) ? (res as Teacher[]) : []);
    } catch {
      setAvailableTeachers([]);
    }
  };

  const handleAssign = async () => {
    if (!assigningId || !selectedSubstituteId) return;
    setAssigning(true);
    try {
      await apiFetch(`/covers/${assigningId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ substituteId: selectedSubstituteId }),
      });
      setAssigningId(null);
      showSuccess('Substitute assigned successfully');
      loadCovers();
    } catch (e: unknown) {
      showError((e as Error).message || 'Failed to assign substitute');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (coverId: string) => {
    try {
      await apiFetch(`/covers/${coverId}/unassign`, { method: 'PATCH' });
      showSuccess('Substitute removed');
      loadCovers();
    } catch (e: unknown) {
      showError((e as Error).message || 'Failed to remove substitute');
    }
  };

  const handleCancelCover = async (coverId: string) => {
    if (!confirm('Remove this cover record? (Teacher came in or was incorrectly marked absent)')) return;
    try {
      await apiFetch(`/covers/${coverId}`, { method: 'DELETE' });
      showSuccess('Cover record removed');
      loadCovers();
    } catch (e: unknown) {
      showError((e as Error).message || 'Failed to remove cover record');
    }
  };

  // Group covers by absent teacher
  const grouped = new Map<string, { teacher: Teacher | null; covers: CoverRecord[] }>();
  for (const c of covers) {
    if (!grouped.has(c.absentTeacherId)) {
      grouped.set(c.absentTeacherId, { teacher: c.absentTeacher, covers: [] });
    }
    grouped.get(c.absentTeacherId)!.covers.push(c);
  }

  const uncoveredCount = covers.filter((c) => c.status === 'uncovered').length;

  const inp = 'border border-ds-border rounded-lg px-3 py-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/dashboard/timetable" className="text-ds-text3 hover:text-ds-text1 text-sm">
          ← Timetable
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Cover Management</h1>
      <p className="text-sm text-ds-text3 mb-6">
        Mark absent teachers, find free substitutes per period, and assign cover duties.
      </p>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Date + Mark Absent */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Date</label>
            <input type="date" className={inp} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-ds-text2 block mb-1">Mark Teacher Absent</label>
            <select className={inp + ' w-full'} value={absentTeacherId} onChange={(e) => setAbsentTeacherId(e.target.value)}>
              <option value="">Select teacher...</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
            </select>
          </div>
          <button
            onClick={handleMarkAbsent}
            disabled={!absentTeacherId || markingAbsent}
            className="bg-ds-error-bg border border-ds-error-border text-ds-error-text px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {markingAbsent ? 'Marking...' : 'Mark Absent'}
          </button>
        </div>
        {markResult && <p className="text-xs text-ds-success-text mt-3">{markResult}</p>}
        <p className="text-xs text-ds-text3 mt-2">
          Marking a teacher absent will automatically find all their periods for this day and create cover records.
        </p>
      </div>

      {/* Cover records */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ds-text1">
          Cover Records for {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        {uncoveredCount > 0 && (
          <span className="text-xs font-semibold bg-ds-error-bg text-ds-error-text border border-ds-error-border px-2.5 py-1 rounded-full">
            {uncoveredCount} uncovered
          </span>
        )}
      </div>

      {loadingCovers && <div className="text-center py-12 text-ds-text3 text-sm">Loading...</div>}

      {!loadingCovers && covers.length === 0 && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-12 text-center">
          <p className="text-ds-text3 text-sm">No cover records for this date.</p>
          <p className="text-xs text-ds-text3 mt-1">Mark a teacher absent above to start managing cover duties.</p>
        </div>
      )}

      {!loadingCovers && covers.length > 0 && (
        <div className="space-y-5">
          {[...grouped.entries()].map(([teacherId, { teacher, covers: teacherCovers }]) => (
            <div key={teacherId} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
              {/* Absent teacher header */}
              <div className="px-5 py-3 bg-ds-error-bg border-b border-ds-error-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ds-error-text mr-2">Absent</span>
                  <span className="text-sm font-semibold text-ds-error-text">{teacherLabel(teacher)}</span>
                </div>
                <span className="text-xs text-ds-error-text">
                  {teacherCovers.filter((c) => c.status === 'uncovered').length} uncovered ·{' '}
                  {teacherCovers.filter((c) => c.status === 'covered').length} covered
                </span>
              </div>

              {/* Period rows */}
              <table className="w-full text-sm">
                <thead className="bg-ds-bg2">
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium text-ds-text2 text-left w-16">Period</th>
                    <th className="px-4 py-2 text-xs font-medium text-ds-text2 text-left">Class</th>
                    <th className="px-4 py-2 text-xs font-medium text-ds-text2 text-left">Subject</th>
                    <th className="px-4 py-2 text-xs font-medium text-ds-text2 text-left">Status</th>
                    <th className="px-4 py-2 text-xs font-medium text-ds-text2 text-left">Substitute</th>
                    <th className="px-4 py-2 text-xs font-medium text-ds-text2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {teacherCovers.sort((a, b) => a.periodNo - b.periodNo).map((cover) => (
                    <tr key={cover.id} className="hover:bg-ds-bg2">
                      <td className="px-4 py-3 font-bold text-ds-text2 text-center">P{cover.periodNo}</td>
                      <td className="px-4 py-3 text-ds-text1 font-medium">{unitLabel(cover.academicUnit)}</td>
                      <td className="px-4 py-3 text-ds-text2">
                        {cover.subject ? (
                          <span>
                            {cover.subject.name}
                            {cover.subject.code && <span className="ml-1.5 text-[10px] font-mono text-ds-text3">({cover.subject.code})</span>}
                          </span>
                        ) : <span className="text-ds-text3">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${STATUS_BADGE[cover.status] ?? ''}`}>
                          {cover.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ds-text2">
                        {cover.substitute ? teacherLabel(cover.substitute) : <span className="text-ds-text3">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end items-center">
                          {cover.status === 'uncovered' && (
                            <button
                              onClick={() => openAssignPanel(cover)}
                              className="text-xs font-medium text-white bg-ds-brand px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                            >
                              Assign
                            </button>
                          )}
                          {cover.status === 'covered' && (
                            <button
                              onClick={() => handleUnassign(cover.id)}
                              className="text-xs font-medium text-ds-text2 border border-ds-border px-3 py-1.5 rounded-lg hover:bg-ds-bg2 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelCover(cover.id)}
                            className="text-xs text-ds-text3 hover:text-ds-error-text transition-colors"
                            title="Remove cover record (teacher came in)"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Assign substitute modal/panel */}
      {assigningId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-lg w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-ds-text1 mb-4">Assign Substitute Teacher</h3>

            {availableTeachers.length === 0 ? (
              <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-4 text-sm text-ds-warning-text mb-4">
                No teachers are free during this period. All teachers either have a regular class or are already covering another period.
              </div>
            ) : (
              <>
                <p className="text-xs text-ds-text3 mb-3">
                  These teachers have no class during this period and are free to cover:
                </p>
                <select
                  className={inp + ' w-full mb-4'}
                  value={selectedSubstituteId}
                  onChange={(e) => setSelectedSubstituteId(e.target.value)}
                >
                  <option value="">Select substitute...</option>
                  {availableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{teacherLabel(t)}</option>
                  ))}
                </select>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAssigningId(null)}
                className="text-sm px-4 py-2 rounded-lg border border-ds-border text-ds-text2 hover:bg-ds-bg2"
              >
                Cancel
              </button>
              {availableTeachers.length > 0 && (
                <button
                  onClick={handleAssign}
                  disabled={!selectedSubstituteId || assigning}
                  className="text-sm px-4 py-2 rounded-lg bg-ds-brand text-white font-medium disabled:opacity-50 hover:opacity-80"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
