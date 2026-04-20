'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Unit = { id: string; displayName: string; name: string };
type Student = { id: string; firstName: string; lastName: string; rollNo: string | null; admissionNo: string };
type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-ds-success-bg text-ds-success-text border-green-300',
  absent:  'bg-ds-error-bg text-ds-error-text border-red-300',
  late:    'bg-yellow-100 text-yellow-700 border-yellow-300',
  leave:   'bg-ds-info-bg text-ds-info-text border-blue-300',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  late: 'L',
  leave: 'Lv',
};

export default function TeacherAttendancePage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/academic/units/leaf').then(setUnits).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedUnit) return;
    setLoadingStudents(true);
    setStudents([]);
    setAttendance({});
    setSaved(false);

    Promise.all([
      apiFetch(`/attendance/units/${selectedUnit}/students`),
      apiFetch(`/attendance/units/${selectedUnit}/daily?date=${date}`),
    ]).then(([studentList, session]) => {
      setStudents(studentList);
      const initial: Record<string, AttendanceStatus> = {};
      if (session && session.records && session.records.length > 0) {
        for (const r of session.records) {
          initial[r.studentId] = r.status as AttendanceStatus;
        }
      } else {
        // default all present
        for (const s of studentList) initial[s.id] = 'present';
      }
      setAttendance(initial);
    }).catch((e) => setError(e.message)).finally(() => setLoadingStudents(false));
  }, [selectedUnit, date]);

  const toggleStatus = (studentId: string) => {
    const cycle: AttendanceStatus[] = ['present', 'absent', 'late', 'leave'];
    const current = attendance[studentId] ?? 'present';
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    setAttendance((prev) => ({ ...prev, [studentId]: next }));
  };

  const markAll = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (all[s.id] = status));
    setAttendance(all);
  };

  const handleSave = async () => {
    if (!selectedUnit) return;
    setSaving(true);
    setError(null);
    try {
      const records = students.map((s) => ({
        studentId: s.id,
        status: attendance[s.id] ?? 'present',
      }));
      await apiFetch('/attendance', {
        method: 'POST',
        body: JSON.stringify({ academicUnitId: selectedUnit, date, records }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const summary = students.reduce((acc, s) => {
    const st = attendance[s.id] ?? 'present';
    acc[st] = (acc[st] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-xl sm:text-2xl font-bold text-ds-text1 mb-1">Mark Attendance</h1>
      <p className="text-sm text-ds-text2 mb-6">Daily class attendance — tap a status badge to cycle P → A → L → Lv</p>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="text-xs font-medium text-ds-text2 block mb-1">Class</label>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full p-2.5 border border-ds-border-strong rounded-lg text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand"
          >
            <option value="">Select class...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName || u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand"
          />
        </div>
      </div>

      {selectedUnit && students.length > 0 && (
        <>
          {/* Summary + bulk actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2 text-sm">
              {(['present', 'absent', 'late', 'leave'] as AttendanceStatus[]).map((s) => (
                <span key={s} className={`px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[s]}`}>
                  {STATUS_LABELS[s]} {summary[s] ?? 0}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => markAll('present')} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-ds-success-text border border-green-200 hover:bg-green-100">
                All Present
              </button>
              <button onClick={() => markAll('absent')} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-ds-error-text border border-red-200 hover:bg-red-100">
                All Absent
              </button>
            </div>
          </div>

          {/* Student list */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-ds-bg2 border-b border-ds-border">
                <tr>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium w-12">#</th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium">Student</th>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium">Roll No</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {students.map((s, i) => {
                  const status = attendance[s.id] ?? 'present';
                  return (
                    <tr key={s.id} className="hover:bg-ds-bg2/50">
                      <td className="px-5 py-3 text-ds-text3 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 text-ds-text1 font-medium">{s.firstName} {s.lastName}</td>
                      <td className="px-5 py-3 text-ds-text2">{s.rollNo ?? s.admissionNo}</td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => toggleStatus(s.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${STATUS_STYLES[status]}`}
                        >
                          {STATUS_LABELS[status]}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          {saved && <p className="text-sm text-ds-success-text mb-3">Attendance saved successfully.</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-brand px-6 py-2.5 rounded-lg"
          >
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </>
      )}

      {selectedUnit && loadingStudents && (
        <p className="text-sm text-ds-text2">Loading students...</p>
      )}

      {selectedUnit && !loadingStudents && students.length === 0 && (
        <p className="text-sm text-ds-text2">No active students in this class.</p>
      )}
    </div>
  );
}
