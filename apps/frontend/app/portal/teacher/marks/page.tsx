'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface Subject { id: string; name: string; }
interface AcademicUnit { id: string; name: string; displayName: string | null; }
interface AssignedExamSubject {
  id: string; subjectId: string; academicUnitId: string;
  maxMarks: number; passingMarks: number;
  subject: Subject; academicUnit: AcademicUnit;
}
interface AssignedExam {
  id: string; name: string; status: string;
  academicYear: { name: string };
  subjects: AssignedExamSubject[];
}
interface Student { id: string; firstName: string; lastName: string; rollNo: string | null; admissionNo: string; }
interface ExamResult { studentId: string; subjectId: string; marksObtained: number | null; isAbsent: boolean; }

export default function TeacherMarksPage() {
  const [assignedExams, setAssignedExams] = useState<AssignedExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<AssignedExamSubject | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { value: string; absent: boolean }>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAssignments, setNoAssignments] = useState(false);

  useEffect(() => {
    apiFetch('/exams/my-assigned')
      .then((res: unknown) => {
        const exams = Array.isArray(res) ? (res as AssignedExam[]) : [];
        setAssignedExams(exams);
        if (exams.length === 0) setNoAssignments(true);
      })
      .catch(() => setNoAssignments(true));
  }, []);

  const selectedExam = assignedExams.find((e) => e.id === selectedExamId) ?? null;

  // Flat list of all assignments for the selected exam
  const assignments = selectedExam?.subjects ?? [];

  const loadMarks = useCallback(() => {
    if (!selectedExamId || !selectedAssignment) return;
    setLoading(true);
    setStudents([]);
    setMarks({});

    Promise.all([
      apiFetch(`/attendance/units/${selectedAssignment.academicUnitId}/students`),
      apiFetch(`/exams/${selectedExamId}/results?unitId=${selectedAssignment.academicUnitId}`),
    ])
      .then(([studentList, results]: unknown[]) => {
        const sl = studentList as Student[];
        const rs = results as ExamResult[];
        setStudents(sl);
        const initial: Record<string, { value: string; absent: boolean }> = {};
        for (const s of sl) {
          const existing = rs.find((r) => r.studentId === s.id && r.subjectId === selectedAssignment.subjectId);
          initial[s.id] = {
            value: existing?.marksObtained != null ? String(existing.marksObtained) : '',
            absent: existing?.isAbsent ?? false,
          };
        }
        setMarks(initial);
      })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [selectedExamId, selectedAssignment]);

  useEffect(() => { loadMarks(); }, [loadMarks]);

  const handleSave = async () => {
    if (!selectedAssignment) return;
    setSaving(true); setError(null);
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        isAbsent: marks[s.id]?.absent ?? false,
        marksObtained: marks[s.id]?.absent
          ? undefined
          : marks[s.id]?.value !== '' ? Number(marks[s.id]?.value) : undefined,
      }));
      await apiFetch('/exams/results', {
        method: 'POST',
        body: JSON.stringify({
          examId: selectedExamId,
          academicUnitId: selectedAssignment.academicUnitId,
          subjectId: selectedAssignment.subjectId,
          entries,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const enteredCount = Object.values(marks).filter((m) => m.absent || m.value !== '').length;
  const maxMarks = selectedAssignment?.maxMarks ?? 100;

  if (noAssignments) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Mark Entry</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-sm font-medium text-amber-800 mb-1">No active exams assigned to you</p>
          <p className="text-xs text-amber-600">
            The operator needs to: 1) assign subjects to you in the Subjects page, and 2) activate an exam that includes those subjects.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Mark Entry</h1>
      <p className="text-sm text-gray-500 mb-6">You can only enter marks for subjects assigned to you</p>

      {/* Selectors */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6 space-y-4">
        {/* Exam selector */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Examination</label>
          <select
            value={selectedExamId}
            onChange={(e) => { setSelectedExamId(e.target.value); setSelectedAssignment(null); }}
            className="w-full max-w-xs p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">Select exam...</option>
            {assignedExams.map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {e.academicYear.name}</option>
            ))}
          </select>
        </div>

        {/* Assignment selector — class + subject combinations assigned to this teacher */}
        {selectedExam && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Class &amp; Subject (your assignments only)
            </label>
            <div className="flex flex-wrap gap-2">
              {assignments.map((a) => {
                const isSelected = selectedAssignment?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAssignment(a)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {a.academicUnit.displayName || a.academicUnit.name} — {a.subject.name}
                    <span className="ml-1.5 opacity-60">/ {a.maxMarks}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mark entry table */}
      {selectedAssignment && (
        loading ? (
          <p className="text-sm text-gray-500">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-500">No students in this class.</p>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {selectedAssignment.academicUnit.displayName || selectedAssignment.academicUnit.name}
                  {' — '}{selectedAssignment.subject.name}
                  {' · '}{students.length} students · Max: {maxMarks}
                </p>
                <p className="text-xs text-gray-400">
                  {enteredCount}/{students.length} entered
                  {enteredCount === students.length && <span className="ml-2 text-green-600 font-medium">Complete ✓</span>}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">#</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Student</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Roll No</th>
                    <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Absent</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium text-xs">Marks / {maxMarks}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map((s, i) => {
                    const m = marks[s.id] ?? { value: '', absent: false };
                    return (
                      <tr key={s.id} className={m.absent ? 'bg-gray-50' : ''}>
                        <td className="px-5 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-5 py-2.5 text-gray-800 font-medium">{s.firstName} {s.lastName}</td>
                        <td className="px-5 py-2.5 text-gray-500 text-xs">{s.rollNo ?? s.admissionNo}</td>
                        <td className="px-5 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={m.absent}
                            onChange={(e) =>
                              setMarks((prev) => ({ ...prev, [s.id]: { ...m, absent: e.target.checked, value: '' } }))
                            }
                            className="w-4 h-4 accent-black"
                          />
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <input
                            type="number" min={0} max={maxMarks}
                            value={m.value}
                            disabled={m.absent}
                            onChange={(e) =>
                              setMarks((prev) => ({ ...prev, [s.id]: { ...m, value: e.target.value } }))
                            }
                            placeholder="—"
                            className="w-20 p-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            {saved && <p className="text-sm text-green-600 mb-3">Marks saved successfully.</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Marks'}
            </button>
          </>
        )
      )}
    </div>
  );
}
