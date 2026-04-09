'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface Student {
  id: string;
  admissionNo: string;
  rollNo?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  fatherName?: string;
  motherName?: string;
  parentPhone?: string;
  secondaryPhone?: string;
  admissionDate?: string;
  academicUnitId?: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  aadharNumber?: string;
  tcFromPrevious?: string;
  tcPreviousInstitution?: string;
  status?: string;
  createdAt: string;
  academicUnit?: { id: string; name: string; displayName?: string };
  userAccount?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  parentUser?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
}

interface AcademicUnit {
  id: string;
  name: string;
  displayName?: string;
}

function initials(s: Student) {
  return `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase();
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function StudentDirectoryPage() {
  const user = useAuthStore((s) => s.user);

  const [students, setStudents] = useState<Student[]>([]);
  const [academicUnits, setAcademicUnits] = useState<AcademicUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [profile, setProfile] = useState<Student | null>(null);

  const [linkingStudent, setLinkingStudent] = useState<Student | null>(null);
  const [linkUserId, setLinkUserId] = useState('');
  const [linkType, setLinkType] = useState<'student' | 'parent'>('parent');
  const [linkSearch, setLinkSearch] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; email?: string; phone?: string } | null | 'not_found'>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const loadData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const [s, u] = await Promise.all([
        apiFetch('/students?page=1&limit=500'),
        apiFetch('/academic/units/classes'),
      ]);
      setStudents((s as any).data || s || []);
      setAcademicUnits(Array.isArray(u) ? u : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user?.institutionId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.admissionNo.toLowerCase().includes(q) ||
      (s.parentPhone || '').includes(q) ||
      (s.phone || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
    const matchClass = !filterClass || s.academicUnitId === filterClass;
    return matchSearch && matchClass;
  });

  const openProfile = async (s: Student) => {
    setProfile(s);
  };

  const handleUnlink = async (studentId: string, role: 'student' | 'parent') => {
    if (!confirm(`Unlink ${role} account?`)) return;
    setUnlinking(true);
    try {
      await apiFetch(`/students/${studentId}/link-user?role=${role}`, { method: 'DELETE' });
      showSuccess(`${role} account unlinked`);
      await loadData();
      if (profile?.id === studentId) {
        const updated = students.find((s) => s.id === studentId);
        if (updated) setProfile(updated);
      }
    } catch (e: any) { setError(e.message); }
    finally { setUnlinking(false); }
  };

  const openLinkModal = (student: Student) => {
    setLinkingStudent(student);
    setLinkUserId('');
    setLinkType('parent');
    setFoundUser(null);
    const preSearch = student.parentPhone || '';
    setLinkSearch(preSearch);
    if (preSearch) searchUserByIdentifier(preSearch);
  };

  const searchUserByIdentifier = async (identifier: string) => {
    if (!identifier.trim()) return;
    setSearchingUser(true);
    setFoundUser(null);
    setLinkUserId('');
    try {
      const users = await apiFetch('/users') as { id: string; email?: string; phone?: string }[];
      const match = users.find(
        (u) =>
          (u.phone && u.phone === identifier.trim()) ||
          (u.email && u.email.toLowerCase() === identifier.trim().toLowerCase()),
      );
      if (match) {
        setFoundUser({ id: match.id, email: match.email, phone: match.phone });
        setLinkUserId(match.id);
      } else {
        setFoundUser('not_found');
      }
    } catch { /* ignore */ } finally { setSearchingUser(false); }
  };

  const handleLink = async () => {
    if (!linkingStudent || !linkUserId) return;
    setLinking(true);
    try {
      await apiFetch(`/students/${linkingStudent.id}/link-user`, {
        method: 'POST',
        body: JSON.stringify({ userId: linkUserId, role: linkType }),
      });
      showSuccess(`${linkType} account linked`);
      setLinkingStudent(null);
      await loadData();
    } catch (e: any) { setError(e.message); }
    finally { setLinking(false); }
  };

  const getUnit = (s: Student) =>
    academicUnits.find((u) => u.id === s.academicUnitId) || s.academicUnit;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Directory List ── */}
      <div className={`flex-1 p-8 overflow-auto ${profile ? 'max-w-3xl' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Student Directory</h1>
            <p className="text-sm text-gray-400 mt-0.5">Search and manage all student records</p>
          </div>
          <a href="/dashboard/students"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            ← New Admission
          </a>
        </div>

        {error && <div className="mt-3 mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
        {success && <div className="mt-3 mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

        {/* Search + Filter */}
        <div className="flex gap-3 mt-5 mb-4">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Search by name, admission no, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <select
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black min-w-32"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {academicUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName || u.name}</option>
            ))}
          </select>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
          {(search || filterClass) && (
            <button onClick={() => { setSearch(''); setFilterClass(''); }}
              className="text-xs text-indigo-600 hover:underline ml-2">
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">
              {students.length === 0 ? 'No students yet. Use New Admission to add students.' : 'No results match your search.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Adm. No', 'Name', 'Class', 'Parent Phone', 'Portal', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => {
                  const unit = getUnit(s);
                  const hasParent = !!s.parentUser;
                  const isSelected = profile?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => openProfile(s)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.admissionNo}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                            {initials(s)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{s.firstName} {s.lastName}</p>
                            {s.gender && <p className="text-xs text-gray-400 capitalize">{s.gender}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{(unit as any)?.displayName || (unit as any)?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{s.parentPhone || '—'}</td>
                      <td className="px-4 py-3">
                        {hasParent ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            Parent linked
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            No portal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-indigo-500">View →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Student Profile Panel ── */}
      {profile && (
        <div className="w-96 border-l border-gray-200 bg-white h-full overflow-y-auto shrink-0 flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-base">{profile.firstName} {profile.lastName}</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{profile.admissionNo}</p>
            </div>
            <button onClick={() => setProfile(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5">×</button>
          </div>

          <div className="flex-1 px-6 py-5 space-y-5 text-sm">
            {/* Avatar */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-gray-100">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700 mb-3">
                {initials(profile)}
              </div>
              <p className="font-semibold text-gray-800">{profile.firstName} {profile.lastName}</p>
              <p className="text-xs text-gray-400 font-mono">{profile.admissionNo}</p>
              {profile.rollNo && <p className="text-xs text-gray-400">Roll: {profile.rollNo}</p>}
              <span className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                profile.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {profile.status || 'active'}
              </span>
            </div>

            {/* Basic Info */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Student Details</p>
              <div className="space-y-2">
                <Row label="Class" value={(getUnit(profile) as any)?.displayName || (getUnit(profile) as any)?.name || '—'} />
                <Row label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
                <Row label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—'} />
                <Row label="Blood Group" value={profile.bloodGroup || '—'} />
                <Row label="Student Phone" value={profile.phone || '—'} />
                <Row label="Email" value={profile.email || '—'} />
                <Row label="Admission Date" value={formatDate(profile.admissionDate)} />
              </div>
            </div>

            {/* Parent / Guardian */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Parent / Guardian</p>
              <div className="space-y-2">
                <Row label="Father" value={profile.fatherName || '—'} />
                <Row label="Mother" value={profile.motherName || '—'} />
                <Row label="Primary Contact" value={profile.parentPhone || '—'} />
                <Row label="Secondary Contact" value={profile.secondaryPhone || '—'} />
              </div>
            </div>

            {/* Address */}
            {profile.address && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Address</p>
                <p className="text-gray-700 text-xs leading-relaxed">{profile.address}</p>
              </div>
            )}

            {/* Demographics */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Demographics</p>
              <div className="space-y-2">
                <Row label="Caste Category" value={profile.casteCategory || '—'} />
                <Row label="Religion" value={profile.religion || '—'} />
                <Row label="Nationality" value={profile.nationality || '—'} />
                <Row label="Aadhar No" value={profile.aadharNumber || '—'} mono />
              </div>
            </div>

            {/* TC */}
            {profile.tcFromPrevious && profile.tcFromPrevious !== 'not_applicable' && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Transfer Certificate</p>
                <div className="space-y-2">
                  <Row label="TC Status" value={profile.tcFromPrevious.replace('_', ' ')} />
                  <Row label="Previous School" value={profile.tcPreviousInstitution || '—'} />
                </div>
              </div>
            )}

            {/* Portal Access */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Portal Access</p>
              <div className="space-y-3">
                {/* Parent Portal */}
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Parent Portal</p>
                  {profile.parentUser ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Linked</span>
                        <p className="text-xs text-gray-500 mt-1">{profile.parentUser.email || profile.parentUser.phone || 'ID: ' + profile.parentUser.id.slice(-8)}</p>
                      </div>
                      <button onClick={() => handleUnlink(profile.id, 'parent')} disabled={unlinking}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Unlink
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-600">Not linked</span>
                      <button onClick={() => openLinkModal(profile)}
                        className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-indigo-700">
                        Link Parent
                      </button>
                    </div>
                  )}
                </div>

                {/* Student Portal */}
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Student Portal</p>
                  {profile.userAccount ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Linked</span>
                        <p className="text-xs text-gray-500 mt-1">{profile.userAccount.email || profile.userAccount.phone}</p>
                      </div>
                      <button onClick={() => handleUnlink(profile.id, 'student')} disabled={unlinking}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Unlink
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Not linked</span>
                      <button onClick={() => { setLinkType('student'); openLinkModal(profile); }}
                        className="text-xs bg-gray-800 text-white px-3 py-1 rounded-lg font-medium hover:bg-gray-700">
                        Link Student
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Modal ── */}
      {linkingStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-0.5">Link Portal Account</h2>
            <p className="text-xs text-gray-400 mb-4">
              Student: <span className="font-medium text-gray-700">{linkingStudent.firstName} {linkingStudent.lastName}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Account Type</label>
                <div className="flex gap-2">
                  {(['parent', 'student'] as const).map((t) => (
                    <button key={t} onClick={() => { setLinkType(t); setFoundUser(null); setLinkUserId(''); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        linkType === t ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}>
                      {t === 'student' ? 'Student Login' : 'Parent Login'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Search by Phone or Email</label>
                <div className="flex gap-2">
                  <input type="text"
                    className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Phone number or email"
                    value={linkSearch}
                    onChange={(e) => { setLinkSearch(e.target.value); setFoundUser(null); setLinkUserId(''); }}
                  />
                  <button onClick={() => searchUserByIdentifier(linkSearch)}
                    disabled={searchingUser || !linkSearch.trim()}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                    {searchingUser ? '...' : 'Search'}
                  </button>
                </div>
                {linkType === 'parent' && linkingStudent.parentPhone && (
                  <p className="text-xs text-gray-400 mt-1">
                    Registered parent phone: <span className="font-medium">{linkingStudent.parentPhone}</span>
                  </p>
                )}
              </div>
              {foundUser === 'not_found' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  No account found with that phone/email.
                </div>
              )}
              {foundUser && foundUser !== 'not_found' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-700">Account found</p>
                    <p className="text-xs text-green-600 mt-0.5">{foundUser.email || foundUser.phone}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ready to link</span>
                </div>
              )}
            </div>
            {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={handleLink} disabled={linking || !linkUserId}
                className="flex-1 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {linking ? 'Linking...' : 'Link Account'}
              </button>
              <button onClick={() => { setLinkingStudent(null); setError(null); }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper component ──────────────────────────────────────────────────────────
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-400 text-xs shrink-0">{label}</span>
      <span className={`text-gray-700 text-xs text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
