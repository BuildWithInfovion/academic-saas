'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Exam = { id: string; name: string; status: string };
type StudentCount = { totalStudents: number; boys: number; girls: number };
type TrendPoint = { month: string; label: string; amount: number };
type ClassStat = { unitId: string; name: string; percentage: number; totalRecords: number };
type FeeSummary = { todayTotal: number; monthTotal: number; totalDue?: number; totalStudents?: number };

type AttendanceProgress = {
  totalClasses: number; markedCount: number; unmarkedCount: number; markedPercent: number;
  unmarkedClasses: { id: string; name: string }[];
};

type TeacherEfficiency = {
  teacherId: string; teacherEmail: string | null; className: string;
  daysSinceLastMark: number | null; sessionsThisWeek: number; alert: boolean;
};

type PendingActions = {
  pendingTCCount: number; pendingLeaveCount: number;
  staffOnLeaveToday: { userId: string; email: string | null }[];
  examAlerts: { examId: string; examName: string; completionPercent: number; pendingSlots: number }[];
  lateStaffThisWeek: { userId: string; email: string | null; date: string }[];
};

function formatINR(n: number | null | undefined) {
  if (n == null || isNaN(n as number)) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function emailToName(email: string | null) {
  if (!email) return 'Unknown';
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DirectorOverviewPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, boys: 0, girls: 0, staff: 0 });
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [activeExams, setActiveExams] = useState<Exam[]>([]);
  const [feeDefaultersCount, setFeeDefaultersCount] = useState(0);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [classStat, setClassStat] = useState<ClassStat[]>([]);

  // Intelligence
  const [attendanceProgress, setAttendanceProgress] = useState<AttendanceProgress | null>(null);
  const [teacherEfficiency, setTeacherEfficiency] = useState<TeacherEfficiency[] | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActions | null>(null);

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const now = new Date();

  useEffect(() => {
    Promise.all([
      apiFetch('/students/count'),
      apiFetch('/academic/years'),
      apiFetch('/users'),
      apiFetch('/fees/payments/summary'),
      apiFetch('/fees/payments/monthly-trend?months=6'),
      apiFetch(`/attendance/class-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
    ]).then(([count, years, users, fs, tr, cs]) => {
      const sc = count as StudentCount;
      const staffUsers = (users as any[]).filter(
        (u) => !u.roles.every((ur: any) => ['parent', 'student'].includes(ur.role.code)),
      );
      setStats({ students: sc.totalStudents ?? 0, boys: sc.boys ?? 0, girls: sc.girls ?? 0, staff: staffUsers.length });
      setFeeSummary(fs as FeeSummary);
      setTrend(Array.isArray(tr) ? tr : []);
      setClassStat(Array.isArray(cs) ? (cs as ClassStat[]).slice(0, 12) : []);

      const yr: AcademicYear = (years as AcademicYear[]).find((y) => y.isCurrent) ?? (years as AcademicYear[])[0] ?? null;
      setCurrentYear(yr);
      setLoading(false);

      // Secondary data
      if (yr) {
        apiFetch(`/exams?yearId=${yr.id}`)
          .then((exams) => setActiveExams((exams as Exam[]).filter((e) => e.status === 'active')))
          .catch(() => {});
        apiFetch(`/fees/defaulters?yearId=${yr.id}`)
          .then((d) => setFeeDefaultersCount((d as any[])?.length ?? 0))
          .catch(() => {});
      }

      // Intelligence endpoints
      Promise.all([
        apiFetch('/intelligence/today-attendance').catch(() => null),
        apiFetch('/intelligence/teacher-efficiency').catch(() => []),
        apiFetch('/intelligence/pending-actions').catch(() => null),
      ]).then(([attn, teachers, actions]) => {
        setAttendanceProgress(attn as AttendanceProgress);
        setTeacherEfficiency(teachers as TeacherEfficiency[]);
        setPendingActions(actions as PendingActions);
      });
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-7 w-48 bg-ds-border rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-ds-surface rounded-xl border border-ds-border p-4">
              <div className="h-7 w-16 bg-ds-border rounded mb-2" />
              <div className="h-4 w-24 bg-ds-border rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const alertTeachers = teacherEfficiency?.filter((t) => t.alert) ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ds-text1">Institution Overview</h1>
        <p className="text-sm text-ds-text3 mt-1">
          {todayDate}{currentYear ? ` · AY ${currentYear.name}` : ''}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: stats.students, sub: `Boys ${stats.boys} · Girls ${stats.girls}` },
          {
            label: "Today's Attendance",
            value: attendanceProgress ? `${attendanceProgress.markedPercent}%` : '—',
            sub: attendanceProgress ? `${attendanceProgress.markedCount}/${attendanceProgress.totalClasses} classes` : 'Loading…',
            err: attendanceProgress && attendanceProgress.markedPercent < 60,
          },
          {
            label: 'Collected This Month',
            value: feeSummary ? formatINR(feeSummary.monthTotal) : '—',
            sub: feeSummary ? `Today: ${formatINR(feeSummary.todayTotal)}` : 'Loading…',
          },
          {
            label: 'Outstanding Dues',
            value: feeSummary ? formatINR(feeSummary.totalDue ?? 0) : '—',
            sub: 'Current academic year',
            err: feeSummary && (feeSummary.totalDue ?? 0) > 0,
          },
        ].map((s) => (
          <div key={s.label} className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4">
            <p className={`text-xl font-bold ${s.err ? 'text-ds-error-text' : 'text-ds-text1'}`}>{s.value}</p>
            <p className="text-sm font-medium text-ds-text2 mt-1">{s.label}</p>
            <p className="text-xs text-ds-text3">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Today's Attendance + Alert Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Attendance Progress */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4 sm:col-span-2">
          <p className="text-sm font-semibold text-ds-text1 mb-1">Today's Attendance Progress</p>
          {attendanceProgress ? (
            <>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-2.5 bg-ds-bg2 rounded-full overflow-hidden">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${attendanceProgress.markedPercent}%`,
                      background: attendanceProgress.markedPercent === 100 ? '#2d6a4f' : attendanceProgress.markedPercent >= 60 ? '#dc924b' : '#dc2626',
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-ds-text1">{attendanceProgress.markedPercent}%</span>
              </div>
              <p className="text-xs text-ds-text3 mb-2">
                {attendanceProgress.markedCount} of {attendanceProgress.totalClasses} classes marked
              </p>
              {attendanceProgress.unmarkedClasses.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {attendanceProgress.unmarkedClasses.map((c) => (
                    <span key={c.id} className="badge badge-red text-xs">{c.name}</span>
                  ))}
                </div>
              )}
              {attendanceProgress.unmarkedClasses.length === 0 && (
                <p className="text-xs font-semibold text-ds-success-text">All classes marked</p>
              )}
            </>
          ) : (
            <div className="h-12 animate-pulse bg-ds-bg2 rounded mt-2" />
          )}
        </div>

        {/* Alert summary */}
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4">
          <p className="text-sm font-semibold text-ds-text1 mb-3">Alerts</p>
          <div className="space-y-2">
            {[
              { label: 'TC Requests', value: pendingActions?.pendingTCCount ?? '…', color: (pendingActions?.pendingTCCount ?? 0) > 0 ? 'text-ds-warning-text' : 'text-ds-text3' },
              { label: 'Leave Requests', value: pendingActions?.pendingLeaveCount ?? '…', color: (pendingActions?.pendingLeaveCount ?? 0) > 0 ? 'text-ds-warning-text' : 'text-ds-text3' },
              { label: 'Fee Defaulters', value: feeDefaultersCount, color: feeDefaultersCount > 0 ? 'text-ds-error-text' : 'text-ds-text3' },
              { label: 'Active Exams', value: activeExams.length, color: 'text-ds-info-text' },
              { label: 'Teacher Alerts', value: alertTeachers.length, color: alertTeachers.length > 0 ? 'text-ds-error-text' : 'text-ds-text3' },
            ].map((a) => (
              <div key={a.label} className="flex items-center justify-between">
                <span className="text-xs text-ds-text3">{a.label}</span>
                <span className={`text-sm font-bold ${a.color}`}>{a.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teacher Efficiency */}
      {teacherEfficiency && teacherEfficiency.length > 0 && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm">
          <div className="px-5 py-4 border-b border-ds-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ds-text1">Teacher Efficiency</p>
              <p className="text-xs text-ds-text3 mt-0.5">Days since last attendance marked by class teacher</p>
            </div>
            {alertTeachers.length > 0 && (
              <span className="badge badge-red text-xs">{alertTeachers.length} alert{alertTeachers.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-ds-border gap-px bg-ds-border">
            {teacherEfficiency.slice(0, 12).map((t) => {
              const days = t.daysSinceLastMark;
              const color = days === null || days >= 2 ? 'text-ds-error-text' : days === 1 ? 'text-ds-warning-text' : 'text-ds-success-text';
              const dayText = days === null ? 'Never' : days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
              return (
                <div key={t.teacherId + t.className} className="bg-ds-surface px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ds-text1 truncate">{t.className}</p>
                    <p className="text-xs text-ds-text3 truncate">{emailToName(t.teacherEmail)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${color}`}>{dayText}</p>
                    <p className="text-xs text-ds-text3">{t.sessionsThisWeek}× this week</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

      {/* Pending actions detail */}
      {pendingActions && (pendingActions.examAlerts.length > 0 || pendingActions.lateStaffThisWeek.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {pendingActions.examAlerts.length > 0 && (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm">
              <div className="px-5 py-4 border-b border-ds-border">
                <p className="text-sm font-semibold text-ds-text1">Mark Entry Progress</p>
                <p className="text-xs text-ds-text3 mt-0.5">Active exams with incomplete marks</p>
              </div>
              <div className="divide-y divide-ds-border">
                {pendingActions.examAlerts.map((e) => (
                  <div key={e.examId} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-ds-text1">{e.examName}</span>
                      <span className="text-xs text-ds-error-text font-semibold">{e.pendingSlots} pending</span>
                    </div>
                    <div className="h-1.5 bg-ds-bg2 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-ds-brand rounded-full" style={{ width: `${e.completionPercent}%` }} />
                    </div>
                    <p className="text-xs text-ds-text3 mt-1">{e.completionPercent}% complete</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingActions.lateStaffThisWeek.length > 0 && (
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm">
              <div className="px-5 py-4 border-b border-ds-border">
                <p className="text-sm font-semibold text-ds-text1">Late Arrivals This Week</p>
                <p className="text-xs text-ds-text3 mt-0.5">{pendingActions.lateStaffThisWeek.length} late entries</p>
              </div>
              <div className="divide-y divide-ds-border max-h-48 overflow-y-auto">
                {pendingActions.lateStaffThisWeek.map((s, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-xs text-ds-text1">{emailToName(s.email)}</span>
                    <span className="text-xs text-ds-text3">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick nav */}
      <div>
        <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">Quick Access</p>
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
    </div>
  );
}
