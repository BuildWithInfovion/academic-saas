'use client';

import { useEffect, useState, useCallback } from 'react';
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
  secondaryPhone?: string;
  admissionDate?: string;
  academicUnitId?: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  aadharNumber?: string;
  tcFromPrevious?: string;
  tcPreviousInstitution?: string;
  status?: string;
  createdAt: string;
  academicUnit?: { id: string; name: string; displayName?: string };
  userAccount?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  parentUser?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
}

interface AcademicUnit {
  id: string;
  name: string;
  displayName?: string;
}

function initials(s: Student) {
  return `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase();
}

export default function StudentDirectoryPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [academicUnits, setAcademicUnits] = useState<AcademicUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');

  const loadData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      // Fetch up to 2000 students to cover large institutions
      const [s, u] = await Promise.all([
        apiFetch('/students?page=1&limit=2000'),
        apiFetch('/academic/units/classes'),
      ]);
      setStudents((s as any).data || s || []);

      // Deduplicate units by displayName/name so duplicate class records don't show twice
      const raw: AcademicUnit[] = Array.isArray(u) ? u : [];
      const seen = new Set<string>();
      const deduped: AcademicUnit[] = [];
      for (const unit of raw) {
        const key = (unit.displayName || unit.name).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(unit);
        }
      }
      setAcademicUnits(deduped);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user?.institutionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Match student to a class unit — try academicUnit relation first, then look up by ID
  const getUnit = (s: Student) =>
    academicUnits.find((u) => u.id === s.academicUnitId) ?? s.academicUnit ?? null;

  const filtered = students.filter((s) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.admissionNo.toLowerCase().includes(q) ||
      (s.parentPhone || '').includes(q) ||
      (s.phone || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );

    // Filter: match against both the selected unit ID AND the student's embedded unit
    // (handles case where student was seeded with a different unit ID than what's in dropdown)
    if (filterClass) {
      const selectedUnit = academicUnits.find((u) => u.id === filterClass);
      const studentUnit = getUnit(s);
      const matchById = s.academicUnitId === filterClass;
      const matchByName = selectedUnit && studentUnit &&
        (studentUnit.displayName || studentUnit.name)?.toLowerCase() ===
        (selectedUnit.displayName || selectedUnit.name)?.toLowerCase();
      if (!matchById && !matchByName) return false;
    }

    return matchSearch;
  });

  return (
    <div className="p-8 overflow-auto h-full">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Student Directory</h1>
          <p className="text-sm text-gray-400 mt-0.5">Search and manage all student records</p>
        </div>
        <a href="/dashboard/students"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← New Admission
        </a>
      </div>

      {error && <div className="mt-3 mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}

      {/* Search + Filter */}
      <div className="flex gap-3 mt-5 mb-4">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="Search by name, admission no, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black min-w-36"
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        >
          <option value="">All Classes</option>
          {academicUnits.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName || u.name}</option>
          ))}
        </select>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <span>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
        {(search || filterClass) && (
          <button onClick={() => { setSearch(''); setFilterClass(''); }}
            className="text-xs text-indigo-600 hover:underline ml-2">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading students...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            {students.length === 0
              ? 'No students yet. Use New Admission to add students.'
              : 'No results match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Adm. No', 'Name', 'Class', 'Parent Phone', 'Portal', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => {
                const unit = getUnit(s);
                const hasParent = !!s.parentUser;
                return (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/dashboard/students/${s.id}`)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
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
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {(unit as any)?.displayName || (unit as any)?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{s.parentPhone || '—'}</td>
                    <td className="px-4 py-3">
                      {hasParent ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Parent linked
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
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
