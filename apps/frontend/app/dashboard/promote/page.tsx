'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type ClassOverview = {
  id: string;
  name: string;
  displayName: string | null;
  parent: { name: string; displayName: string | null } | null;
  classTeacher: { id: string; email: string | null; phone: string | null } | null;
  hasTeacher: boolean;
  totalStudents: number;
  activeStudents: number;
  heldBackStudents: number;
};

type ClassMapSuggestion = {
  sourceUnit: { id: string; name: string; displayName: string | null };
  suggestedTargetUnitId: string | null;
};

type ClassMapEntry = {
  sourceUnitId: string;
  sourceLabel: string;
  targetUnitId: string | null; // null = graduate
};

type Step = 'review' | 'configure' | 'confirm' | 'done';

// ── Helpers ────────────────────────────────────────────────────────────────────

function unitLabel(u: { name: string; displayName: string | null; parent?: { name: string; displayName: string | null } | null }) {
  const label = u.displayName || u.name;
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${label}`;
  return label;
}

function autoYearName(start: string, end: string): string {
  if (!start || !end) return '';
  const sy = new Date(start).getFullYear();
  const ey = new Date(end).getFullYear();
  if (!sy || !ey || sy >= ey) return '';
  return `${sy}-${String(ey).slice(-2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function YearEndPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('review');

  // Step 1 — Overview
  const [overview, setOverview] = useState<ClassOverview[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewErr, setOverviewErr] = useState<string | null>(null);

  // Step 2 — Configure
  const [newYearStartDate, setNewYearStartDate] = useState('');
  const [newYearEndDate, setNewYearEndDate]     = useState('');
  const [classMap, setClassMap]                 = useState<ClassMapEntry[]>([]);
  const [allUnits, setAllUnits]                 = useState<{ id: string; name: string; displayName: string | null }[]>([]);
  const [configLoading, setConfigLoading]       = useState(false);
  const [configErr, setConfigErr]               = useState<string | null>(null);

  // Step 3 — Execute
  const [executing, setExecuting] = useState(false);
  const [executeErr, setExecuteErr] = useState<string | null>(null);

  // Step 4 — Done
  const [result, setResult] = useState<{
    studentsPromoted: number;
    studentsGraduated: number;
    studentsHeldBackReset: number;
    newYearName: string;
  } | null>(null);

  // ── Load overview ──────────────────────────────────────────────────────────

  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    setOverviewErr(null);
    apiFetch('/academic/transition/overview')
      .then((d) => setOverview(Array.isArray(d) ? (d as ClassOverview[]) : []))
      .catch((e: unknown) => setOverviewErr(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setOverviewLoading(false));
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // ── Load class map suggestions + all leaf units ────────────────────────────

  const loadConfigData = useCallback(async () => {
    setConfigLoading(true);
    setConfigErr(null);
    try {
      const [suggestions, units] = await Promise.all([
        apiFetch('/academic/transition/class-map') as Promise<ClassMapSuggestion[]>,
        apiFetch('/academic/units/leaf') as Promise<{ id: string; name: string; displayName: string | null }[]>,
      ]);
      setAllUnits(Array.isArray(units) ? units : []);
      setClassMap(
        (Array.isArray(suggestions) ? suggestions : []).map((s) => ({
          sourceUnitId: s.sourceUnit.id,
          sourceLabel: unitLabel(s.sourceUnit),
          targetUnitId: s.suggestedTargetUnitId,
        })),
      );
    } catch (e: unknown) {
      setConfigErr(e instanceof Error ? e.message : 'Failed to load class data');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // ── Preview computation (client-side) ─────────────────────────────────────

  const preview = (() => {
    let promoted = 0, graduated = 0, heldBackReset = 0;
    for (const entry of classMap) {
      const unit = overview.find((u) => u.id === entry.sourceUnitId);
      if (!unit) continue;
      if (entry.targetUnitId === null) graduated += unit.activeStudents;
      else promoted += unit.activeStudents;
      heldBackReset += unit.heldBackStudents;
    }
    return { promoted, graduated, heldBackReset };
  })();

  const newYearName = autoYearName(newYearStartDate, newYearEndDate);

  // ── Totals for review step ─────────────────────────────────────────────────

  const totalStudents  = overview.reduce((s, u) => s + u.totalStudents, 0);
  const totalActive    = overview.reduce((s, u) => s + u.activeStudents, 0);
  const totalHeldBack  = overview.reduce((s, u) => s + u.heldBackStudents, 0);
  const classesNoTeacher = overview.filter((u) => !u.hasTeacher && u.totalStudents > 0).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const goToConfigure = () => {
    setStep('configure');
    // Only load config data if the class map hasn't been populated yet.
    // This preserves any manual changes the admin made if they navigate
    // back to Step 1 and then return to Step 2.
    if (classMap.length === 0) loadConfigData();
  };

  const canPreview = newYearName && classMap.length > 0 && !configLoading;

  const execute = async () => {
    if (!newYearName || !newYearStartDate || !newYearEndDate || !classMap.length) return;
    setExecuting(true);
    setExecuteErr(null);
    try {
      const res = await apiFetch('/academic/transition/execute', {
        method: 'POST',
        body: JSON.stringify({
          newYearName,
          newYearStartDate,
          newYearEndDate,
          classMap: classMap.map((e) => ({
            sourceUnitId: e.sourceUnitId,
            targetUnitId: e.targetUnitId,
          })),
        }),
      });
      setResult(res as typeof result);
      setStep('done');
    } catch (e: unknown) {
      setExecuteErr(e instanceof Error ? e.message : 'Transition failed. Please try again.');
    } finally {
      setExecuting(false);
    }
  };

  // ── Stepper indicator ─────────────────────────────────────────────────────

  const STEPS = ['Review', 'Configure', 'Confirm', 'Done'];
  const stepIndex = { review: 0, configure: 1, confirm: 2, done: 3 }[step];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ds-text1">Year-End Transition</h1>
        <p className="text-sm mt-0.5 text-ds-text3">
          Bulk-promote all students to the next academic year in one guided workflow.
        </p>
      </div>

      {/* Stepper */}
      {step !== 'done' && (
        <div className="flex items-center gap-0 mb-8">
          {STEPS.slice(0, 3).map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    i < stepIndex
                      ? 'bg-green-500 text-white'
                      : i === stepIndex
                      ? 'text-white'
                      : 'text-ds-text3'
                  }`}
                  style={i === stepIndex ? { background: 'var(--brand)' } : i < stepIndex ? {} : { background: 'var(--border)', color: 'var(--text-3)' }}
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === stepIndex ? 'text-ds-text1' : 'text-ds-text3'}`}
                  style={i === stepIndex ? { color: 'var(--text-1)' } : { color: 'var(--text-3)' }}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div className="w-12 h-px mx-3" style={{ background: i < stepIndex ? '#22c55e' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 1: Review ── */}
      {step === 'review' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Students', value: overviewLoading ? '—' : totalStudents, color: 'var(--brand)' },
              { label: 'Active (to promote)', value: overviewLoading ? '—' : totalActive, color: '#16a34a' },
              { label: 'Held Back', value: overviewLoading ? '—' : totalHeldBack, color: '#d97706' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{c.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Warning: classes without teacher */}
          {classesNoTeacher > 0 && (
            <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
              style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>
                <strong>{classesNoTeacher} class{classesNoTeacher > 1 ? 'es have' : ' has'} students but no class teacher assigned.</strong>{' '}
                Teachers use the Teacher Portal to mark held-back students before year-end.
                You can still run the transition — unreviewed students will be treated as promoted.
              </span>
            </div>
          )}

          {/* Class table */}
          {overviewLoading ? (
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading classes…</p>
          ) : overviewErr ? (
            <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid #fca5a5' }}>
              <p className="text-sm" style={{ color: '#dc2626' }}>{overviewErr}</p>
              <button onClick={loadOverview} className="mt-3 text-xs underline" style={{ color: 'var(--brand)' }}>Retry</button>
            </div>
          ) : overview.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No classes found. Add classes in the Classes section first.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--surface)' }}>
                  <tr>
                    {['Class', 'Total', 'Active', 'Held Back', 'Class Teacher'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-1)' }}>
                        {unitLabel(u)}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-1)' }}>{u.totalStudents}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-ds-success-bg text-ds-success-text">{u.activeStudents}</span>
                      </td>
                      <td className="px-4 py-3">
                        {u.heldBackStudents > 0
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-ds-warning-bg text-ds-warning-text">{u.heldBackStudents}</span>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: u.classTeacher ? 'var(--text-2)' : 'var(--text-3)' }}>
                        {u.classTeacher
                          ? (u.classTeacher.email || u.classTeacher.phone)
                          : <span className="italic">Not assigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {overview.length > 0 && !overviewLoading && (
            <div className="flex justify-end">
              <button
                onClick={goToConfigure}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--brand)' }}
              >
                Plan Transition →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Configure ── */}
      {step === 'configure' && (
        <div className="space-y-6">
          {/* New Academic Year */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-1)' }}>New Academic Year</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Start Date</label>
                <input
                  type="date"
                  value={newYearStartDate}
                  onChange={(e) => setNewYearStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>End Date</label>
                <input
                  type="date"
                  value={newYearEndDate}
                  onChange={(e) => setNewYearEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Year Label</label>
                <div
                  className="w-full px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: newYearName ? '#f0fdf4' : newYearStartDate && newYearEndDate ? '#fef2f2' : 'var(--bg)',
                    border: `1px solid ${newYearName ? '#86efac' : newYearStartDate && newYearEndDate ? '#fecaca' : 'var(--border)'}`,
                    color: newYearName ? '#15803d' : newYearStartDate && newYearEndDate ? '#dc2626' : 'var(--text-3)',
                  }}
                >
                  {newYearName
                    ? newYearName
                    : newYearStartDate && newYearEndDate
                    ? 'End date must be after start date'
                    : 'Auto-calculated from dates'}
                </div>
              </div>
            </div>
          </div>

          {/* Class Progression Map */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Class Progression</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                Define where each class's students move. Select "Graduate" for the final year.
              </p>
            </div>

            {configLoading ? (
              <div className="p-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>Loading class data…</div>
            ) : configErr ? (
              <div className="p-6 text-center">
                <p className="text-sm" style={{ color: '#dc2626' }}>{configErr}</p>
                <button onClick={loadConfigData} className="mt-2 text-xs underline" style={{ color: 'var(--brand)' }}>Retry</button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg)' }}>
                  <tr>
                    {['Current Class', 'Students', 'Held Back', 'Move To'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classMap.map((entry, i) => {
                    const ov = overview.find((u) => u.id === entry.sourceUnitId);
                    return (
                      <tr key={entry.sourceUnitId}
                        style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-1)' }}>{entry.sourceLabel}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{ov?.activeStudents ?? 0} active</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{ov?.heldBackStudents ?? 0}</td>
                        <td className="px-4 py-3">
                          <select
                            value={entry.targetUnitId ?? '__graduate__'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setClassMap((prev) =>
                                prev.map((m) =>
                                  m.sourceUnitId === entry.sourceUnitId
                                    ? { ...m, targetUnitId: val === '__graduate__' ? null : val }
                                    : m,
                                ),
                              );
                            }}
                            className="px-2 py-1 rounded-lg text-xs outline-none"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)', minWidth: 160 }}
                          >
                            <option value="__graduate__">🎓 Graduate (Exit School)</option>
                            {allUnits
                              .filter((u) => u.id !== entry.sourceUnitId)
                              .map((u) => (
                                <option key={u.id} value={u.id}>{u.displayName || u.name}</option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {configErr && (
            <div className="px-4 py-3 rounded-lg text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              {configErr}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('review')} className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              ← Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!canPreview}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--brand)' }}
            >
              Preview & Confirm →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Confirm ── */}
      {step === 'confirm' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Will be Promoted', value: preview.promoted, color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
              { label: 'Will Graduate', value: preview.graduated, color: '#7c3aed', bg: '#faf5ff', border: '#c4b5fd' },
              { label: 'Repeat Year (Stay in Class)', value: preview.heldBackReset, color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl p-5" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <p className="text-xs font-medium" style={{ color: c.color }}>{c.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
                <p className="text-xs mt-1" style={{ color: c.color, opacity: 0.7 }}>students</p>
              </div>
            ))}
          </div>

          {/* New year info */}
          <div className="rounded-xl px-5 py-4 flex items-center gap-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                New active year: <span style={{ color: '#6366f1' }}>{newYearName}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {newYearStartDate} → {newYearEndDate}
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
            style={{ background: '#fff1f2', border: '1px solid #fda4af', color: '#be123c' }}>
            <span className="mt-0.5 shrink-0 text-base">⚠</span>
            <div>
              <strong>This action cannot be undone.</strong> All student records will be updated immediately,
              the new academic year will become active, and promoted students will be assigned new roll numbers.
              Make sure all class teachers have reviewed and marked held-back students before proceeding.
            </div>
          </div>

          {executeErr && (
            <div className="px-4 py-3 rounded-lg text-xs" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              {executeErr}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('configure')} disabled={executing}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              ← Back
            </button>
            <button
              onClick={() => void execute()}
              disabled={executing}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2"
              style={{ background: '#dc2626' }}
            >
              {executing && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                </svg>
              )}
              {executing ? 'Executing…' : 'Execute Year-End Transition'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 'done' && result && (
        <div className="flex flex-col items-center py-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: '#f0fdf4', border: '2px solid #86efac' }}>
            <svg width="28" height="28" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Transition Complete!</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              Academic year <strong style={{ color: 'var(--text-1)' }}>{result.newYearName}</strong> is now active.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            {[
              { label: 'Promoted', value: result.studentsPromoted, color: '#16a34a' },
              { label: 'Graduated', value: result.studentsGraduated, color: '#7c3aed' },
              { label: 'Repeat Year', value: result.studentsHeldBackReset, color: '#d97706' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{c.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--brand)' }}
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => { setStep('review'); setResult(null); loadOverview(); }}
              className="px-5 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              View Updated Classes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
