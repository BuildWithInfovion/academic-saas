'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Child = { id: string; firstName: string; lastName: string; admissionNo: string };
type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Exam = { id: string; name: string; status: string; academicYear: { name: string } };
type ScorecardRow = {
  subject: string;
  maxMarks: number;
  marksObtained: number | string | null;
  passed: boolean | null;
  remarks?: string;
};
type Scorecard = {
  student: { firstName: string; lastName: string; admissionNo: string };
  exam: { name: string; academicYear: string };
  rows: ScorecardRow[];
  totalMax: number;
  totalObtained: number;
  percentage: number;
  grade: string;
  rank: number;
  totalStudents: number;
};

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-600', A: 'text-emerald-600', B: 'text-blue-600',
  C: 'text-amber-600', D: 'text-orange-600', F: 'text-red-600',
};

const GRADE_HEX: Record<string, string> = {
  'A+': '#059669', A: '#059669', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626',
};

function printReportCard(scorecard: Scorecard, inst?: { name: string; board?: string; address?: string; logoUrl?: string; stampUrl?: string; signatureUrl?: string; principalName?: string; affiliationNo?: string; udiseCode?: string; gstin?: string } | null) {
  function esc(s?: string | null) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  const subLine = [inst?.board ? `Affiliated to ${esc(inst.board)}` : '', inst?.affiliationNo ? `Affil: ${esc(inst.affiliationNo)}` : '', inst?.udiseCode ? `UDISE: ${esc(inst.udiseCode)}` : ''].filter(Boolean).join('  ·  ');
  const rows = scorecard.rows.map((r) => {
    const g = rowGrade(r.marksObtained, r.maxMarks);
    const absent = r.marksObtained === 'AB';
    const passLabel = absent ? 'Absent' : r.passed === true ? 'Pass' : r.passed === false ? 'Fail' : '—';
    const passColor = r.passed === true ? '#166534' : r.passed === false ? '#991b1b' : '#374151';
    return `<tr><td>${esc(r.subject)}</td><td class="c">${absent ? '<em>AB</em>' : (r.marksObtained ?? '—')}</td><td class="c">${r.maxMarks}</td><td class="c">${absent || typeof r.marksObtained !== 'number' ? '—' : ((r.marksObtained / r.maxMarks) * 100).toFixed(0) + '%'}</td><td class="c" style="font-weight:700;color:${GRADE_HEX[g] ?? '#334155'}">${g}</td><td class="c" style="color:${passColor};font-weight:600">${passLabel}</td></tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><title>Report Card</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#f1f5f9;padding:30px}.card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}.lh{background:#0f172a;color:#fff;padding:16px 20px;display:flex;align-items:center;gap:14px}.lh-logo{width:56px;height:56px;object-fit:contain;flex-shrink:0;background:#fff;border-radius:4px;padding:2px}.lh-c{flex:1;text-align:center}.lh-c h2{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.sub{font-size:9.5px;opacity:.6;line-height:1.7;margin-top:2px}.lh-stamp{width:56px;height:56px;object-fit:contain;opacity:.8;flex-shrink:0}.title{text-align:center;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;text-decoration:underline;padding:12px 0 4px}.exam-ln{text-align:center;font-size:10px;color:#64748b;padding-bottom:10px}.student-row{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.sname{font-size:14px;font-weight:700}.smeta{font-size:10px;color:#64748b;margin-top:2px}.grade{font-size:40px;font-weight:900}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:7px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0}td{padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:11px}.c{text-align:center}tfoot td{background:#f8fafc;border-top:1px solid #e2e8f0;padding:7px 12px}.sig-row{display:flex;justify-content:space-between;align-items:flex-end;padding:14px 20px 8px}.sig-block{text-align:center;font-size:10px;color:#64748b}.sig-block img{max-height:36px;max-width:120px;object-fit:contain;display:block;margin:0 auto 3px}.sig-line{border-top:1px solid #94a3b8;width:160px;margin:0 auto 4px}.footnote{font-size:9px;color:#94a3b8;text-align:center;padding:5px 16px 12px}@media print{body{background:#fff;padding:0}.card{border:none;border-radius:0}}</style>
</head><body><div class="card">
<div class="lh">${inst?.logoUrl ? `<img class="lh-logo" src="${esc(inst.logoUrl)}" alt="Logo" />` : '<div style="width:56px;flex-shrink:0"></div>'}<div class="lh-c"><h2>${esc(inst?.name ?? 'School')}</h2>${subLine ? `<div class="sub">${subLine}</div>` : ''}${inst?.address ? `<div class="sub">${esc(inst.address)}</div>` : ''}</div>${inst?.stampUrl ? `<img class="lh-stamp" src="${esc(inst.stampUrl)}" alt="Stamp" />` : '<div style="width:56px;flex-shrink:0"></div>'}</div>
<div class="title">PROGRESS REPORT CARD</div>
<div class="exam-ln">${esc(scorecard.exam.name)}  ·  ${esc(scorecard.exam.academicYear)}</div>
<div class="student-row"><div class="sname">${esc(scorecard.student.firstName)} ${esc(scorecard.student.lastName)}<div class="smeta">Adm No: ${esc(scorecard.student.admissionNo)}</div></div><div class="grade" style="color:${GRADE_HEX[scorecard.grade] ?? '#334155'}">${scorecard.grade}</div></div>
<table><thead><tr><th>Subject</th><th class="c">Marks</th><th class="c">Max</th><th class="c">%</th><th class="c">Grade</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td><strong>Total</strong></td><td class="c"><strong>${scorecard.totalObtained}</strong></td><td class="c"><strong>${scorecard.totalMax}</strong></td><td class="c"><strong>${scorecard.percentage.toFixed(1)}%</strong></td><td class="c" style="font-weight:700;color:${GRADE_HEX[scorecard.grade] ?? '#334155'}">${scorecard.grade}</td><td class="c">Rank: <strong>${scorecard.rank > 0 ? scorecard.rank : '—'}</strong> / ${scorecard.totalStudents}</td></tr></tfoot></table>
<div class="sig-row"><div class="sig-block"><div class="sig-line"></div>Class Teacher</div><div class="sig-block">${inst?.signatureUrl ? `<img src="${esc(inst.signatureUrl)}" alt="Signature" />` : ''}<div class="sig-line"></div>${inst?.principalName ? esc(inst.principalName) : 'Principal'}</div></div>
<div class="footnote">${esc(inst?.name ?? '')}${inst?.gstin ? `  ·  GSTIN: ${esc(inst.gstin)}` : ''}</div>
</div><script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank', 'width=700,height=920');
  if (!w) return;
  w.document.write(html); w.document.close(); w.focus();
}

function rowGrade(marks: number | string | null, max: number): string {
  if (marks === 'AB' || marks === null || marks === '—') return '—';
  const pct = (Number(marks) / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

function rowPct(marks: number | string | null, max: number): string {
  if (marks === 'AB' || marks === null || marks === '—') return '—';
  return ((Number(marks) / max) * 100).toFixed(0) + '%';
}

type Institution = { name: string; board?: string; address?: string; logoUrl?: string; stampUrl?: string; signatureUrl?: string; principalName?: string; affiliationNo?: string; udiseCode?: string; gstin?: string };

export default function ParentMarksPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);
  const [scorecardError, setScorecardError] = useState('');
  const [inst, setInst] = useState<Institution | null>(null);

  useEffect(() => {
    Promise.allSettled([apiFetch('/students/child'), apiFetch('/academic/years'), apiFetch('/institution/me')])
      .then(([kids, ys, instRes]) => {
        if (kids.status === 'fulfilled') {
          const childList = Array.isArray(kids.value) ? kids.value : [];
          setChildren(childList);
          if (childList.length > 0) setSelectedChildId(childList[0].id);
          if (childList.length === 0) setNotLinked(true);
        } else {
          setNotLinked(true);
        }
        if (ys.status === 'fulfilled') {
          const yearList = Array.isArray(ys.value) ? ys.value : [];
          setYears(yearList);
          const current = yearList.find((y: AcademicYear) => y.isCurrent) ?? yearList[0];
          if (current) setCurrentYearId(current.id);
        }
        if (instRes.status === 'fulfilled' && instRes.value) {
          setInst(instRes.value as Institution);
        }
      });
  }, []);

  useEffect(() => {
    if (!currentYearId) return;
    setExams([]);
    setSelectedExamId('');
    setScorecard(null);
    apiFetch(`/exams?yearId=${currentYearId}`)
      .then((e: Exam[]) => {
        const list = Array.isArray(e) ? e : [];
        setExams(list.filter((ex) => ex.status === 'completed'));
      })
      .catch(() => {});
  }, [currentYearId]);

  useEffect(() => {
    if (!selectedExamId || !selectedChildId) return;
    setLoading(true);
    setScorecardError('');
    setScorecard(null);
    apiFetch(`/exams/${selectedExamId}/scorecard/${selectedChildId}`)
      .then((data) => setScorecard(data as Scorecard))
      .catch((err) => {
        const msg = err?.message ?? '';
        setScorecardError(
          msg.includes('not been released')
            ? 'Results for this exam have not been released yet.'
            : msg.includes('authorised')
              ? 'You are not authorised to view this scorecard.'
              : 'Could not load scorecard. Please try again.',
        );
      })
      .finally(() => setLoading(false));
  }, [selectedExamId, selectedChildId]);

  if (notLinked) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          Your child&apos;s record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Marks &amp; Results</h1>
      <p className="text-sm text-ds-text3 mb-6">View your child&apos;s exam scorecards</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {children.length > 1 && (
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Child</label>
            <select
              value={selectedChildId}
              onChange={(e) => { setSelectedChildId(e.target.value); setScorecard(null); setScorecardError(''); }}
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Academic Year</label>
          <select
            value={currentYearId}
            onChange={(e) => setCurrentYearId(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none"
          >
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ds-text2 block mb-1">Examination</label>
          <select
            value={selectedExamId}
            onChange={(e) => { setSelectedExamId(e.target.value); setScorecardError(''); }}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none"
          >
            <option value="">Select exam…</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {/* No exams state */}
      {exams.length === 0 && currentYearId && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-8 text-center">
          <p className="text-ds-text3 text-sm">No released results for this academic year yet.</p>
          <p className="text-ds-text3 text-xs mt-1">Results become visible once the school marks the exam as completed.</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ds-text3 mt-4">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-ds-border border-t-ds-brand rounded-full" />
          Loading scorecard…
        </div>
      )}

      {scorecardError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mt-4">
          {scorecardError}
        </div>
      )}

      {scorecard && !loading && (
        <>
          {/* Summary banner */}
          <div
            className="rounded-xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4"
            style={{ background: 'linear-gradient(135deg, #0f2c5e 0%, #1a4fa0 100%)', color: '#fff' }}
          >
            <div>
              <p className="text-xs opacity-70">Exam</p>
              <p className="text-sm font-semibold mt-0.5">{scorecard.exam.name}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Total Marks</p>
              <p className="text-xl font-bold mt-0.5">{scorecard.totalObtained} / {scorecard.totalMax}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Percentage</p>
              <p className="text-xl font-bold mt-0.5">{scorecard.percentage?.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Class Rank</p>
              <p className="text-xl font-bold mt-0.5">
                #{scorecard.rank > 0 ? scorecard.rank : '—'}
                <span className="text-xs font-normal opacity-60 ml-1">/ {scorecard.totalStudents}</span>
              </p>
            </div>
          </div>

          {/* Overall grade badge + print */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-black ${GRADE_COLORS[scorecard.grade] ?? 'text-ds-text1'}`}>
                {scorecard.grade}
              </span>
              <div>
                <p className="text-sm font-medium text-ds-text1">{scorecard.student.firstName} {scorecard.student.lastName}</p>
                <p className="text-xs text-ds-text3">Adm# {scorecard.student.admissionNo} · {scorecard.exam.academicYear}</p>
              </div>
            </div>
            <button
              onClick={() => printReportCard(scorecard, inst)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ds-border text-xs font-medium text-ds-text2 hover:bg-ds-bg2 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Report Card
            </button>
          </div>

          {/* Subject-wise table */}
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ds-bg2">
                <tr>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Subject</th>
                  <th className="text-center px-4 py-3 text-ds-text2 font-medium text-xs">Marks</th>
                  <th className="text-center px-4 py-3 text-ds-text2 font-medium text-xs">Max</th>
                  <th className="text-center px-4 py-3 text-ds-text2 font-medium text-xs">%</th>
                  <th className="text-center px-4 py-3 text-ds-text2 font-medium text-xs">Grade</th>
                  <th className="text-center px-4 py-3 text-ds-text2 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {scorecard.rows.map((row, i) => {
                  const isAbsent = row.marksObtained === 'AB';
                  const grade = rowGrade(row.marksObtained, row.maxMarks);
                  return (
                    <tr key={i}>
                      <td className="px-5 py-3 text-ds-text1 font-medium">{row.subject}</td>
                      <td className="px-4 py-3 text-center text-ds-text1">
                        {isAbsent
                          ? <span className="text-xs text-ds-text3 italic">Absent</span>
                          : (row.marksObtained ?? '—')}
                      </td>
                      <td className="px-4 py-3 text-center text-ds-text2">{row.maxMarks}</td>
                      <td className="px-4 py-3 text-center text-ds-text2">{rowPct(row.marksObtained, row.maxMarks)}</td>
                      <td className={`px-4 py-3 text-center font-bold ${GRADE_COLORS[grade] ?? 'text-ds-text2'}`}>
                        {grade}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isAbsent ? (
                          <span className="text-xs bg-ds-bg2 text-ds-text2 px-2 py-0.5 rounded-full">Absent</span>
                        ) : row.passed === true ? (
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Pass</span>
                        ) : row.passed === false ? (
                          <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Fail</span>
                        ) : (
                          <span className="text-xs text-ds-text3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {scorecard.rows.some((r) => r.remarks) && (
            <div className="mt-3 space-y-1">
              {scorecard.rows.filter((r) => r.remarks).map((r, i) => (
                <p key={i} className="text-xs text-ds-text3">
                  <span className="font-medium">{r.subject}:</span> {r.remarks}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
