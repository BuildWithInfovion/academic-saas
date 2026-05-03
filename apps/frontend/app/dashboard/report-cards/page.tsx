'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

import type { AcademicYear, AcademicUnit } from '@/lib/types';
interface Exam { id: string; name: string; status: string; academicYear: { name: string }; }

interface ScorecardRow { subject: string; maxMarks: number; marksObtained: number | string | null; passed: boolean | null; remarks?: string; }
interface Scorecard {
  student: { id: string; firstName: string; lastName: string; admissionNo: string; rollNo?: string; academicUnit?: { name: string; displayName?: string } };
  exam: { name: string; academicYear: string };
  institution: { name: string; board?: string; address?: string; phone?: string; email?: string; logoUrl?: string; stampUrl?: string; signatureUrl?: string; principalName?: string; affiliationNo?: string; udiseCode?: string; gstin?: string } | null;
  rows: ScorecardRow[];
  totalMax: number; totalObtained: number; percentage: number; grade: string; rank: number; totalStudents: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s?: string | null) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#059669', A: '#059669', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626',
};

function gradeColor(g: string) { return GRADE_COLORS[g] ?? '#334155'; }

function rowGrade(marks: number | string | null, max: number): string {
  if (marks === 'AB' || marks === null || marks === '—') return '—';
  const pct = (Number(marks) / max) * 100;
  if (pct >= 90) return 'A+'; if (pct >= 75) return 'A'; if (pct >= 60) return 'B';
  if (pct >= 50) return 'C'; if (pct >= 35) return 'D'; return 'F';
}

function printReportCards(cards: Scorecard[]) {
  if (!cards.length) return;
  const inst = cards[0].institution;

  function esc2(s?: string | null) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const subLine = [
    inst?.board ? `Affiliated to ${esc2(inst.board)}` : '',
    inst?.affiliationNo ? `Affil No: ${esc2(inst.affiliationNo)}` : '',
    inst?.udiseCode ? `UDISE: ${esc2(inst.udiseCode)}` : '',
  ].filter(Boolean).join('  ·  ');

  const cardHtmls = cards.map((card) => {
    const rows = card.rows.map((r) => {
      const g = rowGrade(r.marksObtained, r.maxMarks);
      const absent = r.marksObtained === 'AB';
      const passColor = r.passed === true ? '#166534' : r.passed === false ? '#991b1b' : '#374151';
      const passLabel = absent ? 'Absent' : r.passed === true ? 'Pass' : r.passed === false ? 'Fail' : '—';
      return `<tr>
        <td>${esc2(r.subject)}</td>
        <td class="center">${absent ? '<em>AB</em>' : (r.marksObtained ?? '—')}</td>
        <td class="center">${r.maxMarks}</td>
        <td class="center">${absent ? '—' : typeof r.marksObtained === 'number' ? ((r.marksObtained / r.maxMarks) * 100).toFixed(0) + '%' : '—'}</td>
        <td class="center" style="font-weight:700;color:${GRADE_COLORS[g] ?? '#334155'}">${g}</td>
        <td class="center" style="color:${passColor};font-weight:600">${passLabel}</td>
      </tr>`;
    }).join('');

    return `<div class="card">
      <div class="letterhead">
        ${inst?.logoUrl ? `<img class="lh-logo" src="${esc2(inst.logoUrl)}" alt="Logo" />` : '<div style="width:58px;flex-shrink:0"></div>'}
        <div class="lh-center">
          <div class="school-name">${esc2(inst?.name ?? '')}</div>
          ${subLine ? `<div class="sub">${subLine}</div>` : ''}
          ${inst?.address ? `<div class="sub">${esc2(inst.address)}</div>` : ''}
        </div>
        ${inst?.stampUrl ? `<img class="lh-stamp" src="${esc2(inst.stampUrl)}" alt="Stamp" />` : '<div style="width:58px;flex-shrink:0"></div>'}
      </div>

      <div class="cert-title">PROGRESS REPORT CARD</div>
      <div class="exam-line">${esc2(card.exam.name)}  ·  Academic Year: ${esc2(card.exam.academicYear)}</div>

      <div class="student-row">
        <div class="student-info">
          <div class="sname">${esc2(card.student.firstName)} ${esc2(card.student.lastName)}</div>
          <div class="smeta">Adm No: <strong>${esc2(card.student.admissionNo)}</strong>${card.student.rollNo ? `  ·  Roll No: <strong>${esc2(card.student.rollNo)}</strong>` : ''}  ·  Class: <strong>${esc2(card.student.academicUnit?.displayName || card.student.academicUnit?.name || '—')}</strong></div>
        </div>
        <div class="grade-badge" style="color:${gradeColor(card.grade)}">${card.grade}</div>
      </div>

      <table>
        <thead><tr>
          <th>Subject</th><th class="center">Marks</th><th class="center">Max</th>
          <th class="center">%</th><th class="center">Grade</th><th class="center">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td><strong>Total</strong></td>
          <td class="center"><strong>${card.totalObtained}</strong></td>
          <td class="center"><strong>${card.totalMax}</strong></td>
          <td class="center"><strong>${card.percentage.toFixed(1)}%</strong></td>
          <td class="center" style="font-weight:700;color:${gradeColor(card.grade)}">${card.grade}</td>
          <td class="center" style="color:#374151">Rank: <strong>${card.rank > 0 ? card.rank : '—'}</strong> / ${card.totalStudents}</td>
        </tr></tfoot>
      </table>

      <div class="sig-row">
        <div class="sig-block">
          <div class="sig-line" style="width:160px"></div>
          Class Teacher
        </div>
        <div class="sig-block">
          ${inst?.signatureUrl ? `<img src="${esc2(inst.signatureUrl)}" style="max-height:38px;max-width:130px;object-fit:contain;display:block;margin:0 auto 3px" alt="Signature" />` : ''}
          <div class="sig-line" style="width:180px"></div>
          ${inst?.principalName ? esc2(inst.principalName) : 'Principal'}
        </div>
      </div>
      <div class="footnote">${esc2(inst?.name ?? '')}${inst?.gstin ? `  ·  GSTIN: ${esc2(inst.gstin)}` : ''}</div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>Report Cards</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#f1f5f9;padding:24px}
  .card{background:#fff;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:24px;overflow:hidden;page-break-after:always;page-break-inside:avoid}
  .letterhead{background:#0f172a;color:#fff;padding:16px 20px;display:flex;align-items:center;gap:14px}
  .lh-logo{width:58px;height:58px;object-fit:contain;flex-shrink:0;background:#fff;border-radius:4px;padding:2px}
  .lh-center{flex:1;text-align:center}
  .school-name{font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  .sub{font-size:9.5px;opacity:.6;line-height:1.7}
  .lh-stamp{width:58px;height:58px;object-fit:contain;opacity:.8;flex-shrink:0}
  .cert-title{text-align:center;font-size:13px;font-weight:700;letter-spacing:.14em;text-decoration:underline;padding:12px 0 4px;color:#0f172a;text-transform:uppercase}
  .exam-line{text-align:center;font-size:10.5px;color:#64748b;padding-bottom:10px}
  .student-row{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}
  .sname{font-size:15px;font-weight:700;color:#0f172a}
  .smeta{font-size:10.5px;color:#64748b;margin-top:3px}
  .grade-badge{font-size:42px;font-weight:900;line-height:1}
  table{width:100%;border-collapse:collapse;margin:0}
  th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0}
  td{padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:11.5px;color:#334155}
  tfoot td{background:#f8fafc;border-top:1px solid #e2e8f0;padding:8px 12px}
  .center{text-align:center}
  .sig-row{display:flex;justify-content:space-between;align-items:flex-end;padding:16px 20px 10px}
  .sig-block{text-align:center;font-size:10px;color:#64748b}
  .sig-line{border-top:1px solid #94a3b8;margin:0 auto 4px}
  .footnote{font-size:9.5px;color:#94a3b8;text-align:center;padding:6px 16px 12px}
  @media print{
    body{background:#fff;padding:0}
    .card{border:none;border-radius:0;box-shadow:none;margin:0;page-break-after:always}
    @page{margin:12mm}
  }
</style></head><body>
${cardHtmls}
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=860,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportCardsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState('');
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Scorecard[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  useEffect(() => {
    Promise.all([apiFetch('/academic/years'), apiFetch('/academic/units')])
      .then(([yrs, us]) => {
        const yrList = Array.isArray(yrs) ? yrs : [];
        setYears(yrList);
        const cur = yrList.find((y: AcademicYear) => y.isCurrent) ?? yrList[0];
        if (cur) setYearId(cur.id);
        setUnits(Array.isArray(us) ? us : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!yearId) return;
    setExams([]); setExamId(''); setPreview([]);
    apiFetch(`/exams?yearId=${yearId}`)
      .then((e: Exam[]) => {
        const list = Array.isArray(e) ? e : [];
        setExams(list.filter((ex) => ex.status === 'completed'));
      })
      .catch(() => {});
  }, [yearId]);

  const leafUnits = units.filter((u) => u.level === Math.max(...units.map((x) => x.level)));

  const handleLoad = async () => {
    if (!examId || !unitId) return;
    setLoading(true); setError(''); setPreview([]);
    try {
      const data = await apiFetch(`/exams/${examId}/class-report-cards?unitId=${unitId}`) as Scorecard[];
      setPreview(Array.isArray(data) ? data : []);
      if (!data.length) setError('No students found in this class for the selected exam.');
    } catch (e: any) {
      setError(e.message ?? 'Failed to load report cards');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Report Cards</h1>
      <p className="text-sm text-ds-text3 mb-6">Generate and print class-wise progress report cards</p>

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-green-600">{toast}</div>
      )}

      {/* Filters */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Academic Year</label>
            <select className="field w-full text-sm" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Examination</label>
            <select className="field w-full text-sm" value={examId} onChange={(e) => { setExamId(e.target.value); setPreview([]); }}>
              <option value="">Select exam…</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {exams.length === 0 && yearId && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>No completed exams this year.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Class</label>
            <select className="field w-full text-sm" value={unitId} onChange={(e) => { setUnitId(e.target.value); setPreview([]); }}>
              <option value="">Select class…</option>
              {leafUnits.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={handleLoad} disabled={!examId || !unitId || loading} className="btn-primary text-sm">
            {loading ? 'Loading…' : 'Load Report Cards'}
          </button>
          {preview.length > 0 && (
            <button onClick={() => { printReportCards(preview); showToast(`Printing ${preview.length} report card(s)`); }} className="btn-secondary text-sm">
              Print All ({preview.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{error}</div>
      )}

      {/* Preview list */}
      {preview.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{preview.length} students · {preview[0]?.exam.name}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Click "Print All" to open the print dialog for all report cards</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-2)' }}>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Student</th>
                  <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Total</th>
                  <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>%</th>
                  <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Grade</th>
                  <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Rank</th>
                  <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((card) => (
                  <tr key={card.student.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{card.student.firstName} {card.student.lastName}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>{card.student.admissionNo}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{card.totalObtained} / {card.totalMax}</td>
                    <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-2)' }}>{card.percentage.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold" style={{ color: gradeColor(card.grade) }}>{card.grade}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-2)' }}>#{card.rank}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => printReportCards([card])} className="text-xs font-medium px-3 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,.1)', color: '#6366f1' }}>
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
