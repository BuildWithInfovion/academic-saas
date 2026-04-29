'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface AcademicUnit { id: string; name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null; }
interface Subject { id: string; name: string; code?: string | null; }
interface Teacher { id: string; name: string | null; email: string | null; phone: string | null; }
interface UnitSubject { id: string; subjectId: string; teacherUserId?: string | null; subject: Subject; teacher?: Teacher | null; }
interface TimetableSlot {
  id: string; dayOfWeek: number; periodNo: number;
  subjectId: string | null; teacherUserId: string | null;
  subject: Subject | null; teacher: Teacher | null;
}
interface PeriodConfig {
  id: string; sortOrder: number; label: string; isBreak: boolean; startTime: string; endTime: string;
}

const DAYS = [
  { no: 1, label: 'Mon' }, { no: 2, label: 'Tue' }, { no: 3, label: 'Wed' },
  { no: 4, label: 'Thu' }, { no: 5, label: 'Fri' }, { no: 6, label: 'Sat' },
];

const DEFAULT_SCHEDULE: Omit<PeriodConfig, 'id'>[] = [
  { sortOrder: 1,  label: 'Period 1',    isBreak: false, startTime: '08:00', endTime: '08:45' },
  { sortOrder: 2,  label: 'Period 2',    isBreak: false, startTime: '08:45', endTime: '09:30' },
  { sortOrder: 3,  label: 'Short Break', isBreak: true,  startTime: '09:30', endTime: '09:45' },
  { sortOrder: 4,  label: 'Period 3',    isBreak: false, startTime: '09:45', endTime: '10:30' },
  { sortOrder: 5,  label: 'Period 4',    isBreak: false, startTime: '10:30', endTime: '11:15' },
  { sortOrder: 6,  label: 'Lunch Break', isBreak: true,  startTime: '11:15', endTime: '11:45' },
  { sortOrder: 7,  label: 'Period 5',    isBreak: false, startTime: '11:45', endTime: '12:30' },
  { sortOrder: 8,  label: 'Period 6',    isBreak: false, startTime: '12:30', endTime: '13:15' },
  { sortOrder: 9,  label: 'Period 7',    isBreak: false, startTime: '13:15', endTime: '14:00' },
];

function unitLabel(u: { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null }) {
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}
function teacherLabel(t: Teacher | null | undefined) {
  if (!t) return '';
  return t.name || t.email || t.phone || t.id;
}
function fmtTime(t: string) { return t; } // already HH:MM

type Tab = 'timetable' | 'schedule';

export default function TimetablePage() {
  const [tab, setTab] = useState<Tab>('timetable');

  // Timetable state
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [unitSubjects, setUnitSubjects] = useState<UnitSubject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Period config state
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig[]>([]);
  const [editEntries, setEditEntries] = useState<Omit<PeriodConfig, 'id'>[]>([]);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  // Load period config
  const loadPeriodConfig = useCallback(async () => {
    try {
      const cfg = await apiFetch('/timetable/period-config') as PeriodConfig[];
      setPeriodConfig(cfg);
      setEditEntries(cfg.map(({ id: _, ...rest }) => rest));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch('/academic/units/leaf'),
      apiFetch('/users?role=teacher'),
    ]).then(([u, t]: unknown[]) => {
      setUnits(Array.isArray(u) ? (u as AcademicUnit[]) : []);
      setTeachers(Array.isArray(t) ? (t as Teacher[]) : []);
    }).catch(() => {});
    loadPeriodConfig();
  }, [loadPeriodConfig]);

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

  // Build maps
  const slotMap = new Map<string, TimetableSlot>();
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.periodNo}`, s);

  // Period entries from config (non-break, in order) → periodNo mapping
  const nonBreakEntries = periodConfig.filter((e) => !e.isBreak);
  const periodTimeMap = new Map<number, PeriodConfig>(); // periodNo (1-based) → config entry
  nonBreakEntries.forEach((e, idx) => periodTimeMap.set(idx + 1, e));

  const periodsPerDay = nonBreakEntries.length || 7;
  const activeDays = DAYS.filter((d) => workingDays.includes(d.no));

  const saveSlot = async (dayOfWeek: number, periodNo: number, subjectId: string, teacherUserId: string) => {
    const key = `${dayOfWeek}-${periodNo}`;
    setSaving(key);
    try {
      await apiFetch(`/timetable/units/${selectedUnit}/slot`, {
        method: 'PUT',
        body: JSON.stringify({ dayOfWeek, periodNo, subjectId: subjectId || null, teacherUserId: teacherUserId || null }),
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

  // ── Period Config Editor ────────────────────────────────────────────────────

  const updateEntry = (idx: number, patch: Partial<Omit<PeriodConfig, 'id'>>) => {
    setEditEntries((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
    setConfigDirty(true);
  };

  const addPeriod = () => {
    const maxOrder = editEntries.length > 0 ? Math.max(...editEntries.map((e) => e.sortOrder)) : 0;
    const last = editEntries[editEntries.length - 1];
    const startTime = last?.endTime ?? '08:00';
    const periodCount = editEntries.filter((e) => !e.isBreak).length + 1;
    setEditEntries((prev) => [
      ...prev,
      { sortOrder: maxOrder + 1, label: `Period ${periodCount}`, isBreak: false, startTime, endTime: addMinutes(startTime, 45) },
    ]);
    setConfigDirty(true);
  };

  const addBreak = () => {
    const maxOrder = editEntries.length > 0 ? Math.max(...editEntries.map((e) => e.sortOrder)) : 0;
    const last = editEntries[editEntries.length - 1];
    const startTime = last?.endTime ?? '09:30';
    setEditEntries((prev) => [
      ...prev,
      { sortOrder: maxOrder + 1, label: 'Short Break', isBreak: true, startTime, endTime: addMinutes(startTime, 15) },
    ]);
    setConfigDirty(true);
  };

  const removeEntry = (idx: number) => {
    setEditEntries((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((e, i) => ({ ...e, sortOrder: i + 1 }));
    });
    setConfigDirty(true);
  };

  const moveEntry = (idx: number, dir: -1 | 1) => {
    setEditEntries((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((e, i) => ({ ...e, sortOrder: i + 1 }));
    });
    setConfigDirty(true);
  };

  const loadDefault = () => {
    setEditEntries(DEFAULT_SCHEDULE.map((e) => ({ ...e })));
    setConfigDirty(true);
  };

  const saveConfig = async () => {
    if (editEntries.length === 0) { setError('Add at least one period'); return; }
    setConfigSaving(true);
    setError(null);
    try {
      const cfg = await apiFetch('/timetable/period-config', {
        method: 'PUT',
        body: JSON.stringify({ entries: editEntries.map((e, i) => ({ ...e, sortOrder: i + 1 })) }),
      }) as PeriodConfig[];
      setPeriodConfig(cfg);
      setEditEntries(cfg.map(({ id: _, ...rest }) => rest));
      setConfigDirty(false);
      showSuccess('Day schedule saved');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save schedule');
    } finally {
      setConfigSaving(false);
    }
  };

  const inp = 'border border-ds-border rounded-lg p-1.5 text-xs bg-ds-surface focus:outline-none focus:ring-1 focus:ring-ds-brand w-full';
  const timeInp = 'border border-ds-border rounded-lg px-2 py-1 text-xs bg-ds-surface focus:outline-none focus:ring-1 focus:ring-ds-brand w-24';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-ds-text1">Timetable</h1>
        <Link
          href="/dashboard/timetable/covers"
          className="flex items-center gap-1.5 text-sm font-medium text-ds-brand border border-ds-brand rounded-lg px-3 py-1.5 hover:bg-ds-brand hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Cover Management
        </Link>
      </div>
      <p className="text-sm text-ds-text3 mb-6">Configure weekly class schedules and assign subject teachers per period</p>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Tab bar */}
      <div className="flex gap-1 bg-ds-bg2 rounded-xl p-1 mb-6 w-fit">
        {([['timetable', 'Class Timetable'], ['schedule', 'Day Schedule & Times']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Day Schedule Editor ── */}
      {tab === 'schedule' && (
        <div className="max-w-2xl">
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-ds-text1">Day Schedule</h2>
                <p className="text-xs text-ds-text3 mt-0.5">Define periods and breaks for your school day. Times appear in the timetable grid.</p>
              </div>
              <button onClick={loadDefault}
                className="text-xs text-ds-brand border border-ds-brand rounded-lg px-3 py-1.5 hover:bg-ds-brand hover:text-white transition-colors">
                Load Default Template
              </button>
            </div>

            {editEntries.length === 0 && (
              <p className="text-sm text-ds-text3 text-center py-6">No schedule configured. Load the default template or add periods manually.</p>
            )}

            <div className="space-y-2">
              {editEntries.map((entry, idx) => (
                <div key={idx} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                  entry.isBreak ? 'bg-amber-50 border-amber-200' : 'bg-ds-bg2 border-ds-border'
                }`}>
                  {/* Move buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveEntry(idx, -1)} disabled={idx === 0}
                      className="text-ds-text3 hover:text-ds-text1 disabled:opacity-30 text-[10px] leading-none">▲</button>
                    <button onClick={() => moveEntry(idx, 1)} disabled={idx === editEntries.length - 1}
                      className="text-ds-text3 hover:text-ds-text1 disabled:opacity-30 text-[10px] leading-none">▼</button>
                  </div>

                  {/* Badge */}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                    entry.isBreak ? 'bg-amber-200 text-amber-800' : 'bg-ds-brand text-white'
                  }`}>
                    {entry.isBreak ? 'BREAK' : `P${editEntries.filter((e, i) => !e.isBreak && i <= idx).length}`}
                  </span>

                  {/* Label */}
                  <input
                    className="flex-1 border border-ds-border rounded px-2 py-1 text-xs bg-ds-surface focus:outline-none focus:ring-1 focus:ring-ds-brand"
                    value={entry.label}
                    onChange={(e) => updateEntry(idx, { label: e.target.value })}
                  />

                  {/* Times */}
                  <input type="time" className={timeInp} value={entry.startTime}
                    onChange={(e) => updateEntry(idx, { startTime: e.target.value })} />
                  <span className="text-xs text-ds-text3">–</span>
                  <input type="time" className={timeInp} value={entry.endTime}
                    onChange={(e) => updateEntry(idx, { endTime: e.target.value })} />

                  {/* Remove */}
                  <button onClick={() => removeEntry(idx)}
                    className="text-ds-error-text hover:opacity-70 text-sm font-bold shrink-0">×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={addPeriod}
                className="flex items-center gap-1.5 text-xs font-medium text-ds-brand border border-ds-brand rounded-lg px-3 py-1.5 hover:bg-ds-brand hover:text-white transition-colors">
                + Add Period
              </button>
              <button onClick={addBreak}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-50 transition-colors">
                + Add Break
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveConfig} disabled={configSaving || !configDirty}
              className="btn-brand px-5 py-2 rounded-lg disabled:opacity-50 transition-colors text-sm">
              {configSaving ? 'Saving…' : 'Save Schedule'}
            </button>
            {!configDirty && periodConfig.length > 0 && (
              <span className="text-xs text-ds-success-text">Schedule saved</span>
            )}
          </div>
        </div>
      )}

      {/* ── Timetable Grid ── */}
      {tab === 'timetable' && (
        <>
          {/* Controls */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-6">
            <div className="flex flex-wrap gap-6 items-end">
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

              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-2">Working Days</label>
                <div className="flex gap-1.5">
                  {DAYS.map((d) => (
                    <button key={d.no} onClick={() => toggleDay(d.no)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        workingDays.includes(d.no)
                          ? 'bg-ds-brand text-white border-ds-brand-dark'
                          : 'bg-ds-surface text-ds-text2 border-ds-border-strong hover:border-gray-500'
                      }`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={generate} disabled={!selectedUnit || generating}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
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
            {periodConfig.length === 0 && (
              <p className="text-xs text-amber-600 mt-3">
                No day schedule configured. Go to the{' '}
                <button onClick={() => setTab('schedule')} className="underline font-medium">Day Schedule & Times</button>{' '}
                tab to set up periods and break times.
              </p>
            )}
          </div>

          {/* Grid */}
          {selectedUnit && (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-ds-bg2">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ds-text2 w-28 border-b border-ds-border">Period</th>
                    {activeDays.map((d) => (
                      <th key={d.no} className="px-3 py-3 text-center text-xs font-semibold text-ds-text2 border-b border-ds-border min-w-[160px]">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodConfig.length > 0 ? (
                    // Render rows from period config: breaks as full-width rows, periods as slot rows
                    (() => {
                      let periodIdx = 0;
                      return periodConfig.map((entry) => {
                        if (entry.isBreak) {
                          return (
                            <tr key={entry.id} className="border-b border-ds-border">
                              <td colSpan={activeDays.length + 1}
                                className="px-4 py-2 text-center text-xs font-medium text-amber-700 bg-amber-50 border-y border-amber-200">
                                {entry.label} &nbsp;·&nbsp; {fmtTime(entry.startTime)} – {fmtTime(entry.endTime)}
                              </td>
                            </tr>
                          );
                        }
                        periodIdx += 1;
                        const p = periodIdx;
                        return (
                          <tr key={entry.id} className="border-b border-ds-border last:border-0">
                            <td className="px-4 py-3 bg-ds-bg2 text-center align-top">
                              <div className="text-xs font-semibold text-ds-text1">P{p}</div>
                              <div className="text-[10px] text-ds-text3 mt-0.5 whitespace-nowrap">
                                {fmtTime(entry.startTime)}–{fmtTime(entry.endTime)}
                              </div>
                            </td>
                            {activeDays.map((d) => {
                              const slot = slotMap.get(`${d.no}-${p}`);
                              const key = `${d.no}-${p}`;
                              const isSaving = saving === key;
                              return (
                                <td key={d.no} className="px-3 py-2 align-top border-l border-ds-border">
                                  <div className="space-y-1.5">
                                    <select className={inp} value={slot?.subjectId ?? ''} disabled={isSaving}
                                      onChange={(e) => saveSlot(d.no, p, e.target.value, slot?.teacherUserId ?? '')}>
                                      <option value="">— Free —</option>
                                      {unitSubjects.map((us) => (
                                        <option key={us.subjectId} value={us.subjectId}>{us.subject.name}</option>
                                      ))}
                                    </select>
                                    {slot?.subjectId && (
                                      <select className={inp + ' text-ds-text2'} value={slot?.teacherUserId ?? ''} disabled={isSaving}
                                        onChange={(e) => saveSlot(d.no, p, slot?.subjectId ?? '', e.target.value)}>
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
                        );
                      });
                    })()
                  ) : (
                    // Fallback: no period config, show numbered periods
                    Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((p) => (
                      <tr key={p} className="border-b border-ds-border last:border-0">
                        <td className="px-4 py-3 text-xs font-semibold text-ds-text3 bg-ds-bg2 text-center">P{p}</td>
                        {activeDays.map((d) => {
                          const slot = slotMap.get(`${d.no}-${p}`);
                          const key = `${d.no}-${p}`;
                          const isSaving = saving === key;
                          return (
                            <td key={d.no} className="px-3 py-2 align-top border-l border-ds-border">
                              <div className="space-y-1.5">
                                <select className={inp} value={slot?.subjectId ?? ''} disabled={isSaving}
                                  onChange={(e) => saveSlot(d.no, p, e.target.value, slot?.teacherUserId ?? '')}>
                                  <option value="">— Free —</option>
                                  {unitSubjects.map((us) => (
                                    <option key={us.subjectId} value={us.subjectId}>{us.subject.name}</option>
                                  ))}
                                </select>
                                {slot?.subjectId && (
                                  <select className={inp + ' text-ds-text2'} value={slot?.teacherUserId ?? ''} disabled={isSaving}
                                    onChange={(e) => saveSlot(d.no, p, slot?.subjectId ?? '', e.target.value)}>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!selectedUnit && (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-12 text-center">
              <p className="text-ds-text3 text-sm">Select a class to view or edit its timetable.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Utility: add minutes to HH:MM string
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const rh = Math.floor(total / 60) % 24;
  const rm = total % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}
