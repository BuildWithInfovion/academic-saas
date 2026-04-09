'use client';

import { useAuthStore } from '@/store/auth.store';

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Student Portal</h1>
        <p className="text-sm text-gray-400 mt-1">{user?.email}</p>
      </div>

      {/* Notice banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-8">
        <p className="text-sm font-medium text-blue-800">Your student record is being linked by the school admin.</p>
        <p className="text-xs text-blue-600 mt-1">Once linked, you will see your attendance, marks, and fee status here automatically.</p>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            label: 'Attendance',
            desc: 'View your monthly attendance record',
            icon: '📋',
            sub: 'Track present, absent, late days',
          },
          {
            label: 'Marks & Results',
            desc: 'Exam scorecards and rankings',
            icon: '📊',
            sub: 'Marks, grade, rank per exam',
          },
          {
            label: 'Fee Status',
            desc: 'Dues and payment history',
            icon: '💳',
            sub: 'Outstanding balance and receipts',
          },
          {
            label: 'Announcements',
            desc: 'School notices and updates',
            icon: '📢',
            sub: 'Latest school communications',
          },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-2xl mb-2">{c.icon}</div>
            <h3 className="font-semibold text-gray-800 text-sm">{c.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
