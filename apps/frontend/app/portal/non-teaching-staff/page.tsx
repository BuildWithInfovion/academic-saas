'use client';

import { useRouter } from 'next/navigation';

export default function NonTeachingStaffOverviewPage() {
  const router = useRouter();

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="p-6 max-w-3xl">
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>{todayDate}</p>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-1)' }}>Staff Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => router.push('/portal/non-teaching-staff/staff-attendance')}
          className="rounded-xl p-5 text-left hover:opacity-90 transition-opacity bg-black text-white"
        >
          <p className="font-semibold">My Attendance</p>
          <p className="text-sm mt-1 opacity-70">Mark your daily attendance &amp; apply for leave</p>
        </button>
        <button
          onClick={() => router.push('/portal/non-teaching-staff/announcements')}
          className="rounded-xl p-5 text-left hover:opacity-90 transition-opacity bg-gray-800 text-white"
        >
          <p className="font-semibold">Announcements</p>
          <p className="text-sm mt-1 opacity-70">Notices from school management</p>
        </button>
      </div>
    </div>
  );
}
