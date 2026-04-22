'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface AcademicUnit { id: string; name: string; displayName: string | null; }
interface Teacher { id: string; email: string | null; phone: string | null; }
interface TimetableSlot {
  id: string; dayOfWeek: number; periodNo: number;
  subjectId: string | null; teacherUserId: string | null;
  subject: { id: string; name: string; code?: string | null } | null;
  teacher: Teacher | null;
}
interface PeriodConfig {
  id: string; sortOrder: number; label: string; isBreak: boolean; startTime: string; endTime: string;
}

const DAYS = [
  { no: 1, label: 'Mon' }, { no: 2, label: 'Tue' }, { no: 3, label: 'Wed' },
  { no: 4, label: 'Thu' }, { no: 5, label: 'Fri' }, { no: 6, label: 'Sat' },
];

function teacherLabel(t: Teacher | null) {
  if (!t) return '—';
  return t.email?.split('@')[0] || t.phone || t.id;
}

export default function PrincipalTimetablePage() {
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');

  useEffect(() => {
    Promise.all([
      apiFetch('/academic/units/leaf'),
      apiFetch('/users?role=teacher'),
      apiFetch('/timetable/period-config').catch(() => []),
    ]).then(([u, t, cfg]: unknown[]) => {
      setUnits(Array.isArray(u) ? (u as AcademicUnit[]) : []);
      setTeachers(Array.isArray(t) ? (t as Teacher[]) : []);
      setPeriodConfig(Array.isArray(cfg) ? (cfg as PeriodConfig[]) : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (viewMode === 'class' && !selectedUnit) { setSlots([]); return; }
    if (viewMode === 'teacher' && !selectedTeacher) { setSlots([]); return; }
    setLoading(true);
    const endpoint = viewMode === 'class'
      ? `/timetable/units/${selectedUnit}`
      : `/timetable/teacher/${selectedTeacher}`;
    apiFetch(endpoint)
      .then((s: unknown) => setSlots(Array.isArray(s) ? (s as TimetableSlot[]) : []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [selectedUnit, selectedTeacher, viewMode]);

  // Build slot grid
  const slotMap = new Map<string, TimetableSlot>();
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.periodNo}`, s);
  const maxPeriod = slots.length > 0 ? Math.max(...slots.map((s) => s.periodNo)) : 7;
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
  const activeDays = DAYS.filter((d) => slots.some((s) => s.dayOfWeek === d.no));
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  // Period time lookup
  const nonBreakEntries = periodConfig.filter((e) => !e.isBreak);
  const periodTimeMap = new Map<number, PeriodConfig>();
  nonBreakEntries.forEach((e, idx) => periodTimeMap.set(idx + 1, e));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Timetable</h1>
      <p className="text-sm text-ds-text3 mb-6">View class schedules and teacher assignments</p>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-ds-bg2 rounded-lg w-fit mb-5">
        {(['class', 'teacher'] as const).map((m) => (
          <button key={m} onClick={() => { setViewMode(m); setSlots([]); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
              viewMode === m ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'
            }`}>
            {m === 'class' ? 'Class Timetable' : 'Teacher Periods'}
          </button>
        ))}
      </div>

      {/* Selector */}
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-6">
        {viewMode === 'class' ? (
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Select Class</label>
            <select
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand w-64"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              <option value="">Choose a class…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Select Teacher</label>
            <select
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand w-72"
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              <option value="">Choose a teacher…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.email || t.phone || t.id}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-ds-text3">Loading…</p>
      ) : ((viewMode === 'class' && selectedUnit) || (viewMode === 'teacher' && selectedTeacher)) ? (
        slots.length === 0 ? (
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center text-sm text-ds-text3">
            No timetable configured yet.
          </div>
        ) : (
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-ds-bg2">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ds-text2 w-16 border-b border-ds-border">Period</th>
                  {displayDays.map((d) => (
                    <th key={d.no} className="px-3 py-3 text-center text-xs font-semibold text-ds-text2 border-b border-ds-border min-w-[160px]">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodConfig.length > 0 ? (() => {
                  let periodIdx = 0;
                  return periodConfig.map((entry) => {
                    if (entry.isBreak) {
                      return (
                        <tr key={entry.id} className="border-b border-ds-border">
                          <td colSpan={displayDays.length + 1}
                            className="px-4 py-2 text-center text-xs font-medium text-amber-700 bg-amber-50 border-y border-amber-200">
                            {entry.label} &nbsp;·&nbsp; {entry.startTime} – {entry.endTime}
                          </td>
                        </tr>
                      );
                    }
                    periodIdx += 1;
                    const p = periodIdx;
                    const timeEntry = periodTimeMap.get(p);
                    return (
                      <tr key={entry.id} className="border-b border-ds-border last:border-0">
                        <td className="px-4 py-3 bg-ds-bg2 text-center align-top">
                          <div className="text-xs font-bold text-ds-text1">P{p}</div>
                          {timeEntry && (
                            <div className="text-[10px] text-ds-text3 mt-0.5 whitespace-nowrap">
                              {timeEntry.startTime}–{timeEntry.endTime}
                            </div>
                          )}
                        </td>
                        {displayDays.map((d) => {
                          const slot = slotMap.get(`${d.no}-${p}`);
                          return (
                            <td key={d.no} className="px-3 py-2 border-l border-ds-border align-top">
                              {slot?.subject ? (
                                <div>
                                  <p className="text-xs font-semibold text-ds-text1">{slot.subject.name}</p>
                                  {viewMode === 'class' && slot.teacher && (
                                    <p className="text-[10px] text-ds-text3 mt-0.5">{teacherLabel(slot.teacher)}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-ds-text3">— Free —</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })() : periods.map((p) => {
                  const timeEntry = periodTimeMap.get(p);
                  return (
                    <tr key={p} className="border-b border-ds-border last:border-0">
                      <td className="px-4 py-3 bg-ds-bg2 text-center align-top">
                        <div className="text-xs font-bold text-ds-text1">P{p}</div>
                        {timeEntry && (
                          <div className="text-[10px] text-ds-text3 mt-0.5 whitespace-nowrap">
                            {timeEntry.startTime}–{timeEntry.endTime}
                          </div>
                        )}
                      </td>
                      {displayDays.map((d) => {
                        const slot = slotMap.get(`${d.no}-${p}`);
                        return (
                          <td key={d.no} className="px-3 py-2 border-l border-ds-border align-top">
                            {slot?.subject ? (
                              <div>
                                <p className="text-xs font-semibold text-ds-text1">{slot.subject.name}</p>
                                {viewMode === 'class' && slot.teacher && (
                                  <p className="text-[10px] text-ds-text3 mt-0.5">{teacherLabel(slot.teacher)}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-ds-text3">— Free —</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center text-sm text-ds-text3">
          {viewMode === 'class' ? 'Select a class to view its timetable.' : 'Select a teacher to view their periods.'}
        </div>
      )}
    </div>
  );
}
