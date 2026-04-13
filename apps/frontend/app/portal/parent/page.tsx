'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { apiFetch } from '@/lib/api';

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  academicUnit: {
    id: string;
    name: string;
    displayName: string | null;
    parent: { name: string; displayName: string | null } | null;
  } | null;
}

interface AbsentRecord {
  id: string;
  student: { id: string; firstName: string; lastName: string };
  session: {
    date: string;
    subject: { id: string; name: string } | null;
  };
}

interface ParentNotifications {
  linked: boolean;
  students: StudentInfo[];
  absentToday: AbsentRecord[];
  attendanceTakenToday: boolean;
  date: string;
}

function unitLabel(u: StudentInfo['academicUnit']): string {
  if (!u) return '';
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

export default function ParentDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<ParentNotifications | null>(null);

  const loadNotifications = useCallback(() => {
    apiFetch('/attendance/notifications/parent')
      .then((data: unknown) => setNotifications(data as ParentNotifications))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const hasAbsent = notifications && notifications.absentToday.length > 0;
  const isLinked = notifications?.linked ?? false;
  // Only show "present" when attendance was actually taken today AND no absences recorded
  const showPresentBanner = isLinked && notifications?.attendanceTakenToday && !hasAbsent;

  const quickLinks = [
    { label: 'Attendance', desc: "Monthly summary with percentage", path: '/portal/parent/attendance' },
    { label: 'Marks & Results', desc: 'Subject-wise marks, grade, rank', path: '/portal/parent/marks' },
    { label: 'Fee Status', desc: 'Due amounts and receipts', path: '/portal/parent/fees' },
    { label: 'Announcements', desc: 'Important updates from school', path: '/portal/parent/announcements' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Parent Portal</h1>
        <p className="text-sm text-gray-400 mt-1">{user?.email || user?.phone}</p>
      </div>

      {/* Absent today — high priority banner */}
      {hasAbsent && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
            <p className="text-sm font-semibold text-red-800">
              {notifications!.absentToday.length === 1
                ? 'Your child was marked absent today'
                : `${notifications!.absentToday.length} absences recorded today`}
            </p>
          </div>
          <ul className="space-y-1.5 mt-1">
            {notifications!.absentToday.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm text-red-700">
                <span className="font-medium">
                  {r.student.firstName} {r.student.lastName}
                </span>
                {r.session.subject && (
                  <span className="text-red-500 text-xs">— {r.session.subject.name}</span>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.push('/portal/parent/attendance')}
            className="mt-3 text-xs text-red-600 font-medium hover:underline"
          >
            View attendance details →
          </button>
        </div>
      )}

      {/* All present today — only shown after attendance is marked */}
      {showPresentBanner && notifications && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-green-500 font-bold text-base">✓</span>
            <p className="text-sm font-medium text-green-800">
              {notifications.students.length === 1
                ? `${notifications.students[0].firstName} is present today`
                : 'All children are present today'}
            </p>
          </div>
        </div>
      )}

      {/* Not linked yet */}
      {notifications && !isLinked && (
        <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-amber-800">
            Your child's record is being linked by the school admin.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Once linked, you can monitor attendance, marks, and fee dues from here.
          </p>
        </div>
      )}

      {/* Linked children */}
      {isLinked && notifications && notifications.students.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Your Children
          </h2>
          <div className="flex flex-wrap gap-3">
            {notifications.students.map((s) => (
              <div key={s.id} className="bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-3">
                <p className="font-semibold text-gray-800 text-sm">
                  {s.firstName} {s.lastName}
                </p>
                {s.academicUnit && (
                  <p className="text-xs text-gray-400 mt-0.5">{unitLabel(s.academicUnit)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quickLinks.map((c) => (
          <button
            key={c.label}
            onClick={() => router.push(c.path)}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-800 text-sm">{c.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
