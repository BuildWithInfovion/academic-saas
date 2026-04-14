'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Unit = { id: string; displayName: string; name: string };
type Exam = { id: string; name: string; status: string };

export default function DirectorOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ students: 0, staff: 0 });
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeExams, setActiveExams] = useState<Exam[]>([]);
  const [attendanceAlerts, setAttendanceAlerts] = useState(0);
  const [feeDefaultersCount, setFeeDefaultersCount] = useState(0);
  const [todayDate] = useState(
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  );
  const now = new Date();

  useEffect(() => {
    Promise.all([
      apiFetch('/students/count'),
      apiFetch('/academic/years'),
      apiFetch('/academic/units/leaf'),
      apiFetch('/users'),
    ])
      .then(([count, years, leafUnits, users]) => {
        setStats({ students: count.totalStudents ?? 0, staff: users.length ?? 0 });
        const yr: AcademicYear = years.find((y: AcademicYear) => y.isCurrent) ?? years[0] ?? null;
        setCurrentYear(yr);
        setUnits(leafUnits);

        if (yr) {
          apiFetch(`/exams?yearId=${yr.id}`)
            .then((exams: Exam[]) => setActiveExams(exams.filter((e) => e.status === 'active')))
            .catch(() => {});

          apiFetch(`/fees/defaulters?yearId=${yr.id}`)
            .then((d: any[]) => setFeeDefaultersCount(d?.length ?? 0))
            .catch(() => {});

          if (leafUnits.length > 0) {
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            Promise.all(
              leafUnits.slice(0, 5).map((u: Unit) =>
                apiFetch(`/attendance/units/${u.id}/defaulters?year=${year}&month=${month}&threshold=75`).catch(() => [])
              )
            ).then((results) => {
              const all = (results as any[][]).flat();
              setAttendanceAlerts(all.length);
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  const statCards = [
    { label: 'Total Students', value: stats.students, sub: 'Enrolled', color: 'bg-white' },
    { label: 'Academic Year', value: currentYear?.name ?? '—', sub: 'Current', color: 'bg-white' },
    { label: 'Classes', value: units.length, sub: 'Active divisions', color: 'bg-white' },
    { label: 'Staff Accounts', value: stats.staff, sub: 'System users', color: 'bg-white' },
  ];

  const alertCards = [
    {
      label: 'Attendance Alerts',
      value: attendanceAlerts,
      desc: 'Students below 75% this month',
      color: attendanceAlerts > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200',
      textColor: attendanceAlerts > 0 ? 'text-amber-700' : 'text-green-700',
    },
    {
      label: 'Fee Defaulters',
      value: feeDefaultersCount,
      desc: 'Outstanding balances this year',
      color: feeDefaultersCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200',
      textColor: feeDefaultersCount > 0 ? 'text-red-700' : 'text-green-700',
    },
    {
      label: 'Active Exams',
      value: activeExams.length,
      desc: activeExams.length > 0 ? activeExams.map((e) => e.name).join(', ') : 'No exams running',
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700',
    },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Institution Overview</h1>
        <p className="text-sm text-gray-400 mt-1">{todayDate}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.color} rounded-xl border border-gray-100 shadow-sm p-4`}>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="text-sm font-medium text-gray-600 mt-1">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Alert panels */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {alertCards.map((a) => (
          <div key={a.label} className={`rounded-xl border p-4 ${a.color}`}>
            <p className={`text-3xl font-bold ${a.textColor}`}>{a.value}</p>
            <p className={`text-sm font-semibold mt-1 ${a.textColor}`}>{a.label}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* Quick navigation */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Detailed Reports', desc: 'Attendance, fees & exam breakdown by class', path: '/portal/director/reports', bg: 'bg-black text-white' },
            { label: 'Staff Directory', desc: 'View all staff accounts and roles', path: '/portal/director/staff', bg: 'bg-gray-800 text-white' },
            { label: 'Institution Settings', desc: 'Configure academic structure & preferences', path: '/portal/director/settings', bg: 'bg-gray-600 text-white' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className={`rounded-xl p-4 text-left hover:opacity-90 transition-opacity ${item.bg}`}
            >
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs mt-1 opacity-70">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Active exams table */}
      {activeExams.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Active Examinations</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {activeExams.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-800 font-medium">{e.name}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
