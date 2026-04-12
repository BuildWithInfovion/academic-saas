'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

const QUICK_LINKS = [
  { label: 'My Attendance',   desc: 'Monthly record — present, absent, late', path: '/portal/student/attendance' },
  { label: 'Marks & Results', desc: 'Exam scorecards and class ranking',       path: '/portal/student/marks'      },
  { label: 'Fee Status',      desc: 'Dues, payments and balance',              path: '/portal/student/fees'       },
  { label: 'Announcements',   desc: 'School notices and updates',              path: '/portal/student/announcements' },
];

export default function StudentDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Student Portal</h1>
        <p className="text-sm text-gray-400 mt-1">{user?.email || user?.phone}</p>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-2 gap-4">
        {QUICK_LINKS.map((c) => (
          <button
            key={c.label}
            onClick={() => router.push(c.path)}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md hover:border-gray-200 transition-all"
          >
            <h3 className="font-semibold text-gray-800 text-sm">{c.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
