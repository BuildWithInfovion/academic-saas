'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface ParentUnit {
  id: string;
  name: string;
  displayName: string | null;
}

interface ClassUnit {
  id: string;
  name: string;
  displayName: string | null;
  level: number;
  parentId: string | null;
  parent: ParentUnit | null;
}

interface ClassCount {
  unitId: string;
  total: number;
  boys: number;
  girls: number;
}

interface SubjectUnit {
  academicUnit: { id: string; name: string; displayName: string | null };
  subject: { id: string; name: string; code: string };
}

function unitLabel(u: { name: string; displayName: string | null; parent?: ParentUnit | null }) {
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

const naturalSort = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export default function TeacherDashboard() {
  const router = useRouter();
  const [myClasses, setMyClasses] = useState<ClassUnit[]>([]);
  const [subjectUnits, setSubjectUnits] = useState<SubjectUnit[]>([]);
  const [classCounts, setClassCounts] = useState<ClassCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayDate] = useState(
    new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
  );

  useEffect(() => {
    Promise.all([
      apiFetch('/academic/my-class-units'),
      apiFetch('/academic/my-subject-units').catch(() => []),
    ])
      .then(([owned, subjects]) => {
        const classes = Array.isArray(owned) ? (owned as ClassUnit[]) : [];
        const sorted = [...classes].sort((a, b) => naturalSort(unitLabel(a), unitLabel(b)));
        setMyClasses(sorted);
        setSubjectUnits(Array.isArray(subjects) ? (subjects as SubjectUnit[]) : []);

        // Fetch boys/girls count for each assigned class
        if (sorted.length > 0) {
          Promise.all(
            sorted.map((c) =>
              apiFetch(`/students/count?unitId=${c.id}`)
                .then((r: any) => ({ unitId: c.id, total: r.totalStudents ?? 0, boys: r.boys ?? 0, girls: r.girls ?? 0 }))
                .catch(() => ({ unitId: c.id, total: 0, boys: 0, girls: 0 }))
            )
          ).then(setClassCounts).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isClassTeacher = myClasses.length > 0;
  const getCount = (unitId: string) => classCounts.find((c) => c.unitId === unitId);

  // Unique classes from subject assignments not already in myClasses
  const subjectOnlyUnits = subjectUnits
    .filter((su) => !myClasses.some((c) => c.id === su.academicUnit.id))
    .reduce<{ id: string; name: string; displayName: string | null; subjects: string[] }[]>(
      (acc, su) => {
        const ex = acc.find((x) => x.id === su.academicUnit.id);
        if (ex) { ex.subjects.push(su.subject.name); }
        else acc.push({ ...su.academicUnit, subjects: [su.subject.name] });
        return acc;
      },
      [],
    )
    .sort((a, b) => naturalSort(a.displayName || a.name, b.displayName || b.name));

  const hasAnyClass = isClassTeacher || subjectOnlyUnits.length > 0;

  const quickActions = [
    {
      label: 'Mark Attendance',
      desc: "Today's class attendance",
      path: '/portal/teacher/attendance',
      color: 'btn-brand',
    },
    {
      label: 'Enter Marks',
      desc: 'Exam score entry',
      path: '/portal/teacher/marks',
      color: 'btn-brand',
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>{todayDate}</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          {isClassTeacher ? 'My Dashboard' : 'Teacher Dashboard'}
        </h1>
      </div>

      {/* Class Teacher banner */}
      {isClassTeacher && (
        <div className="mb-6 rounded-xl p-4" style={{ background: 'rgba(174,85,37,0.08)', border: '1px solid rgba(174,85,37,0.2)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--brand)' }}>
            Class Teacher
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {myClasses.map((cls) => (
              <span
                key={cls.id}
                className="inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1"
                style={{ background: 'rgba(174,85,37,0.12)', color: 'var(--brand-dark)' }}
              >
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--brand)' }} />
                {unitLabel(cls)}
              </span>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
            You are accountable class teacher for the above class(es) — you can promote students and view full scorecards.
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading your classes…</p>
      ) : !hasAnyClass ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="font-medium text-sm" style={{ color: 'var(--text-2)' }}>No classes assigned yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            Contact your school operator to be assigned as class teacher or subject teacher.
          </p>
        </div>
      ) : (
        <>
          {/* My owned classes */}
          {isClassTeacher && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
                My Classes — Class Teacher ({myClasses.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {myClasses.map((u) => {
                  const cnt = getCount(u.id);
                  return (
                    <div
                      key={u.id}
                      className="rounded-xl p-4"
                      style={{ background: 'rgba(174,85,37,0.06)', border: '1px solid rgba(174,85,37,0.18)' }}
                    >
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{unitLabel(u)}</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--brand)' }}>
                        Class Teacher
                      </span>
                      {cnt && (
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                            Total: <strong style={{ color: 'var(--text-1)' }}>{cnt.total}</strong>
                          </span>
                          <span className="text-xs font-medium text-blue-600">
                            Boys: <strong>{cnt.boys}</strong>
                          </span>
                          <span className="text-xs font-medium text-pink-600">
                            Girls: <strong>{cnt.girls}</strong>
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => router.push('/portal/teacher/attendance')}
                        className="block text-xs mt-2 hover:underline"
                        style={{ color: 'var(--brand)' }}
                      >
                        Mark attendance →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subject-only teaching classes */}
          {subjectOnlyUnits.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
                Subject Teaching ({subjectOnlyUnits.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {subjectOnlyUnits.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl p-4"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <p className="font-semibold text-ds-text1 text-sm">{u.displayName || u.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {u.subjects.map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => router.push('/portal/teacher/attendance')}
                      className="block text-xs mt-2 hover:underline"
                      style={{ color: 'var(--brand)' }}
                    >
                      Mark attendance →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
