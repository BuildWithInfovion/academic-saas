'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface TrendPoint { month: string; label: string; amount: number; }
interface ClassStat  { unitId: string; name: string; percentage: number; totalRecords: number; }

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function DashboardCharts({
  trend,
  classStat,
  onFeesClick,
  onAttendanceClick,
}: {
  trend: TrendPoint[];
  classStat: ClassStat[];
  onFeesClick: () => void;
  onAttendanceClick: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 fade-up-3">
      {/* Fee collection trend */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Fee Collection Trend</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Last 6 months</p>
          </div>
          <button onClick={onFeesClick}
            className="text-xs font-medium px-3 py-1 rounded-lg"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            View all →
          </button>
        </div>
        {trend.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>No payment data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
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
                {trend.map((_, i) => (
                  <Cell key={i} fill={i === trend.length - 1 ? '#ae5525' : '#dc924b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Attendance by class */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Attendance This Month</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>% present by class</p>
          </div>
          <button onClick={onAttendanceClick}
            className="text-xs font-medium px-3 py-1 rounded-lg"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            View all →
          </button>
        </div>
        {classStat.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>No attendance data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
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
                {classStat.map((c, i) => (
                  <Cell key={i} fill={c.percentage >= 75 ? '#2d6a4f' : c.percentage >= 60 ? '#dc924b' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
