'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface ParentUnit {
  id: string;
  name: string;
  displayName: string | null;
}

interface MyClassUnit {
  id: string;
  name: string;
  displayName: string | null;
  level: number;
  parentId: string | null;
  parent: ParentUnit | null;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [myClasses, setMyClasses] = useState<MyClassUnit[]>([]);
  const [allLeafUnits, setAllLeafUnits] = useState<MyClassUnit[]>([]);
  const [todayDate] = useState(
    new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  useEffect(() => {
    Promise.all([
      apiFetch('/academic/my-class-units'),
      apiFetch('/academic/units/leaf'),
    ])
      .then(([owned, leaf]) => {
        setMyClasses(Array.isArray(owned) ? owned : []);
        setAllLeafUnits(Array.isArray(leaf) ? leaf : []);
      })
      .catch(() => {});
  }, []);

  const isClassTeacher = myClasses.length > 0;

  const quickActions = [
    {
      label: 'Mark Attendance',
      desc: "Today's class attendance",
      path: '/portal/teacher/attendance',
      color: 'bg-black text-white',
    },
    {
      label: 'Enter Marks',
      desc: 'Exam score entry',
      path: '/portal/teacher/marks',
      color: 'bg-gray-800 text-white',
    },
  ];

  const unitLabel = (u: MyClassUnit) => {
    if (u.parent) {
      return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
    }
    return u.displayName || u.name;
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Teacher Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">{todayDate}</p>
      </div>

      {/* Class Teacher ownership banner */}
      {isClassTeacher && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">
            Class Teacher
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {myClasses.map((cls) => (
              <span
                key={cls.id}
                className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full px-3 py-1"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                {unitLabel(cls)}
              </span>
            ))}
          </div>
          <p className="text-xs text-indigo-400 mt-2">
            You are the accountable class teacher for the above class(es). You can promote students and view full score cards.
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => router.push(a.path)}
            className={`rounded-xl p-5 text-left hover:opacity-90 transition-opacity ${a.color}`}
          >
            <p className="font-semibold">{a.label}</p>
            <p className="text-sm mt-1 opacity-70">{a.desc}</p>
          </button>
        ))}
      </div>

      {/* My Classes (owned) */}
      {isClassTeacher && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            My Owned Classes ({myClasses.length})
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {myClasses.map((u) => (
              <div
                key={u.id}
                className="bg-indigo-50 border border-indigo-200 rounded-xl p-4"
              >
                <p className="font-semibold text-indigo-800 text-sm">{unitLabel(u)}</p>
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                  Class Teacher
                </span>
                <button
                  onClick={() => router.push('/portal/teacher/attendance')}
                  className="block text-xs text-indigo-600 hover:underline mt-2"
                >
                  Mark attendance →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All assigned classes (subject teacher) */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          All Classes ({allLeafUnits.length})
        </h2>
        {allLeafUnits.length === 0 ? (
          <p className="text-sm text-gray-500">No classes configured yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {allLeafUnits.map((u) => {
              const isOwned = myClasses.some((c) => c.id === u.id);
              return (
                <div
                  key={u.id}
                  className={`rounded-xl border p-4 ${
                    isOwned
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <p className="font-semibold text-gray-800 text-sm">
                    {unitLabel(u)}
                  </p>
                  {isOwned && (
                    <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                      Class Teacher
                    </span>
                  )}
                  <button
                    onClick={() => router.push('/portal/teacher/attendance')}
                    className="block text-xs text-blue-600 hover:underline mt-2"
                  >
                    Mark attendance →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
