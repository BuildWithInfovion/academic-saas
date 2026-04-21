'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  periodNo: number;
  subjectId: string | null;
  subject: { id: string; name: string; code?: string | null } | null;
  academicUnit: { id: string; name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null };
}

const DAYS = [
  { no: 1, label: 'Monday' },
  { no: 2, label: 'Tuesday' },
  { no: 3, label: 'Wednesday' },
  { no: 4, label: 'Thursday' },
  { no: 5, label: 'Friday' },
  { no: 6, label: 'Saturday' },
];

const TODAY_DAY = new Date().getDay() === 0 ? 7 : new Date().getDay(); // 1=Mon…6=Sat

function unitLabel(u: { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null }) {
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

interface CoverDuty {
  id: string;
  periodNo: number;
  subject: { name: string; code?: string | null } | null;
  academicUnit: { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null };
  absentTeacher: { name: string | null; email: string | null } | null;
}

export default function TeacherTimetablePage() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(TODAY_DAY <= 6 ? TODAY_DAY : 1);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [coverDuties, setCoverDuties] = useState<CoverDuty[]>([]);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      apiFetch('/timetable/my-schedule'),
      apiFetch(`/covers/my-duties?date=${todayStr}`).catch(() => []),
    ]).then(([s, c]) => {
      setSlots(Array.isArray(s) ? (s as TimetableSlot[]) : []);
      setCoverDuties(Array.isArray(c) ? (c as CoverDuty[]) : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Group by day
  const byDay = new Map<number, TimetableSlot[]>();
  for (const slot of slots) {
    if (!byDay.has(slot.dayOfWeek)) byDay.set(slot.dayOfWeek, []);
    byDay.get(slot.dayOfWeek)!.push(slot);
  }
  for (const [, daySlots] of byDay) {
    daySlots.sort((a, b) => a.periodNo - b.periodNo);
  }

  const activeDays = DAYS.filter((d) => byDay.has(d.no));
  const daySlots = byDay.get(activeDay) ?? [];

  // Max periods across all days
  const maxPeriod = slots.length > 0 ? Math.max(...slots.map((s) => s.periodNo)) : 0;
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  if (loading) {
    return <div className="p-4 sm:p-6 text-sm text-ds-text3">Loading timetable…</div>;
  }

  if (slots.length === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-ds-text1 mb-1">My Timetable</h1>
        <div className="mt-8 bg-ds-warning-bg border border-ds-warning-border rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-ds-warning-text">No timetable assigned yet</p>
          <p className="text-xs text-ds-warning-text mt-1">
            The operator needs to create and assign a timetable for your classes first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Cover duty banner — shown when teacher has substitute duties today */}
      {coverDuties.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">
            Cover Duty Today — {coverDuties.length} extra period{coverDuties.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5">
            {coverDuties.map((d) => (
              <div key={d.id} className="flex items-center gap-3 text-sm">
                <span className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">
                  P{d.periodNo}
                </span>
                <span className="text-amber-900 font-medium">
                  {d.subject?.name ?? 'No subject'} —{' '}
                  {d.academicUnit.parent
                    ? `${d.academicUnit.parent.displayName || d.academicUnit.parent.name} › ${d.academicUnit.displayName || d.academicUnit.name}`
                    : d.academicUnit.displayName || d.academicUnit.name}
                </span>
                {d.absentTeacher && (
                  <span className="text-xs text-amber-600">
                    (covering for {d.absentTeacher.name || d.absentTeacher.email})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ds-text1 mb-1">My Timetable</h1>
          <p className="text-sm text-ds-text3">Your assigned periods across all classes</p>
        </div>
        <div className="flex gap-1 p-1 bg-ds-bg2 rounded-lg">
          {(['day', 'week'] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                viewMode === m ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'
              }`}>
              {m === 'day' ? 'Day View' : 'Week View'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'day' ? (
        <>
          {/* Day tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {activeDays.map((d) => (
              <button
                key={d.no}
                onClick={() => setActiveDay(d.no)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  activeDay === d.no
                    ? 'btn-brand border-transparent'
                    : 'bg-ds-surface text-ds-text2 border-ds-border hover:border-ds-border-strong'
                }`}
              >
                {d.label}
                {d.no === TODAY_DAY && (
                  <span className="ml-2 text-[10px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full font-semibold">Today</span>
                )}
              </button>
            ))}
          </div>

          {/* Period cards for selected day */}
          <div className="space-y-3">
            {daySlots.length === 0 ? (
              <p className="text-sm text-ds-text3 p-4">No periods assigned for this day.</p>
            ) : (
              daySlots.map((slot) => (
                <div key={slot.id} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-ds-bg2 flex items-center justify-center text-sm font-bold text-ds-text2 shrink-0">
                    P{slot.periodNo}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-ds-text1">{slot.subject?.name ?? 'No subject'}</p>
                    <p className="text-xs text-ds-text2 mt-0.5">{unitLabel(slot.academicUnit)}</p>
                  </div>
                  {slot.subject?.code && (
                    <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-mono">
                      {slot.subject.code}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Week view — grid */
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-ds-bg2">
                <th className="px-4 py-3 text-left text-xs font-semibold text-ds-text2 w-16 border-b border-ds-border">Period</th>
                {activeDays.map((d) => (
                  <th key={d.no} className={`px-3 py-3 text-center text-xs font-semibold border-b border-ds-border min-w-[150px] ${
                    d.no === TODAY_DAY ? 'text-indigo-600 bg-indigo-50' : 'text-ds-text2'
                  }`}>
                    {d.label}
                    {d.no === TODAY_DAY && <span className="ml-1 text-[9px] bg-indigo-500 text-white px-1 rounded">Today</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p} className="border-b border-ds-border last:border-0">
                  <td className="px-4 py-3 text-xs font-bold text-ds-text3 bg-ds-bg2 text-center">P{p}</td>
                  {activeDays.map((d) => {
                    const slot = byDay.get(d.no)?.find((s) => s.periodNo === p);
                    return (
                      <td key={d.no} className={`px-3 py-2 border-l border-ds-border ${d.no === TODAY_DAY ? 'bg-indigo-50/30' : ''}`}>
                        {slot ? (
                          <div>
                            <p className="text-xs font-semibold text-ds-text1">{slot.subject?.name}</p>
                            <p className="text-[10px] text-ds-text3 mt-0.5">{unitLabel(slot.academicUnit)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-ds-text3">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
