'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type AcademicYear = { id: string; name: string; isCurrent: boolean };

type AttendanceProgress = {
  totalClasses: number;
  markedCount: number;
  unmarkedCount: number;
  markedPercent: number;
  markedClasses: { id: string; name: string }[];
  unmarkedClasses: { id: string; name: string }[];
};

type TeacherEfficiency = {
  teacherId: string;
  teacherEmail: string | null;
  className: string;
  academicUnitId: string;
  daysSinceLastMark: number | null;
  sessionsThisWeek: number;
  lastMarkedDate: string | null;
  alert: boolean;
};

type ExamAlert = {
  examId: string;
  examName: string;
  completionPercent: number;
  pendingSlots: number;
  totalSlots: number;
};

type StaffOnLeave = {
  userId: string;
  email: string | null;
  startDate: string;
  endDate: string;
  reason: string;
};

type LateStaff = { userId: string; email: string | null; date: string };

type PendingActions = {
  pendingTCCount: number;
  pendingLeaveCount: number;
  staffOnLeaveToday: StaffOnLeave[];
  examAlerts: ExamAlert[];
  lateStaffThisWeek: LateStaff[];
};

type ClassAverage = {
  unitId: string;
  className: string;
  exams: { examId: string; examName: string; avgPercent: number | null }[];
  overallAvg: number | null;
};

type AcademicOverview = { exams: { id: string; name: string }[]; classAverages: ClassAverage[] };
type FeeSummary = { todayTotal: number; monthTotal: number; totalDue: number };
type StudentCount = { totalStudents: number; boys: number; girls: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function emailToName(email: string | null) {
  if (!email) return 'Unknown';
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function dayLabel(days: number | null) {
  if (days === null) return { text: 'Never marked', color: 'text-ds-error-text' };
  if (days === 0) return { text: 'Today', color: 'text-ds-success-text' };
  if (days === 1) return { text: 'Yesterday', color: 'text-ds-warning-text' };
  return { text: `${days} days ago`, color: 'text-ds-error-text' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color?: string }) {
  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-4">
      <p className={`text-2xl font-bold ${color ?? 'text-ds-text1'}`}>{value}</p>
      <p className="text-sm font-medium text-ds-text2 mt-1">{label}</p>
      <p className="text-xs text-ds-text3">{sub}</p>
    </div>
  );
}

function SectionShell({ title, sub, children, action }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm">
      <div className="px-5 py-4 border-b border-ds-border flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-ds-text1 text-sm">{title}</h2>
          {sub && <p className="text-xs text-ds-text3 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Today's Attendance Progress ──────────────────────────────────────────────

function AttendanceProgressPanel({ data }: { data: AttendanceProgress | null }) {
  if (!data) return <div className="h-32 animate-pulse bg-ds-bg2 rounded-xl" />;

  const pct = data.markedPercent;
  const barColor = pct === 100 ? '#2d6a4f' : pct >= 60 ? '#dc924b' : '#dc2626';

  return (
    <SectionShell
      title="Today's Attendance"
      sub={`Updated live · ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
    >
      <div className="px-5 py-4">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-3 bg-ds-bg2 rounded-full overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <span className="text-sm font-bold text-ds-text1 w-14 text-right">{pct}%</span>
        </div>

        <p className="text-xs text-ds-text3 mb-3">
          {data.markedCount} of {data.totalClasses} classes marked
        </p>

        {data.unmarkedClasses.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ds-error-text mb-1.5">Not yet marked:</p>
            <div className="flex flex-wrap gap-1.5">
              {data.unmarkedClasses.map((c) => (
                <span key={c.id} className="badge badge-red text-xs px-2 py-0.5">{c.name}</span>
              ))}
            </div>
          </div>
        )}

        {data.unmarkedClasses.length === 0 && (
          <p className="text-xs font-semibold text-ds-success-text">All classes marked for today</p>
        )}
      </div>
    </SectionShell>
  );
}

// ─── Pending Actions ──────────────────────────────────────────────────────────

function PendingActionsPanel({ data, onNavigate }: { data: PendingActions | null; onNavigate: (p: string) => void }) {
  if (!data) return <div className="h-56 animate-pulse bg-ds-bg2 rounded-xl" />;

  const totalAlerts = data.pendingTCCount + data.pendingLeaveCount + data.examAlerts.length;

  const rows: { icon: string; text: string; badge?: string; path?: string; color: string }[] = [];

  if (data.pendingTCCount > 0) {
    rows.push({ icon: '📋', text: `${data.pendingTCCount} transfer certificate${data.pendingTCCount > 1 ? 's' : ''} pending`, path: '/portal/principal', color: 'text-ds-warning-text' });
  }
  if (data.pendingLeaveCount > 0) {
    rows.push({ icon: '📅', text: `${data.pendingLeaveCount} staff leave request${data.pendingLeaveCount > 1 ? 's' : ''} pending`, path: '/portal/principal/staff-attendance', color: 'text-ds-warning-text' });
  }
  for (const e of data.examAlerts) {
    rows.push({ icon: '📝', text: `${e.examName}: marks ${e.completionPercent}% entered`, badge: `${e.pendingSlots} slot${e.pendingSlots > 1 ? 's' : ''} pending`, color: 'text-ds-error-text' });
  }
  if (data.staffOnLeaveToday.length > 0) {
    rows.push({ icon: '🏠', text: `${data.staffOnLeaveToday.length} staff on approved leave today`, color: 'text-ds-info-text' });
  }
  if (rows.length === 0) {
    rows.push({ icon: '✅', text: 'No pending actions — all clear!', color: 'text-ds-success-text' });
  }

  return (
    <SectionShell title="Needs Attention" sub={totalAlerts > 0 ? `${totalAlerts} items require action` : 'All clear'}>
      <div className="divide-y divide-ds-border">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`px-5 py-3 flex items-center justify-between gap-2 ${r.path ? 'cursor-pointer hover:bg-ds-bg2 transition-colors' : ''}`}
            onClick={() => r.path && onNavigate(r.path)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">{r.icon}</span>
              <span className={`text-xs font-medium ${r.color} truncate`}>{r.text}</span>
            </div>
            {r.badge && <span className="badge badge-red shrink-0 text-xs">{r.badge}</span>}
          </div>
        ))}

        {/* Staff on leave today */}
        {data.staffOnLeaveToday.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs font-semibold text-ds-text3 mb-1.5">On leave today:</p>
            <div className="flex flex-wrap gap-1.5">
              {data.staffOnLeaveToday.map((s) => (
                <span key={s.userId} className="badge badge-blue text-xs">{emailToName(s.email)}</span>
              ))}
            </div>
          </div>
        )}

        {/* Late staff this week */}
        {data.lateStaffThisWeek.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs font-semibold text-ds-text3 mb-1.5">Late arrivals this week ({data.lateStaffThisWeek.length}):</p>
            <div className="flex flex-wrap gap-1.5">
              {data.lateStaffThisWeek.slice(0, 5).map((s, i) => (
                <span key={i} className="badge badge-amber text-xs">{emailToName(s.email)}</span>
              ))}
              {data.lateStaffThisWeek.length > 5 && (
                <span className="badge badge-amber text-xs">+{data.lateStaffThisWeek.length - 5} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

// ─── Teacher Efficiency ───────────────────────────────────────────────────────

function TeacherEfficiencyPanel({ data }: { data: TeacherEfficiency[] | null }) {
  if (!data) return <div className="h-56 animate-pulse bg-ds-bg2 rounded-xl" />;
  if (data.length === 0) {
    return (
      <SectionShell title="Teacher Efficiency" sub="Attendance marking behaviour">
        <p className="px-5 py-4 text-sm text-ds-text3">No class teachers assigned yet.</p>
      </SectionShell>
    );
  }

  const alertCount = data.filter((t) => t.alert).length;

  return (
    <SectionShell
      title="Teacher Efficiency"
      sub="Days since last attendance marked"
      action={
        alertCount > 0
          ? <span className="badge badge-red text-xs">{alertCount} alert{alertCount > 1 ? 's' : ''}</span>
          : <span className="badge badge-green text-xs">All on track</span>
      }
    >
      <div className="divide-y divide-ds-border max-h-72 overflow-y-auto">
        {data.map((t) => {
          const { text, color } = dayLabel(t.daysSinceLastMark);
          return (
            <div key={t.teacherId + t.academicUnitId} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ds-text1 truncate">{t.className}</p>
                <p className="text-xs text-ds-text3 truncate">{emailToName(t.teacherEmail)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold ${color}`}>{text}</p>
                <p className="text-xs text-ds-text3">{t.sessionsThisWeek} this week</p>
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ─── Academic Overview Chart ──────────────────────────────────────────────────

function AcademicOverviewPanel({ data }: { data: AcademicOverview | null }) {
  if (!data) return <div className="h-56 animate-pulse bg-ds-bg2 rounded-xl" />;
  if (data.exams.length === 0) {
    return (
      <SectionShell title="Academic Performance" sub="Class averages across exams">
        <p className="px-5 py-4 text-sm text-ds-text3">No completed exams yet this year.</p>
      </SectionShell>
    );
  }

  const chartData = data.classAverages.map((c) => ({ name: c.className, avg: c.overallAvg ?? 0 }));

  return (
    <SectionShell title="Academic Performance" sub={`Class avg % · ${data.exams.length} exam${data.exams.length > 1 ? 's' : ''} completed`}>
      <div className="px-5 py-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-ds-text3">No results data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={64} />
              <Tooltip
                formatter={(v: unknown) => [`${Number(v)}%`, 'Class Avg']}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'var(--brand-subtle)' }}
              />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                {chartData.map((c, i) => (
                  <Cell key={i} fill={c.avg >= 75 ? '#2d6a4f' : c.avg >= 60 ? '#dc924b' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Exam legend */}
        <div className="mt-3 flex flex-wrap gap-2">
          {data.exams.map((e) => (
            <span key={e.id} className="text-xs text-ds-text3 bg-ds-bg2 rounded px-2 py-0.5">{e.name}</span>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrincipalCommandCenter() {
  const router = useRouter();

  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [studentCount, setStudentCount] = useState<StudentCount | null>(null);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [attendanceProgress, setAttendanceProgress] = useState<AttendanceProgress | null>(null);
  const [teacherEfficiency, setTeacherEfficiency] = useState<TeacherEfficiency[] | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActions | null>(null);
  const [academicOverview, setAcademicOverview] = useState<AcademicOverview | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Phase 1: base data — KPI cards + academic year
  useEffect(() => {
    Promise.all([
      apiFetch('/students/count'),
      apiFetch('/academic/years'),
      apiFetch('/fees/payments/summary'),
    ]).then(([count, years, fs]) => {
      setStudentCount(count as StudentCount);
      setFeeSummary(fs as FeeSummary);
      const yr = (years as AcademicYear[]).find((y) => y.isCurrent) ?? (years as AcademicYear[])[0] ?? null;
      setCurrentYear(yr);
      setLoadingBase(false);

      // Phase 2: intelligence widgets — all parallel after we have the year
      Promise.all([
        apiFetch('/intelligence/today-attendance').catch(() => null),
        apiFetch('/intelligence/teacher-efficiency').catch(() => []),
        apiFetch('/intelligence/pending-actions').catch(() => null),
        yr ? apiFetch(`/intelligence/academic-overview?yearId=${yr.id}`).catch(() => null) : Promise.resolve(null),
      ]).then(([attn, teachers, actions, academic]) => {
        setAttendanceProgress(attn as AttendanceProgress);
        setTeacherEfficiency(teachers as TeacherEfficiency[]);
        setPendingActions(actions as PendingActions);
        setAcademicOverview(academic as AcademicOverview);
      });
    }).catch(() => setLoadingBase(false));
  }, []);

  const sc = studentCount;
  const fs = feeSummary;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ds-text1">Command Center</h1>
        <p className="text-sm text-ds-text3 mt-1">
          {todayDate}{currentYear ? ` · AY ${currentYear.name}` : ''}
        </p>
      </div>

      {/* KPI Row */}
      {loadingBase ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-ds-surface rounded-xl border border-ds-border p-4 animate-pulse">
              <div className="h-7 w-16 bg-ds-bg2 rounded mb-2" />
              <div className="h-4 w-24 bg-ds-bg2 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Total Students" value={sc?.totalStudents ?? '—'} sub={sc ? `Boys ${sc.boys} · Girls ${sc.girls}` : ''} />
          <KpiCard
            label="Today's Attendance"
            value={attendanceProgress ? `${attendanceProgress.markedPercent}%` : '—'}
            sub={attendanceProgress ? `${attendanceProgress.markedCount}/${attendanceProgress.totalClasses} classes marked` : 'Loading…'}
            color={attendanceProgress && attendanceProgress.markedPercent < 60 ? 'text-ds-error-text' : 'text-ds-text1'}
          />
          <KpiCard
            label="Collected This Month"
            value={fs ? formatINR(fs.monthTotal) : '—'}
            sub={fs ? `Today: ${formatINR(fs.todayTotal)}` : 'Loading…'}
          />
          <KpiCard
            label="Outstanding Dues"
            value={fs ? formatINR(fs.totalDue) : '—'}
            sub="Current academic year"
            color={fs && fs.totalDue > 0 ? 'text-ds-error-text' : 'text-ds-text1'}
          />
        </div>
      )}

      {/* Attendance Progress — full width */}
      <AttendanceProgressPanel data={attendanceProgress} />

      {/* Two-column: Pending Actions + Teacher Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PendingActionsPanel data={pendingActions} onNavigate={router.push} />
        <TeacherEfficiencyPanel data={teacherEfficiency} />
      </div>

      {/* Academic Performance Chart */}
      <AcademicOverviewPanel data={academicOverview} />

      {/* Quick Nav */}
      <div>
        <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">Quick Access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Attendance Reports', desc: 'Class-wise defaulters', path: '/portal/principal/attendance', gradient: 'linear-gradient(135deg, #ae5525 0%, #8c3919 100%)' },
            { label: 'Fee Reports', desc: 'Outstanding dues overview', path: '/portal/principal/fees', gradient: 'linear-gradient(135deg, #6b432f 0%, #3a1f0c 100%)' },
            { label: 'Exam Results', desc: 'Result summaries by class', path: '/portal/principal/exams', gradient: 'linear-gradient(135deg, #dc924b 0%, #ae7040 100%)' },
            { label: 'Staff Attendance', desc: 'Daily staff presence', path: '/portal/principal/staff-attendance', gradient: 'linear-gradient(135deg, #5a7a5a 0%, #3a5a3a 100%)' },
            { label: 'Announcements', desc: 'School-wide notices', path: '/portal/principal/announcements', gradient: 'linear-gradient(135deg, #5a5a8a 0%, #3a3a6a 100%)' },
            { label: 'Settings', desc: 'Institution profile', path: '/portal/principal/settings', gradient: 'linear-gradient(135deg, #7a5a3a 0%, #5a3a1a 100%)' },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => router.push(a.path)}
              className="rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
              style={{ background: a.gradient, color: '#fcfbf7', border: '1px solid rgba(140,57,25,0.15)' }}
            >
              <p className="font-semibold text-sm">{a.label}</p>
              <p className="text-xs mt-1 opacity-70">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
