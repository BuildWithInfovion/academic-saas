'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Unit = { id: string; displayName: string; name: string };
type Defaulter = { id: string; firstName: string; lastName: string; percentage: number };
type FeeDefaulter = { id: string; firstName: string; lastName: string; balance: number };
type StudentCount = { totalStudents: number; boys: number; girls: number };

export default function PrincipalDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ students: 0, staff: 0, boys: 0, girls: 0 });
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [attendanceDefaulters, setAttendanceDefaulters] = useState<Defaulter[]>([]);
  const [feeDefaulters, setFeeDefaulters] = useState<FeeDefaulter[]>([]);
  const [todayDate] = useState(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const now = new Date();

  useEffect(() => {
    Promise.all([
      apiFetch('/students/count'),
      apiFetch('/academic/years'),
      apiFetch('/academic/units/leaf'),
      apiFetch('/users'),
    ]).then(([count, years, leafUnits, users]) => {
      const sc = count as StudentCount;
      setStats({ students: sc.totalStudents ?? 0, staff: users.length ?? 0, boys: sc.boys ?? 0, girls: sc.girls ?? 0 });
      const yr = years.find((y: AcademicYear) => y.isCurrent) ?? years[0] ?? null;
      setCurrentYear(yr);
      setUnits(leafUnits);

      // Load attendance defaulters for first unit if exists
      if (leafUnits.length > 0 && yr) {
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        // Fetch defaulters across all units (use first as sample)
        Promise.all(
          leafUnits.slice(0, 5).map((u: Unit) =>
            apiFetch(`/attendance/units/${u.id}/defaulters?year=${year}&month=${month}&threshold=75`).catch(() => [])
          )
        ).then((results) => {
          const all = results.flat() as Defaulter[];
          setAttendanceDefaulters(all.slice(0, 8));
        });

        // Fee defaulters
        if (yr) {
          apiFetch(`/fees/defaulters?yearId=${yr.id}`).then((d) => setFeeDefaulters((d ?? []).slice(0, 8))).catch(() => {});
        }
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-ds-text1">Principal Dashboard</h1>
        <p className="text-sm text-ds-text3 mt-1">{todayDate}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Students" value={stats.students} sub={`Boys ${stats.boys} · Girls ${stats.girls}`} />
        <StatCard label="Academic Year" value={currentYear?.name ?? '—'} sub="Current year" />
        <StatCard label="Classes" value={units.length} sub="Leaf units" />
        <StatCard label="Staff Accounts" value={stats.staff} sub="System users" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Attendance Reports', desc: 'Class-wise defaulter list', path: '/portal/principal/attendance', color: 'btn-brand' },
          { label: 'Fee Reports', desc: 'Outstanding dues overview', path: '/portal/principal/fees', color: 'btn-brand' },
          { label: 'Announcements', desc: 'School-wide notices', path: '/portal/principal/announcements', color: 'btn-brand' },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => router.push(a.path)}
            className={`rounded-xl p-5 text-left hover:opacity-90 transition-opacity ${a.color}`}
          >
            <p className="font-semibold text-sm">{a.label}</p>
            <p className="text-xs mt-1 opacity-70">{a.desc}</p>
          </button>
        ))}
      </div>

      {/* Defaulter panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Attendance defaulters */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm">
          <div className="px-5 py-4 border-b border-ds-border">
            <h2 className="font-semibold text-ds-text1 text-sm">Attendance Defaulters</h2>
            <p className="text-xs text-ds-text3 mt-0.5">Below 75% this month</p>
          </div>
          <div className="divide-y divide-ds-border">
            {attendanceDefaulters.length === 0 ? (
              <p className="text-sm text-ds-text3 px-5 py-4">No defaulters this month.</p>
            ) : attendanceDefaulters.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-ds-text1">{d.firstName} {d.lastName}</span>
                <span className="text-xs font-semibold text-red-600">{d.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fee defaulters */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm">
          <div className="px-5 py-4 border-b border-ds-border">
            <h2 className="font-semibold text-ds-text1 text-sm">Fee Defaulters</h2>
            <p className="text-xs text-ds-text3 mt-0.5">Outstanding balance</p>
          </div>
          <div className="divide-y divide-ds-border">
            {feeDefaulters.length === 0 ? (
              <p className="text-sm text-ds-text3 px-5 py-4">No fee defaulters found.</p>
            ) : feeDefaulters.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-ds-text1">{d.firstName} {d.lastName}</span>
                <span className="text-xs font-semibold text-red-600">₹{d.balance?.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4">
      <p className="text-2xl font-bold text-ds-text1">{value}</p>
      <p className="text-sm font-medium text-ds-text2 mt-1">{label}</p>
      <p className="text-xs text-ds-text3">{sub}</p>
    </div>
  );
}
