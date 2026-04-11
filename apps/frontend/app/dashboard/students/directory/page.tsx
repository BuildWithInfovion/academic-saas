'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface Student {
  id: string;
  admissionNo: string;
  rollNo?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  fatherName?: string;
  motherName?: string;
  parentPhone?: string;
  academicUnitId?: string;
  status?: string;
  academicUnit?: { id: string; name: string; displayName?: string };
  parentUser?: { id: string } | null;
}

interface AcademicUnit {
  id: string;
  name: string;
  displayName?: string;
  _count?: { students: number };
}

function initials(s: Student) {
  return `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase();
}

// ── Excel / CSV export ────────────────────────────────────────────────────────
function exportToCSV(students: Student[], label: string) {
  const headers = [
    'Adm No', 'First Name', 'Last Name', 'Class', 'Roll No',
    'Gender', 'Date of Birth', 'Phone', 'Email',
    'Father Name', 'Mother Name', 'Parent Phone', 'Address', 'Status',
  ];

  const rows = students.map((s) => [
    s.admissionNo,
    s.firstName,
    s.lastName,
    s.academicUnit?.displayName || s.academicUnit?.name || '',
    s.rollNo || '',
    s.gender || '',
    s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('en-IN') : '',
    s.phone || '',
    s.email || '',
    s.fatherName || '',
    s.motherName || '',
    s.parentPhone || '',
    s.address || '',
    s.status || 'active',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `students-${label.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Class order for sorting
const CLASS_ORDER = [
  'lkg', 'ukg', 'kg',
  'class_1','class_2','class_3','class_4','class_5','class_6','class_7',
  'class_8','class_9','class_10','class_11','class_12',
];

function sortClasses(units: AcademicUnit[]): AcademicUnit[] {
  return [...units].sort((a, b) => {
    const ai = CLASS_ORDER.indexOf(a.name.toLowerCase());
    const bi = CLASS_ORDER.indexOf(b.name.toLowerCase());
    if (ai === -1 && bi === -1) return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function StudentDirectoryPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [academicUnits, setAcademicUnits] = useState<AcademicUnit[]>([]);
  const [unitsLoading, setUnitsLoading]   = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // Global search state
  const [globalSearch, setGlobalSearch]   = useState('');
  const [globalResults, setGlobalResults] = useState<Student[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const globalDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Class view state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classStudents, setClassStudents]     = useState<Student[]>([]);
  const [classLoading, setClassLoading]       = useState(false);
  const [classSearch, setClassSearch]         = useState('');
  const [exporting, setExporting]             = useState(false);

  // Load academic units (fast — no student data)
  const loadUnits = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const u = await apiFetch('/academic/units/classes');
      const raw: AcademicUnit[] = Array.isArray(u) ? u : [];
      // Deduplicate by displayName/name
      const seen = new Set<string>();
      const deduped: AcademicUnit[] = [];
      for (const unit of raw) {
        const key = (unit.displayName || unit.name).toLowerCase();
        if (!seen.has(key)) { seen.add(key); deduped.push(unit); }
      }
      setAcademicUnits(sortClasses(deduped));
    } catch (e: any) {
      setError(e.message || 'Failed to load classes');
    } finally {
      setUnitsLoading(false);
    }
  }, [user?.institutionId]);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  // Lazy-load students when a class is selected
  const loadClassStudents = useCallback(async (unitId: string) => {
    setClassLoading(true);
    setClassStudents([]);
    setClassSearch('');
    try {
      const res = await apiFetch(`/students?unitId=${unitId}&limit=500`);
      setClassStudents((res as any).data || res || []);
    } catch {
      setClassStudents([]);
    } finally {
      setClassLoading(false);
    }
  }, []);

  const handleClassSelect = (unitId: string) => {
    setSelectedClassId(unitId);
    setGlobalSearch('');
    setGlobalResults([]);
    loadClassStudents(unitId);
  };

  // Global search — debounced, cross-class
  const handleGlobalSearch = (q: string) => {
    setGlobalSearch(q);
    setSelectedClassId('');
    setClassStudents([]);
    if (globalDebounce.current) clearTimeout(globalDebounce.current);
    if (!q.trim()) { setGlobalResults([]); return; }
    globalDebounce.current = setTimeout(async () => {
      setGlobalLoading(true);
      try {
        const res = await apiFetch(`/students?search=${encodeURIComponent(q.trim())}&limit=50`);
        setGlobalResults((res as any).data || res || []);
      } catch {
        setGlobalResults([]);
      } finally {
        setGlobalLoading(false);
      }
    }, 350);
  };

  const selectedUnit = academicUnits.find((u) => u.id === selectedClassId);
  const selectedClassName = selectedUnit?.displayName || selectedUnit?.name || '';

  // Client-side filter within loaded class students
  const filtered = classSearch.trim()
    ? classStudents.filter((s) => {
        const q = classSearch.toLowerCase();
        return (
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          (s.parentPhone || '').includes(q) ||
          (s.phone || '').includes(q)
        );
      })
    : classStudents;

  const isGlobalMode = globalSearch.trim().length > 0;

  const StudentRow = ({ s }: { s: Student }) => (
    <tr
      key={s.id}
      onClick={() => router.push(`/dashboard/students/${s.id}`)}
      className="cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{s.rollNo || '—'}</td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.admissionNo}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
            {initials(s)}
          </div>
          <div>
            <p className="font-medium text-gray-800">{s.firstName} {s.lastName}</p>
            {s.gender && <p className="text-xs text-gray-400 capitalize">{s.gender}</p>}
          </div>
        </div>
      </td>
      {isGlobalMode && (
        <td className="px-4 py-3 text-xs text-gray-500">
          {s.academicUnit?.displayName || s.academicUnit?.name || '—'}
        </td>
      )}
      <td className="px-4 py-3 text-gray-600 text-xs">{s.parentPhone || '—'}</td>
      <td className="px-4 py-3">
        {s.parentUser ? (
          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Linked
          </span>
        ) : (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            No portal
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs text-indigo-500">View →</span>
      </td>
    </tr>
  );

  return (
    <div className="p-8 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Student Directory</h1>
          <p className="text-sm text-gray-400 mt-0.5">Search students or select a class to browse</p>
        </div>
        <a href="/dashboard/students"
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          + New Admission
        </a>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}

      {/* ── Global search bar ── */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black shadow-sm"
            placeholder="Search all students by name, admission no., or parent phone…"
            value={globalSearch}
            onChange={(e) => handleGlobalSearch(e.target.value)}
          />
          {globalSearch && (
            <button
              onClick={() => { setGlobalSearch(''); setGlobalResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Global search results ── */}
      {isGlobalMode && (
        <div className="mb-6">
          {globalLoading ? (
            <p className="text-sm text-gray-400 px-1">Searching…</p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2 px-1">
                {globalResults.length === 0 ? 'No students found' : `${globalResults.length} result${globalResults.length !== 1 ? 's' : ''} for "${globalSearch}"`}
              </p>
              {globalResults.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adm. No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Portal</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {globalResults.map((s) => <StudentRow key={s.id} s={s} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Class selector grid ── */}
      {!isGlobalMode && (
        <>
          {unitsLoading ? (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Loading classes…</div>
          ) : (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Browse by Class</p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-15">
                {academicUnits.map((unit) => {
                  const count = unit._count?.students ?? 0;
                  const isSelected = selectedClassId === unit.id;
                  return (
                    <button
                      key={unit.id}
                      onClick={() => handleClassSelect(unit.id)}
                      className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-gray-900 border-gray-900 text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:shadow-sm'
                      }`}
                    >
                      <span className="text-xs font-semibold leading-tight">{unit.displayName || unit.name}</span>
                      <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>{count} students</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── No class selected ── */}
          {!selectedClassId && !unitsLoading && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Select a class above to view students</p>
              <p className="text-gray-400 text-sm mt-1">or use the search bar to find any student</p>
            </div>
          )}

          {/* ── Class selected — show students ── */}
          {selectedClassId && (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder={`Filter within ${selectedClassName}…`}
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => { setExporting(true); try { exportToCSV(classStudents, selectedClassName); } finally { setExporting(false); } }}
                  disabled={exporting || classStudents.length === 0}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export {selectedClassName}
                </button>
              </div>

              {/* Count */}
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
                <span className="font-medium text-gray-800">{selectedClassName}</span>
                <span>·</span>
                <span>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
                {classSearch && (
                  <button onClick={() => setClassSearch('')} className="text-xs text-indigo-600 hover:underline ml-1">
                    Clear filter
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {classLoading ? (
                  <div className="p-10 text-center text-gray-400 text-sm">Loading students…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-sm">
                    {classStudents.length === 0
                      ? `No students in ${selectedClassName} yet.`
                      : 'No students match your filter.'}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adm. No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Portal</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((s) => <StudentRow key={s.id} s={s} />)}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
