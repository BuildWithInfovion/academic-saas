'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface ClassTeacher { id: string; email: string | null; phone: string | null; }
interface ParentUnit { id: string; name: string; displayName: string | null; }
interface ClassUnit {
  id: string; name: string; displayName: string | null; level: number;
  parentId: string | null; classTeacherUserId: string | null;
  classTeacher: ClassTeacher | null; parent: ParentUnit | null;
}
interface TeacherUser {
  id: string; email: string | null; phone: string | null;
  roles: { role: { code: string; label: string } }[];
}
interface AcademicUnit { id: string; name: string; displayName: string | null; level: number; parentId: string | null; }

const inp = 'border border-gray-300 p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black w-full';

function toSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassUnit[]>([]);
  const [allUnits, setAllUnits] = useState<AcademicUnit[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Assign panel
  const [assigningUnit, setAssigningUnit] = useState<ClassUnit | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [saving, setSaving] = useState(false);

  // Create wizard
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<'class' | 'section' | null>(null);
  // class mode
  const [newClassName, setNewClassName] = useState('');
  // section mode
  const [newSectionParent, setNewSectionParent] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [creating, setCreating] = useState(false);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const [classData, unitData, userData] = await Promise.all([
        apiFetch('/academic/class-teachers'),
        apiFetch('/academic/units'),
        apiFetch('/users?role=teacher'),
      ]);
      setClasses(Array.isArray(classData) ? classData : []);
      setAllUnits(Array.isArray(unitData) ? unitData : []);
      setTeachers(Array.isArray(userData) ? (userData as TeacherUser[]) : []);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const openAssign = (unit: ClassUnit) => {
    setAssigningUnit(unit);
    setSelectedTeacherId(unit.classTeacherUserId ?? '');
  };

  const saveClassTeacher = async () => {
    if (!assigningUnit) return;
    setSaving(true); setError(null);
    try {
      if (selectedTeacherId) {
        await apiFetch(`/academic/units/${assigningUnit.id}/class-teacher`, {
          method: 'PATCH',
          body: JSON.stringify({ teacherUserId: selectedTeacherId }),
        });
        showSuccess(`Class teacher assigned to ${assigningUnit.displayName || assigningUnit.name}`);
      } else {
        await apiFetch(`/academic/units/${assigningUnit.id}/class-teacher`, { method: 'DELETE' });
        showSuccess('Class teacher removed');
      }
      setAssigningUnit(null);
      await loadClasses();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async (unit: ClassUnit) => {
    const label = unit.displayName || unit.name;
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await apiFetch(`/academic/units/${unit.id}`, { method: 'DELETE' });
      showSuccess(`"${label}" deleted`);
      await loadClasses();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to delete');
    }
  };

  const resetCreate = () => {
    setShowCreate(false); setCreateType(null);
    setNewClassName(''); setNewSectionParent(''); setNewSectionName('');
  };

  const createClass = async () => {
    const displayName = newClassName.trim();
    if (!displayName) return;
    setCreating(true); setError(null);
    try {
      await apiFetch('/academic/units', {
        method: 'POST',
        body: JSON.stringify({ name: toSlug(displayName), displayName, level: 1 }),
      });
      showSuccess(`"${displayName}" created`);
      resetCreate();
      await loadClasses();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const createSection = async () => {
    const sectionName = newSectionName.trim();
    if (!newSectionParent || !sectionName) return;
    const parentUnit = allUnits.find((u) => u.id === newSectionParent);
    if (!parentUnit) return;
    const parentLabel = parentUnit.displayName || parentUnit.name;
    const displayName = `${parentLabel} - ${sectionName}`;
    setCreating(true); setError(null);
    try {
      await apiFetch('/academic/units', {
        method: 'POST',
        body: JSON.stringify({
          name: toSlug(displayName),
          displayName,
          level: parentUnit.level + 1,
          parentId: newSectionParent,
        }),
      });
      showSuccess(`Section "${displayName}" created`);
      resetCreate();
      await loadClasses();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const teacherLabel = (t: TeacherUser) => t.email || t.phone || t.id.slice(-6);

  // Top-level units (no parent) — for "class" dropdown in section creation
  const topLevelUnits = allUnits.filter((u) => u.parentId === null && !u.displayName?.includes('deleted'));

  // Group leaf classes by parent name for display
  const grouped = classes.reduce<Record<string, ClassUnit[]>>((acc, cls) => {
    const key = cls.parent?.displayName || cls.parent?.name || (cls.parentId ? 'Other' : 'No Parent');
    if (!acc[key]) acc[key] = [];
    acc[key].push(cls);
    return acc;
  }, {});

  // Natural numeric sort (Class 1, 2, 3 … 10, 11 — not 1, 10, 11, 2 …)
  const naturalSort = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

  // Sort groups — put "No Parent" last, others numerically
  const groupEntries = Object.entries(grouped)
    .sort(([a], [b]) => {
      if (a === 'No Parent') return 1;
      if (b === 'No Parent') return -1;
      return naturalSort(a, b);
    })
    .map(([key, units]) => [key, [...units].sort((a, b) => naturalSort(
      a.displayName || a.name, b.displayName || b.name,
    ))] as [string, ClassUnit[]]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Classes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage classes, sections and assign class teachers</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          + Add Class / Section
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-500 font-medium mb-1">No classes yet</p>
          <p className="text-sm text-gray-400">Click "+ Add Class / Section" to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupEntries.map(([parentName, units]) => (
            <div key={parentName} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{parentName}</span>
                <span className="text-xs text-gray-400">{units.length} class{units.length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {units.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{cls.displayName || cls.name}</p>
                      {cls.classTeacher ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          {cls.classTeacher.email || cls.classTeacher.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-1 inline-block">
                          No class teacher
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openAssign(cls)}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {cls.classTeacher ? 'Change Teacher' : 'Assign Teacher'}
                      </button>
                      <button
                        onClick={() => deleteUnit(cls)}
                        className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Assign Class Teacher Slide-in ── */}
      {assigningUnit && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setAssigningUnit(null)} />
          <div className="w-96 bg-white h-full shadow-xl flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Assign Class Teacher</h2>
              <p className="text-xs text-gray-400 mt-0.5">{assigningUnit.displayName || assigningUnit.name}</p>
            </div>
            <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
              {assigningUnit.classTeacher && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-700 mb-0.5">Currently Assigned</p>
                  <p className="text-sm text-green-800">{assigningUnit.classTeacher.email || assigningUnit.classTeacher.phone}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Select Teacher</label>
                {teachers.length === 0 ? (
                  <p className="text-sm text-gray-400">No teachers found. Add teacher users from the Staff page first.</p>
                ) : (
                  <select className={inp} value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)}>
                    <option value="">— Remove class teacher —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{teacherLabel(t)}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-gray-400">
                The class teacher is accountable for this class — can promote students and view full scorecards.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={saveClassTeacher} disabled={saving}
                className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setAssigningUnit(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Wizard Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">

            {/* Step 1: pick type */}
            {!createType && (
              <>
                <h2 className="font-semibold text-gray-800 text-lg mb-1">What do you want to add?</h2>
                <p className="text-sm text-gray-400 mb-5">Choose the type of unit to create</p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setCreateType('class')}
                    className="border-2 border-gray-200 hover:border-black rounded-xl p-5 text-left transition-colors group"
                  >
                    <p className="text-2xl mb-2">🏫</p>
                    <p className="font-semibold text-gray-800 group-hover:text-black">New Class</p>
                    <p className="text-xs text-gray-400 mt-1">e.g. Class 1, Class 2, Grade 10, Nursery</p>
                  </button>
                  <button
                    onClick={() => setCreateType('section')}
                    className="border-2 border-gray-200 hover:border-black rounded-xl p-5 text-left transition-colors group"
                  >
                    <p className="text-2xl mb-2">🔤</p>
                    <p className="font-semibold text-gray-800 group-hover:text-black">New Section / Division</p>
                    <p className="text-xs text-gray-400 mt-1">e.g. Class 1 - A, Class 1 - B, Rose, Lotus</p>
                  </button>
                </div>
                <button onClick={resetCreate} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </>
            )}

            {/* Step 2a: New top-level class */}
            {createType === 'class' && (
              <>
                <button onClick={() => setCreateType(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">← Back</button>
                <h2 className="font-semibold text-gray-800 text-lg mb-1">Add New Class</h2>
                <p className="text-sm text-gray-400 mb-5">Enter the class name as students and teachers will see it</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Class Name *</label>
                    <input
                      className={inp}
                      placeholder="e.g. Class 1, Grade 5, Nursery, KG"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      autoFocus
                    />
                    {newClassName.trim() && (
                      <p className="text-xs text-gray-400 mt-1">Will appear as: <span className="font-medium text-gray-600">{newClassName.trim()}</span></p>
                    )}
                  </div>
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  <div className="flex gap-3 pt-1">
                    <button onClick={createClass} disabled={creating || !newClassName.trim()}
                      className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-800">
                      {creating ? 'Creating...' : 'Create Class'}
                    </button>
                    <button onClick={resetCreate} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2b: New section under a class */}
            {createType === 'section' && (
              <>
                <button onClick={() => setCreateType(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">← Back</button>
                <h2 className="font-semibold text-gray-800 text-lg mb-1">Add Section / Division</h2>
                <p className="text-sm text-gray-400 mb-5">Choose which class this section belongs to, then name it</p>

                {topLevelUnits.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-amber-700 font-medium">No classes exist yet</p>
                    <p className="text-xs text-amber-600 mt-1">Create a class first (e.g. "Class 1"), then come back to add sections.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Class *</label>
                      <select className={inp} value={newSectionParent} onChange={(e) => setNewSectionParent(e.target.value)}>
                        <option value="">Select class...</option>
                        {topLevelUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.displayName || u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Section Name *</label>
                      <input
                        className={inp}
                        placeholder="e.g. A, B, Rose, Lotus, Morning"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        disabled={!newSectionParent}
                      />
                      {newSectionParent && newSectionName.trim() && (
                        <p className="text-xs text-gray-400 mt-1">
                          Will appear as: <span className="font-medium text-gray-600">
                            {(allUnits.find(u => u.id === newSectionParent)?.displayName || allUnits.find(u => u.id === newSectionParent)?.name)} - {newSectionName.trim()}
                          </span>
                        </p>
                      )}
                    </div>
                    {error && <p className="text-red-500 text-xs">{error}</p>}
                    <div className="flex gap-3 pt-1">
                      <button onClick={createSection} disabled={creating || !newSectionParent || !newSectionName.trim()}
                        className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-800">
                        {creating ? 'Creating...' : 'Create Section'}
                      </button>
                      <button onClick={resetCreate} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                )}
                {topLevelUnits.length === 0 && (
                  <button onClick={resetCreate} className="mt-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
