'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Unit = { id: string; displayName: string; name: string };
type Exam = { id: string; name: string; status: string };
type StudentCount = { totalStudents: number; boys: number; girls: number };

export default function DirectorOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ students: 0, staff: 0, boys: 0, girls: 0 });
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
        const sc = count as StudentCount;
        const staffUsers = (users as any[]).filter((u) => !u.roles.every((ur: any) => ['parent', 'student'].includes(ur.role.code)));
        setStats({ students: sc.totalStudents ?? 0, staff: staffUsers.length ?? 0, boys: sc.boys ?? 0, girls: sc.girls ?? 0 });
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
    { label: 'Total Students', value: stats.students, sub: `Boys ${stats.boys} · Girls ${stats.girls}`, color: 'bg-ds-surface' },
    { label: 'Academic Year', value: currentYear?.name ?? '—', sub: 'Current', color: 'bg-ds-surface' },
    { label: 'Classes', value: units.length, sub: 'Active divisions', color: 'bg-ds-surface' },
    { label: 'Staff Accounts', value: stats.staff, sub: 'System users', color: 'bg-ds-surface' },
  ];

  const alertCards = [
    {
      label: 'Attendance Alerts',
      value: attendanceAlerts,
      desc: 'Students below 75% this month',
      color: attendanceAlerts > 0 ? 'bg-ds-warning-bg border-ds-warning-border' : 'bg-ds-success-bg border-ds-success-border',
      textColor: attendanceAlerts > 0 ? 'text-ds-warning-text' : 'text-ds-success-text',
    },
    {
      label: 'Fee Defaulters',
      value: feeDefaultersCount,
      desc: 'Outstanding balances this year',
      color: feeDefaultersCount > 0 ? 'bg-ds-error-bg border-ds-error-border' : 'bg-ds-success-bg border-ds-success-border',
      textColor: feeDefaultersCount > 0 ? 'text-ds-error-text' : 'text-ds-success-text',
    },
    {
      label: 'Active Exams',
      value: activeExams.length,
      desc: activeExams.length > 0 ? activeExams.map((e) => e.name).join(', ') : 'No exams running',
      color: 'bg-ds-info-bg border-ds-info-border',
      textColor: 'text-ds-info-text',
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-ds-text1">Institution Overview</h1>
        <p className="text-sm text-ds-text3 mt-1">{todayDate}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.color} rounded-xl border border-ds-border shadow-sm p-4`}>
            <p className="text-2xl font-bold text-ds-text1">{s.value}</p>
            <p className="text-sm font-medium text-ds-text2 mt-1">{s.label}</p>
            <p className="text-xs text-ds-text3">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Alert panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {alertCards.map((a) => (
          <div key={a.label} className={`rounded-xl border p-4 ${a.color}`}>
            <p className={`text-3xl font-bold ${a.textColor}`}>{a.value}</p>
            <p className={`text-sm font-semibold mt-1 ${a.textColor}`}>{a.label}</p>
            <p className="text-xs text-ds-text2 mt-0.5 truncate">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* Quick navigation */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Detailed Reports', desc: 'Attendance, fees & exam breakdown by class', path: '/portal/director/reports', gradient: 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)' },
            { label: 'Staff Directory', desc: 'View all staff accounts and roles', path: '/portal/director/staff', gradient: 'linear-gradient(135deg, #6b432f 0%, #3a1f0c 100%)' },
            { label: 'Institution Settings', desc: 'Configure academic structure & preferences', path: '/portal/director/settings', gradient: 'linear-gradient(135deg, #dc924b 0%, #ae7040 100%)' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className="rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
              style={{ background: item.gradient, color: '#fcfbf7', border: '1px solid rgba(140,57,25,0.25)' }}
            >
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs mt-1 opacity-70">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Active exams table */}
      {activeExams.length > 0 && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm">
          <div className="px-5 py-4 border-b border-ds-border">
            <h2 className="font-semibold text-ds-text1 text-sm">Active Examinations</h2>
          </div>
          <div className="divide-y divide-ds-border">
            {activeExams.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-ds-text1 font-medium">{e.name}</span>
                <span className="badge badge-blue">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
