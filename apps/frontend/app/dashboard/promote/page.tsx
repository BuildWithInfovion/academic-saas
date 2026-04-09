'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface ClassTeacherUnit {
  id: string;
  name: string;
  displayName: string | null;
  classTeacher: { id: string; email: string | null; phone: string | null } | null;
  parent: { name: string; displayName: string | null } | null;
}

function unitLabel(u: { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null }) {
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

export default function PromotePage() {
  const [units, setUnits] = useState<ClassTeacherUnit[]>([]);

  const load = useCallback(() => {
    apiFetch('/academic/class-teachers')
      .then((res: unknown) => setUnits(Array.isArray(res) ? (res as ClassTeacherUnit[]) : []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const assigned = units.filter((u) => u.classTeacher);
  const unassigned = units.filter((u) => !u.classTeacher);

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Promotion — Operator View</h1>
      <p className="text-sm text-gray-400 mb-6">
        Student promotion is now handled by class teachers from their portal. Assign class teachers below to enable it.
      </p>

      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-8">
        <p className="text-sm font-semibold text-indigo-800 mb-1">Class Teacher Workflow</p>
        <ul className="text-xs text-indigo-700 space-y-1 list-disc list-inside">
          <li>Each class must have a designated Class Teacher assigned from the Classes page.</li>
          <li>The Class Teacher logs into the Teacher Portal and uses the Promote section to promote, transfer, or hold back students.</li>
          <li>As an operator you can track which classes are ready (class teacher assigned) below.</li>
        </ul>
      </div>

      {/* Assigned */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Ready for Promotion ({assigned.length} class{assigned.length !== 1 ? 'es' : ''})
        </h2>
        {assigned.length === 0 ? (
          <p className="text-sm text-gray-500">No classes have a class teacher assigned yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Class</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Class Teacher</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assigned.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 font-medium text-gray-800">{unitLabel(u)}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {u.classTeacher?.email || u.classTeacher?.phone || u.classTeacher?.id}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Ready
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Needs Class Teacher ({unassigned.length})
          </h2>
          <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-amber-50">
                <tr>
                  <th className="text-left px-5 py-3 text-amber-600 font-medium text-xs">Class</th>
                  <th className="text-left px-5 py-3 text-amber-600 font-medium text-xs">Action Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {unassigned.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 font-medium text-gray-800">{unitLabel(u)}</td>
                    <td className="px-5 py-3 text-xs text-amber-700">
                      Assign a class teacher from the{' '}
                      <a href="/dashboard/classes" className="underline font-medium">Classes</a> page
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
