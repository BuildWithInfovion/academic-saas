'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Institution = {
  id: string; name: string; code: string; institutionType: string;
  address?: string; phone?: string; email?: string; website?: string; board?: string;
};
type AcademicYear = { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean };
type AcademicUnit = { id: string; name: string; displayName?: string; level: number; parentId?: string };
type FeeHead = { id: string; name: string; isCustom: boolean };
type Subject = { id: string; name: string };

type Tab = 'profile' | 'years' | 'classes' | 'fees' | 'subjects';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'Institution Profile' },
  { id: 'years',    label: 'Academic Years' },
  { id: 'classes',  label: 'Class Structure' },
  { id: 'fees',     label: 'Fee Heads' },
  { id: 'subjects', label: 'Subject Master' },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DirectorSchoolInfoPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">School Information</h1>
      <p className="text-sm text-ds-text3 mb-6">Read-only overview of institution setup and structure</p>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}

      {/* Tab bar */}
      <div className="flex gap-1 bg-ds-bg2 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-ds-surface text-ds-text1 shadow-sm' : 'text-ds-text2 hover:text-ds-text1'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile'  && <ProfileTab showError={setError} />}
      {tab === 'years'    && <YearsTab   showError={setError} />}
      {tab === 'classes'  && <ClassesTab showError={setError} />}
      {tab === 'fees'     && <FeeHeadsTab showError={setError} />}
      {tab === 'subjects' && <SubjectsTab showError={setError} />}
    </div>
  );
}

// ── Tab: Institution Profile (read-only) ──────────────────────────────────────
function ProfileTab({ showError }: { showError: (m: string) => void }) {
  const [inst, setInst] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/institution/me')
      .then((d) => setInst(d as Institution))
      .catch((e: any) => showError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-ds-text3">Loading...</p>;
  if (!inst)   return <p className="text-sm text-red-500">Failed to load institution.</p>;

  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div className="flex items-start gap-3 py-3 border-b border-ds-border last:border-0">
      <span className="text-xs font-medium text-ds-text2 w-36 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-ds-text1">{value || '—'}</span>
    </div>
  );

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6">
      <Field label="Institution Name" value={inst.name} />
      <Field label="Type"             value={inst.institutionType} />
      <Field label="Board"            value={inst.board} />
      <Field label="Login Code"       value={inst.code} />
      <Field label="Address"          value={inst.address} />
      <Field label="Phone"            value={inst.phone} />
      <Field label="Email"            value={inst.email} />
      <Field label="Website"          value={inst.website} />
    </div>
  );
}

// ── Tab: Academic Years (read-only) ───────────────────────────────────────────
function YearsTab({ showError }: { showError: (m: string) => void }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/academic/years')
      .then((d) => setYears(d as AcademicYear[]))
      .catch((e: any) => showError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
      {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : years.length === 0 ? (
        <p className="p-6 text-sm text-ds-text3">No academic years configured.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-ds-bg2">
            <tr>
              <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Name</th>
              <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Period</th>
              <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {years.map((y) => (
              <tr key={y.id} className="hover:bg-ds-bg2">
                <td className="px-5 py-3 font-medium text-ds-text1">{y.name}</td>
                <td className="px-5 py-3 text-ds-text2 text-xs">
                  {new Date(y.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} —{' '}
                  {new Date(y.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3">
                  {y.isCurrent
                    ? <span className="px-2 py-0.5 bg-ds-success-bg text-ds-success-text rounded-full text-xs font-medium">Current</span>
                    : <span className="px-2 py-0.5 bg-ds-bg2 text-ds-text2 rounded-full text-xs">Inactive</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Tab: Class Structure (read-only) ──────────────────────────────────────────
function ClassesTab({ showError }: { showError: (m: string) => void }) {
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/academic/units')
      .then((d) => setUnits(d as AcademicUnit[]))
      .catch((e: any) => showError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const rootUnits = units.filter((u) => !u.parentId);
  const childUnits = (parentId: string) => units.filter((u) => u.parentId === parentId);

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
      {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : units.length === 0 ? (
        <p className="p-6 text-sm text-ds-text3">No classes configured.</p>
      ) : (
        <div className="divide-y divide-ds-border">
          {rootUnits.map((unit) => (
            <div key={unit.id}>
              <div className="flex items-center px-5 py-3 hover:bg-ds-bg2">
                <span className="font-medium text-ds-text1 text-sm">{unit.displayName || unit.name}</span>
                <span className="ml-2 px-1.5 py-0.5 bg-ds-bg2 text-ds-text2 rounded text-[10px]">Level {unit.level}</span>
              </div>
              {childUnits(unit.id).map((child) => (
                <div key={child.id} className="flex items-center px-5 py-2.5 pl-10 bg-ds-bg2/50 border-t border-ds-border">
                  <span className="text-sm text-ds-text1">{child.displayName || child.name}</span>
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-ds-info-text rounded text-[10px]">Section</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Fee Heads (read-only) ────────────────────────────────────────────────
function FeeHeadsTab({ showError }: { showError: (m: string) => void }) {
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/fees/heads')
      .then((d) => setHeads(d as FeeHead[]))
      .catch((e: any) => showError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
      {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : heads.length === 0 ? (
        <p className="p-6 text-sm text-ds-text3">No fee heads configured.</p>
      ) : (
        <div className="divide-y divide-ds-border">
          {heads.map((h) => (
            <div key={h.id} className="flex items-center gap-2 px-5 py-3 hover:bg-ds-bg2">
              <span className="text-sm text-ds-text1">{h.name}</span>
              {!h.isCustom && <span className="px-1.5 py-0.5 bg-ds-bg2 text-ds-text3 rounded text-[10px]">Default</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Subject Master (read-only) ───────────────────────────────────────────
function SubjectsTab({ showError }: { showError: (m: string) => void }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/subjects')
      .then((d) => setSubjects(d as Subject[]))
      .catch((e: any) => showError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
      {loading ? <p className="p-6 text-sm text-ds-text3">Loading...</p> : subjects.length === 0 ? (
        <p className="p-6 text-sm text-ds-text3">No subjects configured.</p>
      ) : (
        <div className="grid grid-cols-3 gap-0 divide-y divide-ds-border">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center px-4 py-2.5 hover:bg-ds-bg2">
              <span className="text-sm text-ds-text1">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
