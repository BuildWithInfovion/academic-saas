'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface Subject { id: string; name: string; code?: string; }
interface AcademicUnit { id: string; name: string; displayName?: string; }
interface Teacher { id: string; name: string | null; email: string | null; phone: string | null; }
interface UnitSubject {
  id: string; subjectId: string; teacherUserId?: string | null;
  isClassTeacher: boolean; subject: Subject;
  teacher?: Teacher | null;
}

const SUBJECT_CATALOGUE: { group: string; color: string; bg: string; border: string; subjects: { name: string; code: string }[] }[] = [
  {
    group: 'Languages', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
    subjects: [
      { name: 'English', code: 'ENG' }, { name: 'Hindi', code: 'HIN' }, { name: 'Marathi', code: 'MAR' },
      { name: 'Sanskrit', code: 'SAN' }, { name: 'Urdu', code: 'URD' }, { name: 'Tamil', code: 'TAM' },
      { name: 'Telugu', code: 'TEL' }, { name: 'Kannada', code: 'KAN' }, { name: 'Bengali', code: 'BEN' },
      { name: 'Gujarati', code: 'GUJ' }, { name: 'French', code: 'FRE' }, { name: 'German', code: 'GER' },
    ],
  },
  {
    group: 'Mathematics', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe',
    subjects: [
      { name: 'Mathematics', code: 'MATH' }, { name: 'Applied Mathematics', code: 'AMATH' }, { name: 'Statistics', code: 'STAT' },
    ],
  },
  {
    group: 'Sciences', color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0',
    subjects: [
      { name: 'Science', code: 'SCI' }, { name: 'Physics', code: 'PHY' }, { name: 'Chemistry', code: 'CHEM' },
      { name: 'Biology', code: 'BIO' }, { name: 'Environmental Studies', code: 'EVS' },
    ],
  },
  {
    group: 'Social Studies', color: '#92400e', bg: '#fffbeb', border: '#fde68a',
    subjects: [
      { name: 'Social Studies', code: 'SS' }, { name: 'History', code: 'HIST' }, { name: 'Geography', code: 'GEO' },
      { name: 'Political Science', code: 'POL' }, { name: 'Civics', code: 'CIV' }, { name: 'Economics', code: 'ECO' },
      { name: 'Sociology', code: 'SOC' }, { name: 'Psychology', code: 'PSY' },
    ],
  },
  {
    group: 'Commerce', color: '#9a3412', bg: '#fff7ed', border: '#fed7aa',
    subjects: [
      { name: 'Accountancy', code: 'ACC' }, { name: 'Business Studies', code: 'BST' },
      { name: 'Commerce', code: 'COM' }, { name: 'Entrepreneurship', code: 'ENT' },
    ],
  },
  {
    group: 'Computer & IT', color: '#075985', bg: '#f0f9ff', border: '#bae6fd',
    subjects: [
      { name: 'Computer Science', code: 'CS' }, { name: 'Information Technology', code: 'IT' },
      { name: 'Informatics Practices', code: 'IP' }, { name: 'Artificial Intelligence', code: 'AI' },
    ],
  },
  {
    group: 'Arts & Electives', color: '#9f1239', bg: '#fff1f2', border: '#fecdd3',
    subjects: [
      { name: 'Drawing & Craft', code: 'DRAW' }, { name: 'Fine Arts', code: 'ARTS' },
      { name: 'Music', code: 'MUS' }, { name: 'Dance', code: 'DAN' }, { name: 'Physical Education', code: 'PE' },
      { name: 'General Knowledge', code: 'GK' }, { name: 'Value Education', code: 'VE' },
      { name: 'Home Science', code: 'HS' }, { name: 'Agriculture', code: 'AGR' }, { name: 'Legal Studies', code: 'LAW' },
    ],
  },
];

function teacherLabel(t: Teacher | null | undefined) {
  if (!t) return '';
  return t.name || t.email || t.phone || t.id;
}

export default function SubjectsPage() {
  const user = useAuthStore((s) => s.user);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [unitSubjects, setUnitSubjects] = useState<UnitSubject[]>([]);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'assign' | 'manage'>('assign');

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  useEffect(() => {
    if (!user?.institutionId) return;
    Promise.all([
      apiFetch('/subjects'),
      apiFetch('/academic/units/leaf'),
      apiFetch('/users?role=teacher'),
    ]).then(([s, u, t]: unknown[]) => {
      setSubjects(Array.isArray(s) ? (s as Subject[]) : []);
      setUnits(Array.isArray(u) ? (u as AcademicUnit[]) : (u as { data?: AcademicUnit[] })?.data ?? []);
      setTeachers(Array.isArray(t) ? (t as Teacher[]) : []);
    }).catch(() => {});
  }, [user?.institutionId]);

  const reloadUnitSubjects = useCallback(() => {
    if (!selectedUnit) { setUnitSubjects([]); return; }
    apiFetch(`/subjects/units/${selectedUnit}`).then((res: unknown) => {
      setUnitSubjects(Array.isArray(res) ? (res as UnitSubject[]) : []);
    }).catch(() => {});
  }, [selectedUnit]);

  useEffect(() => { reloadUnitSubjects(); }, [reloadUnitSubjects]);

  const addSubject = async (name?: string, code?: string) => {
    const subjectName = name ?? newName.trim();
    const subjectCode = code ?? newCode.trim();
    if (!subjectName) return;
    setAdding(true); setError(null);
    try {
      const s = await apiFetch('/subjects', { method: 'POST', body: JSON.stringify({ name: subjectName, code: subjectCode || undefined }) }) as Subject;
      setSubjects((prev) => [...prev, s]);
      if (!name) { setNewName(''); setNewCode(''); }
      showSuccess(`"${subjectName}" added to catalogue`);
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); } finally { setAdding(false); }
  };

  const deleteSubject = async (id: string) => {
    if (!confirm('Delete this subject?')) return;
    try {
      await apiFetch(`/subjects/${id}`, { method: 'DELETE' });
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      showSuccess('Deleted');
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); }
  };

  const assignSubject = async (subjectId?: string, teacherUserId?: string | null) => {
    const sid = subjectId ?? assignSubjectId;
    if (!selectedUnit || !sid) return;
    setAssigning(true);
    try {
      await apiFetch(`/subjects/units/${selectedUnit}`, {
        method: 'POST',
        body: JSON.stringify({ subjectId: sid, teacherUserId: (teacherUserId ?? assignTeacherId) || null }),
      });
      reloadUnitSubjects();
      if (!subjectId) { setAssignSubjectId(''); setAssignTeacherId(''); }
      showSuccess('Subject assigned');
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); } finally { setAssigning(false); }
  };

  const updateTeacher = async (us: UnitSubject, newTeacherId: string) => {
    try {
      await apiFetch(`/subjects/units/${selectedUnit}`, {
        method: 'POST',
        body: JSON.stringify({ subjectId: us.subjectId, teacherUserId: newTeacherId || null }),
      });
      reloadUnitSubjects();
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); }
  };

  const unassign = async (subjectId: string) => {
    try {
      await apiFetch(`/subjects/units/${selectedUnit}/${subjectId}`, { method: 'DELETE' });
      setUnitSubjects((prev) => prev.filter((us) => us.subjectId !== subjectId));
      showSuccess('Removed');
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); }
  };

  const quickAddAndAssign = async (name: string, code: string) => {
    if (!selectedUnit) { setError('Select a class first'); return; }
    setError(null);
    let existing = subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      try {
        setAdding(true);
        const s = await apiFetch('/subjects', { method: 'POST', body: JSON.stringify({ name, code }) }) as Subject;
        setSubjects((prev) => [...prev, s]);
        existing = s;
      } catch (e: unknown) { setError((e as Error).message || 'Failed'); setAdding(false); return; }
      finally { setAdding(false); }
    }
    if (unitSubjects.find((us) => us.subjectId === existing!.id)) { showSuccess(`${name} already in this class`); return; }
    await assignSubject(existing.id, null);
  };

  const assignedSubjectIds = new Set(unitSubjects.map((us) => us.subjectId));
  const unassignedSubjects = subjects.filter((s) => !assignedSubjectIds.has(s.id));
  const selectedUnitName = units.find((u) => u.id === selectedUnit)?.displayName || units.find((u) => u.id === selectedUnit)?.name || '';

  const inp = 'border border-ds-border-strong p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Subjects</h1>
      <p className="text-sm text-ds-text3 mb-6">Manage subject catalogue and assign subjects + teachers to classes</p>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-ds-bg2 rounded-xl p-1 w-fit">
        {[{ id: 'assign', label: 'Assign to Class' }, { id: 'manage', label: 'Subject Catalogue' }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id as 'assign' | 'manage')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'}`}
          >{t.label}</button>
        ))}
      </div>

      {/* ── ASSIGN TAB ── */}
      {activeTab === 'assign' && (
        <div className="space-y-5">
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
            <label className="text-xs font-semibold text-ds-text3 uppercase tracking-wider block mb-2">Select Class</label>
            <select className={inp + ' w-64'} value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
              <option value="">Choose class...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
            {selectedUnit && (
              <p className="text-xs text-ds-text3 mt-2">
                {unitSubjects.length} subject(s) assigned to <span className="font-medium text-ds-text2">{selectedUnitName}</span>
              </p>
            )}
          </div>

          {selectedUnit && (
            <>
              {/* Quick-select */}
              <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5">
                <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">Quick Add Subject</p>
                <p className="text-xs text-ds-text3 mb-4">Click to add &amp; assign to <span className="font-medium text-ds-text2">{selectedUnitName}</span> (teacher can be set below)</p>
                <div className="space-y-4">
                  {SUBJECT_CATALOGUE.map((group) => (
                    <div key={group.group}>
                      <p className="text-xs font-semibold mb-2 text-ds-text3">{group.group}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.subjects.map((s) => {
                          const ex = subjects.find((sub) => sub.name.toLowerCase() === s.name.toLowerCase());
                          const isAssigned = ex && assignedSubjectIds.has(ex.id);
                          return (
                            <button key={s.name} onClick={() => quickAddAndAssign(s.name, s.code)}
                              disabled={!!isAssigned || assigning || adding}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                              style={isAssigned
                                ? { background: '#f1f5f9', color: '#94a3b8', borderColor: '#e2e8f0', cursor: 'default', textDecoration: 'line-through' }
                                : { background: group.bg, color: group.color, borderColor: group.border, cursor: 'pointer' }
                              }
                            >{s.name}{isAssigned && ' ✓'}</button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned subjects with teacher column */}
              <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-ds-border flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-ds-text1 text-sm">Assigned to {selectedUnitName}</h2>
                    <p className="text-xs text-ds-text3 mt-0.5">{unitSubjects.length} subject(s)</p>
                  </div>
                  {unassignedSubjects.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <select className={inp} value={assignSubjectId} onChange={(e) => setAssignSubjectId(e.target.value)}>
                        <option value="">Add subject...</option>
                        {unassignedSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select className={inp} value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)}>
                        <option value="">No teacher</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
                      </select>
                      <button onClick={() => assignSubject()} disabled={assigning || !assignSubjectId}
                        className="btn-brand px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">Assign</button>
                    </div>
                  )}
                </div>
                {unitSubjects.length === 0 ? (
                  <p className="p-5 text-center text-ds-text3 text-sm">No subjects assigned yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-ds-bg2">
                      <tr>
                        <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Subject</th>
                        <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Teacher</th>
                        <th className="w-16 px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ds-border">
                      {unitSubjects.map((us) => (
                        <tr key={us.id}>
                          <td className="px-5 py-3 font-medium text-ds-text1">
                            {us.subject.name}
                            {us.subject.code && <span className="ml-2 text-xs text-ds-text3 bg-ds-bg2 px-1.5 py-0.5 rounded">{us.subject.code}</span>}
                          </td>
                          <td className="px-5 py-3">
                            <select
                              className="border border-ds-border rounded-lg p-1.5 text-xs bg-ds-surface focus:outline-none focus:ring-1 focus:ring-ds-brand"
                              value={us.teacherUserId ?? ''}
                              onChange={(e) => updateTeacher(us, e.target.value)}
                            >
                              <option value="">— No teacher —</option>
                              {teachers.map((t) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => unassign(us.subjectId)} className="text-xs text-red-400 hover:text-ds-error-text">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MANAGE TAB ── */}
      {activeTab === 'manage' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-5 mb-4">
              <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">Add Custom Subject</p>
              <div className="space-y-2">
                <input className={inp + ' w-full'} placeholder="Subject name e.g. Robotics" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className={inp + ' w-full'} placeholder="Short code (optional) e.g. ROB" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                <button onClick={() => addSubject()} disabled={adding || !newName.trim()}
                  className="btn-brand w-full py-2 rounded-lg">
                  {adding ? 'Adding...' : 'Add to Catalogue'}
                </button>
              </div>
            </div>
            <div className="card p-5">
              <p className="section-label mb-3">Add Standard Subjects</p>
              <div className="space-y-3">
                {SUBJECT_CATALOGUE.map((group) => (
                  <div key={group.group}>
                    <p className="text-xs font-semibold mb-1.5 text-ds-text3">{group.group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.subjects.map((s) => {
                        const already = subjects.some((sub) => sub.name.toLowerCase() === s.name.toLowerCase());
                        return (
                          <button key={s.name} onClick={() => !already && addSubject(s.name, s.code)} disabled={already || adding}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                            style={already
                              ? { background: '#f1f5f9', color: '#94a3b8', borderColor: '#e2e8f0', cursor: 'default' }
                              : { background: group.bg, color: group.color, borderColor: group.border, cursor: 'pointer' }
                            }
                          >{already ? `${s.name} ✓` : `+ ${s.name}`}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-ds-border text-xs font-semibold text-ds-text3 uppercase tracking-wider">
                Catalogue ({subjects.length} subjects)
              </div>
              {subjects.length === 0 ? (
                <p className="p-6 text-center text-ds-text3 text-sm">No subjects yet.</p>
              ) : (
                <ul className="divide-y divide-ds-border max-h-[600px] overflow-y-auto">
                  {subjects.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-ds-bg2">
                      <div>
                        <span className="text-sm font-medium text-ds-text1">{s.name}</span>
                        {s.code && <span className="ml-2 text-xs text-ds-text3 bg-ds-bg2 px-2 py-0.5 rounded">{s.code}</span>}
                      </div>
                      <button onClick={() => deleteSubject(s.id)} className="text-xs text-red-400 hover:text-ds-error-text">Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
