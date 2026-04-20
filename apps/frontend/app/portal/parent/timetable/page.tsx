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

type TimetableSlot = {
  id: string;
  dayOfWeek: number;
  periodNo: number;
  subject: { id: string; name: string; code?: string | null } | null;
  teacher: { id: string; email: string | null; phone: string | null } | null;
};

const DAYS = [
  { no: 1, label: 'Monday' },
  { no: 2, label: 'Tuesday' },
  { no: 3, label: 'Wednesday' },
  { no: 4, label: 'Thursday' },
  { no: 5, label: 'Friday' },
  { no: 6, label: 'Saturday' },
];

export default function ParentTimetablePage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    apiFetch('/students/child')
      .then((res) => {
        const kids = Array.isArray(res) ? (res as Child[]) : [];
        setChildren(kids);
        if (kids.length === 0) { setNotLinked(true); return; }
        setSelectedChildId(kids[0].id);
      })
      .catch(() => setNotLinked(true));
  }, []);

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const unitId = selectedChild?.academicUnit?.id;

  useEffect(() => {
    if (!unitId) { setSlots([]); return; }
    setLoading(true);
    apiFetch(`/timetable/units/${unitId}`)
      .then((s) => setSlots(Array.isArray(s) ? (s as TimetableSlot[]) : []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [unitId]);

  if (notLinked) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5 text-sm text-ds-warning-text">
          Your child's record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  const slotMap = new Map<string, TimetableSlot>();
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.periodNo}`, s);
  const maxPeriod = slots.length > 0 ? Math.max(...slots.map((s) => s.periodNo)) : 7;
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
  const activeDays = DAYS.filter((d) => slots.some((s) => s.dayOfWeek === d.no));
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  const unitLabel = selectedChild?.academicUnit?.displayName || selectedChild?.academicUnit?.name || '';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Class Timetable</h1>
      <p className="text-sm text-ds-text3 mb-6">Weekly schedule for your child's class</p>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="mb-5">
          <label className="text-xs font-medium text-ds-text2 block mb-1">Child</label>
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand"
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Child info chip */}
      {selectedChild && (
        <div className="flex items-center gap-3 bg-ds-surface border border-ds-border rounded-xl p-4 shadow-sm mb-6 w-fit">
          <div className="w-9 h-9 rounded-full bg-ds-bg2 flex items-center justify-center text-ds-text2 font-semibold text-sm shrink-0">
            {selectedChild.firstName[0]}{selectedChild.lastName[0]}
          </div>
          <div>
            <p className="font-semibold text-ds-text1 text-sm">{selectedChild.firstName} {selectedChild.lastName}</p>
            <p className="text-xs text-ds-text3">{unitLabel} · {selectedChild.admissionNo}</p>
          </div>
        </div>
      )}

      {/* No class assigned */}
      {selectedChild && !unitId && (
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5 text-sm text-ds-warning-text">
          No class has been assigned to your child yet. Please contact the school admin.
        </div>
      )}

      {/* Timetable grid */}
      {unitId && (
        loading ? (
          <p className="text-sm text-ds-text3">Loading timetable...</p>
        ) : slots.length === 0 ? (
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center">
            <p className="text-ds-text3 text-sm">No timetable has been configured for {unitLabel} yet.</p>
          </div>
        ) : (
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-ds-bg2">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ds-text2 w-16 border-b border-ds-border">Period</th>
                  {displayDays.map((d) => (
                    <th key={d.no} className="px-3 py-3 text-center text-xs font-semibold text-ds-text2 border-b border-ds-border min-w-[140px]">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p} className="border-b border-ds-border last:border-0">
                    <td className="px-4 py-3 text-xs font-bold text-ds-text3 bg-ds-bg2 text-center">P{p}</td>
                    {displayDays.map((d) => {
                      const slot = slotMap.get(`${d.no}-${p}`);
                      return (
                        <td key={d.no} className="px-3 py-2.5 border-l border-ds-border align-top">
                          {slot?.subject ? (
                            <div>
                              <p className="text-xs font-semibold text-ds-text1">{slot.subject.name}</p>
                              {slot.teacher && (
                                <p className="text-[10px] text-ds-text3 mt-0.5">
                                  {slot.teacher.email?.split('@')[0] || slot.teacher.phone || ''}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-ds-text3">— Free —</span>
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
      )}
    </div>
  );
}
