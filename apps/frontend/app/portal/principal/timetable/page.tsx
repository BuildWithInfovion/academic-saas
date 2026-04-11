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
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');

  useEffect(() => {
    Promise.all([
      apiFetch('/academic/units/leaf'),
      apiFetch('/users?role=teacher'),
    ]).then(([u, t]: unknown[]) => {
      setUnits(Array.isArray(u) ? (u as AcademicUnit[]) : []);
      setTeachers(Array.isArray(t) ? (t as Teacher[]) : []);
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

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Timetable</h1>
      <p className="text-sm text-gray-400 mb-6">View class schedules and teacher assignments</p>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-5">
        {(['class', 'teacher'] as const).map((m) => (
          <button key={m} onClick={() => { setViewMode(m); setSlots([]); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
              viewMode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {m === 'class' ? 'Class Timetable' : 'Teacher Periods'}
          </button>
        ))}
      </div>

      {/* Selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        {viewMode === 'class' ? (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Select Class</label>
            <select
              className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black w-64"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              <option value="">Choose a class…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Select Teacher</label>
            <select
              className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black w-72"
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
        <p className="text-sm text-gray-400">Loading…</p>
      ) : ((viewMode === 'class' && selectedUnit) || (viewMode === 'teacher' && selectedTeacher)) ? (
        slots.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
            No timetable configured yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-16 border-b border-gray-100">Period</th>
                  {displayDays.map((d) => (
                    <th key={d.no} className="px-3 py-3 text-center text-xs font-semibold text-gray-600 border-b border-gray-100 min-w-[160px]">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 text-xs font-bold text-gray-400 bg-gray-50 text-center">P{p}</td>
                    {displayDays.map((d) => {
                      const slot = slotMap.get(`${d.no}-${p}`);
                      return (
                        <td key={d.no} className="px-3 py-2 border-l border-gray-50 align-top">
                          {slot?.subject ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{slot.subject.name}</p>
                              {viewMode === 'class' && slot.teacher && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{teacherLabel(slot.teacher)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">— Free —</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
          {viewMode === 'class' ? 'Select a class to view its timetable.' : 'Select a teacher to view their periods.'}
        </div>
      )}
    </div>
  );
}
