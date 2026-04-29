'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Unit = { id: string; displayName: string; name: string };
type Exam = { id: string; name: string; status: string };
type StudentCount = { totalStudents: number; boys: number; girls: number };
type TrendPoint = { month: string; label: string; amount: number };
type ClassStat  = { unitId: string; name: string; percentage: number; totalRecords: number };
type FeeSummary = { todayTotal: number; monthTotal: number; totalDue: number };

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function DirectorOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, staff: 0, boys: 0, girls: 0 });
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeExams, setActiveExams] = useState<Exam[]>([]);
  const [attendanceAlerts, setAttendanceAlerts] = useState(0);
  const [feeDefaultersCount, setFeeDefaultersCount] = useState(0);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [trend, setTrend]     = useState<TrendPoint[]>([]);
  const [classStat, setClassStat] = useState<ClassStat[]>([]);

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
      apiFetch('/fees/payments/summary'),
      apiFetch('/fees/payments/monthly-trend?months=6'),
      apiFetch(`/attendance/class-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
    ])
      .then(([count, years, leafUnits, users, fs, tr, cs]) => {
        const sc = count as StudentCount;
        const staffUsers = (users as any[]).filter((u) => !u.roles.every((ur: any) => ['parent', 'student'].includes(ur.role.code)));
        setStats({ students: sc.totalStudents ?? 0, staff: staffUsers.length ?? 0, boys: sc.boys ?? 0, girls: sc.girls ?? 0 });
        const yr: AcademicYear = (years as AcademicYear[]).find((y) => y.isCurrent) ?? (years as AcademicYear[])[0] ?? null;
        setCurrentYear(yr);
        setUnits(leafUnits as Unit[]);
        setFeeSummary(fs as FeeSummary);
        setTrend(Array.isArray(tr) ? tr : []);
        setClassStat(Array.isArray(cs) ? (cs as ClassStat[]).slice(0, 10) : []);

        if (yr) {
          apiFetch(`/exams?yearId=${yr.id}`)
            .then((exams) => setActiveExams((exams as Exam[]).filter((e) => e.status === 'active')))
            .catch(() => {});
          apiFetch(`/fees/defaulters?yearId=${yr.id}`)
            .then((d) => setFeeDefaultersCount((d as any[])?.length ?? 0))
            .catch(() => {});
          const leafArr = leafUnits as Unit[];
          if (leafArr.length > 0) {
            Promise.all(
              leafArr.slice(0, 5).map((u) =>
                apiFetch(`/attendance/units/${u.id}/defaulters?year=${now.getFullYear()}&month=${now.getMonth() + 1}&threshold=75`).catch(() => [])
              )
            ).then((results) => setAttendanceAlerts((results as any[][]).flat().length));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto animate-pulse">
        <div className="mb-6">
          <div className="h-7 w-48 bg-ds-border rounded" />
          <div className="h-4 w-64 bg-ds-border rounded mt-2" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-ds-surface rounded-xl border border-ds-border p-4">
              <div className="h-7 w-16 bg-ds-border rounded mb-2" />
              <div className="h-4 w-24 bg-ds-border rounded" />
              <div className="h-3 w-20 bg-ds-border rounded mt-1" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-ds-surface p-4">
              <div className="h-10 w-12 bg-ds-border rounded mb-2" />
              <div className="h-4 w-28 bg-ds-border rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-ds-text1">Institution Overview</h1>
        <p className="text-sm text-ds-text3 mt-1">{todayDate}{currentYear ? ` · AY ${currentYear.name}` : ''}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Students', value: stats.students, sub: `Boys ${stats.boys} · Girls ${stats.girls}` },
          { label: "Today's Collection", value: feeSummary ? formatINR(feeSummary.todayTotal) : '—', sub: feeSummary ? `Month: ${formatINR(feeSummary.monthTotal)}` : 'Loading…' },
          { label: 'Outstanding Dues', value: feeSummary ? formatINR(feeSummary.totalDue) : '—', sub: 'Current academic year' },
          { label: 'Staff Accounts', value: stats.staff, sub: 'System users' },
        ].map((s) => (
          <div key={s.label} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4">
            <p className="text-xl font-bold text-ds-text1">{s.value}</p>
            <p className="text-sm font-medium text-ds-text2 mt-1">{s.label}</p>
            <p className="text-xs text-ds-text3">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Alert panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: 'Attendance Alerts', value: attendanceAlerts, desc: 'Students below 75% this month',
            color: attendanceAlerts > 0 ? 'bg-ds-warning-bg border-ds-warning-border' : 'bg-ds-success-bg border-ds-success-border',
            textColor: attendanceAlerts > 0 ? 'text-ds-warning-text' : 'text-ds-success-text',
          },
          {
            label: 'Fee Defaulters', value: feeDefaultersCount, desc: 'Outstanding balances this year',
            color: feeDefaultersCount > 0 ? 'bg-ds-error-bg border-ds-error-border' : 'bg-ds-success-bg border-ds-success-border',
            textColor: feeDefaultersCount > 0 ? 'text-ds-error-text' : 'text-ds-success-text',
          },
          {
            label: 'Active Exams', value: activeExams.length,
            desc: activeExams.length > 0 ? activeExams.map((e) => e.name).join(', ') : 'No exams running',
            color: 'bg-ds-info-bg border-ds-info-border', textColor: 'text-ds-info-text',
          },
        ].map((a) => (
          <div key={a.label} className={`rounded-xl border p-4 ${a.color}`}>
            <p className={`text-3xl font-bold ${a.textColor}`}>{a.value}</p>
            <p className={`text-sm font-semibold mt-1 ${a.textColor}`}>{a.label}</p>
            <p className="text-xs text-ds-text2 mt-0.5 truncate">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
          <p className="text-sm font-semibold text-ds-text1 mb-1">Fee Collection Trend</p>
          <p className="text-xs text-ds-text3 mb-4">Last 6 months</p>
          {trend.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-ds-text3">No payment data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip
                  formatter={(v: unknown) => [formatINR(Number(v)), 'Collected']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--brand-subtle)' }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {trend.map((_, i) => <Cell key={i} fill={i === trend.length - 1 ? '#ae5525' : '#dc924b'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
          <p className="text-sm font-semibold text-ds-text1 mb-1">Attendance This Month</p>
          <p className="text-xs text-ds-text3 mb-4">% present by class</p>
          {classStat.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-ds-text3">No attendance data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={classStat} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  formatter={(v: unknown) => [`${Number(v)}%`, 'Attendance']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--brand-subtle)' }}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                  {classStat.map((c, i) => <Cell key={i} fill={c.percentage >= 75 ? '#2d6a4f' : c.percentage >= 60 ? '#dc924b' : '#dc2626'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick navigation */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Detailed Reports', desc: 'Attendance, fees & exam breakdown', path: '/portal/director/reports', gradient: 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)' },
            { label: 'Staff Directory', desc: 'View all staff accounts and roles', path: '/portal/director/staff', gradient: 'linear-gradient(135deg, #6b432f 0%, #3a1f0c 100%)' },
            { label: 'Institution Settings', desc: 'Academic structure & preferences', path: '/portal/director/settings', gradient: 'linear-gradient(135deg, #dc924b 0%, #ae7040 100%)' },
          ].map((item) => (
            <button key={item.label} onClick={() => router.push(item.path)}
              className="rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
              style={{ background: item.gradient, color: '#fcfbf7', border: '1px solid rgba(140,57,25,0.25)' }}>
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs mt-1 opacity-70">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

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
