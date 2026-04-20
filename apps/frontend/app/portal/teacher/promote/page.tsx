'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface MyClassUnit {
  id: string;
  name: string;
  displayName: string | null;
  parent: { name: string; displayName: string | null } | null;
}

interface LeafUnit {
  id: string;
  name: string;
  displayName: string | null;
  parent: { name: string; displayName: string | null } | null;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  rollNo?: string;
  academicUnitId?: string;
}

function unitLabel(u: { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null }) {
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

type Action = 'promote' | 'holdback' | 'transfer';

const ACTION_LABELS: Record<Action, string> = {
  promote: 'Promote to next class',
  transfer: 'Transfer to another class',
  holdback: 'Hold back (keep in current class)',
};

export default function TeacherPromotePage() {
  const [myClasses, setMyClasses] = useState<MyClassUnit[]>([]);
  const [allLeafUnits, setAllLeafUnits] = useState<LeafUnit[]>([]);
  const [sourceUnitId, setSourceUnitId] = useState('');
  const [targetUnitId, setTargetUnitId] = useState('');
  const [action, setAction] = useState<Action>('promote');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [result, setResult] = useState<{ updated: number; action: string; targetUnitName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const naturalSort = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const sortByLabel = <T extends { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null }>(arr: T[]) =>
    [...arr].sort((a, b) => naturalSort(unitLabel(a), unitLabel(b)));

  const loadClasses = useCallback(() => {
    Promise.all([
      apiFetch('/academic/my-class-units'),
      apiFetch('/academic/units/leaf'),
    ])
      .then(([owned, leaf]: unknown[]) => {
        setMyClasses(sortByLabel(Array.isArray(owned) ? (owned as MyClassUnit[]) : []));
        setAllLeafUnits(sortByLabel(Array.isArray(leaf) ? (leaf as LeafUnit[]) : []));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  useEffect(() => {
    if (!sourceUnitId) { setStudents([]); setSelectedIds(new Set()); return; }
    setLoadingStudents(true);
    apiFetch(`/attendance/units/${sourceUnitId}/students`)
      .then((res: unknown) => {
        const list: Student[] = Array.isArray(res) ? (res as Student[]) : [];
        setStudents(list);
        setSelectedIds(new Set(list.map((s) => s.id)));
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [sourceUnitId]);

  const toggleAll = () => {
    if (selectedIds.size === students.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map((s) => s.id)));
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePromote = async () => {
    if (selectedIds.size === 0) return setError('Select at least one student');
    if (action !== 'holdback' && !targetUnitId) return setError('Select a target class');
    setError(null);
    setResult(null);
    setPromoting(true);
    try {
      const res = await apiFetch('/students/promote', {
        method: 'POST',
        body: JSON.stringify({
          studentIds: Array.from(selectedIds),
          sourceUnitId,
          targetUnitId: action !== 'holdback' ? targetUnitId : undefined,
          action,
        }),
      }) as { updated: number; action: string; targetUnitName?: string };
      setResult(res);
      setSourceUnitId('');
      setTargetUnitId('');
      setStudents([]);
      setSelectedIds(new Set());
    } catch (e: unknown) {
      setError((e as Error).message || 'Promotion failed');
    } finally {
      setPromoting(false);
    }
  };

  const sourceUnit = myClasses.find((u) => u.id === sourceUnitId);

  if (myClasses.length === 0) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-ds-text1 mb-1">Promote Students</h1>
        <div className="mt-8 bg-ds-warning-bg border border-ds-warning-border rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-ds-warning-text mb-1">No classes assigned</p>
          <p className="text-xs text-ds-warning-text">
            You have not been assigned as Class Teacher of any class. Contact your school operator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Promote Students</h1>
      <p className="text-sm text-ds-text3 mb-8">
        Bulk move students to the next class or section at year-end. You can only act on classes you are class teacher of.
      </p>

      {error && (
        <div className="mb-5 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>
      )}

      {result && (
        <div className="mb-5 bg-ds-success-bg border border-ds-success-border rounded-xl p-4">
          <p className="font-semibold text-ds-success-text text-sm">
            {result.updated} student{result.updated !== 1 ? 's' : ''}{' '}
            {result.action === 'holdback'
              ? 'held back in current class'
              : `moved to ${result.targetUnitName ?? 'target class'}`}{' '}
            successfully.
          </p>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-ds-text1 mb-4">Configuration</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as Action)}
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface w-full focus:outline-none focus:ring-2 focus:ring-ds-brand"
            >
              <option value="promote">Promote</option>
              <option value="transfer">Transfer</option>
              <option value="holdback">Hold Back</option>
            </select>
            <p className="text-xs text-ds-text3 mt-1">{ACTION_LABELS[action]}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">From Class (yours)</label>
            <select
              value={sourceUnitId}
              onChange={(e) => { setSourceUnitId(e.target.value); setTargetUnitId(''); setResult(null); }}
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface w-full focus:outline-none focus:ring-2 focus:ring-ds-brand"
            >
              <option value="">Select your class...</option>
              {myClasses.map((u) => (
                <option key={u.id} value={u.id}>{unitLabel(u)}</option>
              ))}
            </select>
          </div>
          {action !== 'holdback' && (
            <div>
              <label className="text-xs font-medium text-ds-text2 block mb-1">To Class</label>
              <select
                value={targetUnitId}
                onChange={(e) => setTargetUnitId(e.target.value)}
                className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface w-full focus:outline-none focus:ring-2 focus:ring-ds-brand"
              >
                <option value="">Select target class...</option>
                {allLeafUnits
                  .filter((u) => u.id !== sourceUnitId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{unitLabel(u)}</option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Student list */}
      {sourceUnitId && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-ds-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-ds-text1 text-sm">
                Students in {sourceUnit ? unitLabel(sourceUnit) : '—'}
              </h2>
              <p className="text-xs text-ds-text3 mt-0.5">
                {selectedIds.size} of {students.length} selected
              </p>
            </div>
            {students.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAll}
                  className="text-xs font-medium text-ds-text2 hover:text-ds-text1"
                >
                  {selectedIds.size === students.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handlePromote}
                  disabled={promoting || selectedIds.size === 0}
                  className="btn-brand px-4 py-2 rounded-lg"
                >
                  {promoting ? 'Processing...' : `Apply to ${selectedIds.size} Student${selectedIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>

          {loadingStudents ? (
            <p className="p-8 text-center text-sm text-ds-text3">Loading students...</p>
          ) : students.length === 0 ? (
            <p className="p-8 text-center text-sm text-ds-text3">No students enrolled in this class.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ds-bg2">
                <tr>
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === students.length && students.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Student</th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Admission No</th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Roll No</th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {students.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    className={`cursor-pointer transition-colors ${selectedIds.has(s.id) ? 'bg-blue-50' : 'hover:bg-ds-bg2'}`}
                  >
                    <td className="px-5 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    </td>
                    <td className="px-5 py-3 font-medium text-ds-text1">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-5 py-3 text-ds-text2 font-mono text-xs">{s.admissionNo}</td>
                    <td className="px-5 py-3 text-ds-text2">{s.rollNo ?? '—'}</td>
                    <td className="px-5 py-3">
                      {selectedIds.has(s.id) ? (
                        <span className="text-xs bg-ds-info-bg text-ds-info-text px-2 py-0.5 rounded-full font-medium">
                          {action === 'holdback' ? 'Hold Back' : action === 'transfer' ? 'Transfer' : 'Promote'}
                        </span>
                      ) : (
                        <span className="text-xs bg-ds-bg2 text-ds-text2 px-2 py-0.5 rounded-full">Skip</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {students.length > 0 && selectedIds.size > 0 && (
            <div className="px-5 py-4 border-t border-ds-border bg-ds-bg2 flex items-center justify-between">
              <p className="text-xs text-ds-text2">
                {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} will be{' '}
                {action === 'holdback' ? 'held back' : action === 'transfer' ? 'transferred' : 'promoted'}
                {action !== 'holdback' && targetUnitId
                  ? ` to ${unitLabel(allLeafUnits.find((u) => u.id === targetUnitId)!)}`
                  : ''}
              </p>
              <button
                onClick={handlePromote}
                disabled={promoting || (action !== 'holdback' && !targetUnitId)}
                className="btn-brand px-5 py-2 rounded-lg"
              >
                {promoting ? 'Processing...' : 'Confirm & Apply'}
              </button>
            </div>
          )}
        </div>
      )}

      {!sourceUnitId && !result && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-12 text-center">
          <p className="text-ds-text3 text-sm">Select one of your classes to see enrolled students.</p>
        </div>
      )}
    </div>
  );
}
