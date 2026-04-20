'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface AcademicUnit { id: string; name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null; }
interface Subject { id: string; name: string; code?: string | null; }
interface Teacher { id: string; email: string | null; phone: string | null; }
interface UnitSubject { id: string; subjectId: string; teacherUserId?: string | null; subject: Subject; teacher?: Teacher | null; }
interface TimetableSlot {
  id: string; dayOfWeek: number; periodNo: number;
  subjectId: string | null; teacherUserId: string | null;
  subject: Subject | null; teacher: Teacher | null;
}

const DAYS = [
  { no: 1, label: 'Mon' }, { no: 2, label: 'Tue' }, { no: 3, label: 'Wed' },
  { no: 4, label: 'Thu' }, { no: 5, label: 'Fri' }, { no: 6, label: 'Sat' },
];

function unitLabel(u: { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null }) {
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}
function teacherLabel(t: Teacher | null | undefined) {
  if (!t) return '';
  return t.email || t.phone || t.id;
}

export default function TimetablePage() {
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [unitSubjects, setUnitSubjects] = useState<UnitSubject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // "day-period" key
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  useEffect(() => {
    Promise.all([
      apiFetch('/academic/units/leaf'),
      apiFetch('/users?role=teacher'),
    ]).then(([u, t]: unknown[]) => {
      setUnits(Array.isArray(u) ? (u as AcademicUnit[]) : []);
      setTeachers(Array.isArray(t) ? (t as Teacher[]) : []);
    }).catch(() => {});
  }, []);

  const loadSlots = useCallback(() => {
    if (!selectedUnit) { setSlots([]); setUnitSubjects([]); return; }
    Promise.all([
      apiFetch(`/timetable/units/${selectedUnit}`),
      apiFetch(`/subjects/units/${selectedUnit}`),
    ]).then(([s, us]: unknown[]) => {
      setSlots(Array.isArray(s) ? (s as TimetableSlot[]) : []);
      setUnitSubjects(Array.isArray(us) ? (us as UnitSubject[]) : []);
    }).catch(() => {});
  }, [selectedUnit]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Build a slot map for O(1) lookup: "day-period" → slot
  const slotMap = new Map<string, TimetableSlot>();
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.periodNo}`, s);

  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);
  const activeDays = DAYS.filter((d) => workingDays.includes(d.no));

  const saveSlot = async (dayOfWeek: number, periodNo: number, subjectId: string, teacherUserId: string) => {
    const key = `${dayOfWeek}-${periodNo}`;
    setSaving(key);
    try {
      await apiFetch(`/timetable/units/${selectedUnit}/slot`, {
        method: 'PUT',
        body: JSON.stringify({
          dayOfWeek,
          periodNo,
          subjectId: subjectId || null,
          teacherUserId: teacherUserId || null,
        }),
      });
      loadSlots();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save slot');
    } finally {
      setSaving(null);
    }
  };

  const generate = async () => {
    if (!selectedUnit) return;
    if (unitSubjects.length === 0) { setError('Assign subjects to this class first (go to Subjects page)'); return; }
    setError(null);
    setGenerating(true);
    try {
      const res = await apiFetch(`/timetable/units/${selectedUnit}/generate`, {
        method: 'POST',
        body: JSON.stringify({ periodsPerDay, workingDays }),
      }) as { generated: number };
      loadSlots();
      showSuccess(`Generated ${res.generated} periods across ${workingDays.length} days`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const toggleDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const inp = 'border border-ds-border rounded-lg p-1.5 text-xs bg-ds-surface focus:outline-none focus:ring-1 focus:ring-ds-brand w-full';

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Timetable</h1>
      <p className="text-sm text-ds-text3 mb-6">Configure weekly class schedules and assign subject teachers per period</p>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Controls */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-6 items-end">
          {/* Class selector */}
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Class</label>
            <select
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand"
              value={selectedUnit}
              onChange={(e) => { setSelectedUnit(e.target.value); setSlots([]); }}
            >
              <option value="">Select class...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
            </select>
          </div>

          {/* Periods per day */}
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Periods / Day</label>
            <select
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand"
              value={periodsPerDay}
              onChange={(e) => setPeriodsPerDay(Number(e.target.value))}
            >
              {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Working days */}
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-2">Working Days</label>
            <div className="flex gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d.no}
                  onClick={() => toggleDay(d.no)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    workingDays.includes(d.no)
                      ? 'bg-ds-brand text-white border-ds-brand-dark'
                      : 'bg-ds-surface text-ds-text2 border-ds-border-strong hover:border-gray-500'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-generate */}
          <button
            onClick={generate}
            disabled={!selectedUnit || generating}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : 'Auto-Generate'}
          </button>
        </div>

        {selectedUnit && unitSubjects.length > 0 && (
          <p className="text-xs text-ds-text3 mt-3">
            {unitSubjects.length} subject(s) available · Auto-generate distributes them evenly across the week
          </p>
        )}
        {selectedUnit && unitSubjects.length === 0 && (
          <p className="text-xs text-ds-warning-text mt-3">
            No subjects assigned to this class yet. Go to the Subjects page to assign subjects first.
          </p>
        )}
      </div>

      {/* Timetable grid */}
      {selectedUnit && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-ds-bg2">
                <th className="px-4 py-3 text-left text-xs font-semibold text-ds-text2 w-20 border-b border-ds-border">Period</th>
                {activeDays.map((d) => (
                  <th key={d.no} className="px-3 py-3 text-center text-xs font-semibold text-ds-text2 border-b border-ds-border min-w-[160px]">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p} className="border-b border-ds-border last:border-0">
                  <td className="px-4 py-3 text-xs font-semibold text-ds-text3 bg-ds-bg2 text-center">P{p}</td>
                  {activeDays.map((d) => {
                    const slot = slotMap.get(`${d.no}-${p}`);
                    const key = `${d.no}-${p}`;
                    const isSaving = saving === key;

                    return (
                      <td key={d.no} className="px-3 py-2 align-top border-l border-ds-border">
                        <div className="space-y-1.5">
                          {/* Subject picker */}
                          <select
                            className={inp}
                            value={slot?.subjectId ?? ''}
                            disabled={isSaving}
                            onChange={(e) => saveSlot(d.no, p, e.target.value, slot?.teacherUserId ?? '')}
                          >
                            <option value="">— Free —</option>
                            {unitSubjects.map((us) => (
                              <option key={us.subjectId} value={us.subjectId}>{us.subject.name}</option>
                            ))}
                          </select>

                          {/* Teacher picker — only shown if subject selected */}
                          {slot?.subjectId && (
                            <select
                              className={inp + ' text-ds-text2'}
                              value={slot?.teacherUserId ?? ''}
                              disabled={isSaving}
                              onChange={(e) => saveSlot(d.no, p, slot?.subjectId ?? '', e.target.value)}
                            >
                              <option value="">— No teacher —</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>{teacherLabel(t)}</option>
                              ))}
                            </select>
                          )}

                          {isSaving && <p className="text-[10px] text-ds-text3">Saving…</p>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!selectedUnit && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-12 text-center">
          <p className="text-ds-text3 text-sm">Select a class to view or edit its timetable.</p>
        </div>
      )}
    </div>
  );
}
