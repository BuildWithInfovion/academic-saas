'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  academicUnit: { id: string; name: string; displayName: string | null } | null;
};

type AcademicYear = { id: string; name: string; isCurrent: boolean };

type Exam = { id: string; name: string; status: string };

type ScorecardEntry = {
  subject: { name: string };
  marksObtained: number | null;
  isAbsent: boolean;
  maxMarks: number;
  passingMarks: number;
  percentage: number;
  grade: string;
  isPassed: boolean;
};

type Institution = { name: string; code?: string; board?: string; address?: string; phone?: string; email?: string };

type Scorecard = {
  student: { firstName: string; lastName: string; admissionNo: string; rollNo?: string; academicUnit?: { name: string; displayName?: string } };
  exam: { id: string; name: string; academicYear: string };
  institution?: Institution;
  rows: { subject: string; maxMarks: number; marksObtained: number | string; passed: boolean | null; isAbsent?: boolean; remarks?: string }[];
  totalMax: number;
  totalObtained: number;
  percentage: number;
  grade: string;
  rank: number;
  totalStudents: number;
};

type AdmitCardSubject = {
  subjectName: string;
  examDate?: string;
  examTime?: string;
  maxMarks: number;
  passingMarks: number;
};

type AdmitCard = {
  student: { firstName: string; lastName: string; admissionNo: string; rollNo?: string; dateOfBirth?: string; gender?: string; academicUnit?: { name: string; displayName?: string } };
  exam: { id: string; name: string; academicYear: string; startDate?: string; endDate?: string; examCenter?: string; reportingTime?: string };
  institution?: Institution;
  subjects: AdmitCardSubject[];
};

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Print: Report Card ────────────────────────────────────────────────────────

function printReportCard(sc: Scorecard) {
  const inst = sc.institution;
  const studentName = `${sc.student.firstName} ${sc.student.lastName}`;
  const className = sc.student.academicUnit?.displayName || sc.student.academicUnit?.name || '—';
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const gradeColor = (g: string) =>
    ({ 'A+': '#15803d', A: '#166534', B: '#1d4ed8', C: '#92400e', D: '#c2410c', F: '#b91c1c' })[g] ?? '#334155';

  const rows = sc.rows.map((r) => `
    <tr>
      <td>${esc(r.subject)}</td>
      <td class="c">${r.maxMarks}</td>
      <td class="c">${r.isAbsent ?? false ? '<span style="color:#94a3b8">Absent</span>' : esc(String(r.marksObtained ?? '—'))}</td>
      <td class="c">${r.isAbsent ?? false ? '—' : r.maxMarks > 0 ? ((Number(r.marksObtained) / r.maxMarks) * 100).toFixed(0) + '%' : '—'}</td>
      <td class="c" style="font-weight:700;color:${gradeColor(String(r.passed === null ? 'F' : r.passed ? 'B' : 'F'))}">${r.isAbsent ?? false ? '—' : r.passed ? 'Pass' : 'Fail'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Report Card — ${esc(studentName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#f1f5f9;padding:28px}
  .card{max-width:680px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}
  .letterhead{background:#0f172a;color:#fff;padding:18px 24px;text-align:center}
  .letterhead h1{font-size:17px;font-weight:700;letter-spacing:.5px;margin-bottom:3px}
  .letterhead .sub{font-size:11px;opacity:.65;line-height:1.5}
  .title-bar{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 20px;text-align:center;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0f172a}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0}
  .info-cell{padding:10px 20px;border-right:1px solid #e2e8f0;font-size:12px}
  .info-cell:nth-child(even){border-right:none}
  .info-label{color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
  .info-value{font-weight:600;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin:0}
  th{background:#f8fafc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;padding:8px 12px;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0}
  td{padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155}
  td.c{text-align:center}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);border-top:2px solid #e2e8f0}
  .sum-cell{padding:14px 12px;text-align:center;border-right:1px solid #e2e8f0}
  .sum-cell:last-child{border-right:none}
  .sum-num{font-size:22px;font-weight:800;color:#0f172a}
  .sum-lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
  .footer{text-align:center;font-size:10px;color:#94a3b8;padding:10px;border-top:1px solid #f1f5f9}
  .sig{display:flex;justify-content:space-between;padding:16px 32px 8px;font-size:11px;color:#64748b}
  .sig-line{border-top:1px solid #94a3b8;width:140px;margin-bottom:4px}
  @media print{body{background:#fff;padding:0}.card{border-radius:0;box-shadow:none};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div class="card">
  <div class="letterhead">
    <h1>${esc(inst?.name ?? '—')}</h1>
    <div class="sub">${esc([inst?.board, inst?.address].filter(Boolean).join(' · '))}</div>
  </div>
  <div class="title-bar">Progress Report Card — ${esc(sc.exam.academicYear)}</div>
  <div class="info-grid">
    <div class="info-cell"><div class="info-label">Student Name</div><div class="info-value">${esc(studentName)}</div></div>
    <div class="info-cell"><div class="info-label">Admission No</div><div class="info-value">${esc(sc.student.admissionNo)}</div></div>
    <div class="info-cell"><div class="info-label">Class / Section</div><div class="info-value">${esc(className)}</div></div>
    <div class="info-cell"><div class="info-label">Examination</div><div class="info-value">${esc(sc.exam.name)}</div></div>
  </div>
  <table>
    <thead><tr><th style="text-align:left">Subject</th><th class="c">Max Marks</th><th class="c">Marks Obtained</th><th class="c">Percentage</th><th class="c">Result</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">
    <div class="sum-cell"><div class="sum-num">${sc.totalObtained} / ${sc.totalMax}</div><div class="sum-lbl">Total Marks</div></div>
    <div class="sum-cell"><div class="sum-num">${sc.percentage.toFixed(1)}%</div><div class="sum-lbl">Percentage</div></div>
    <div class="sum-cell"><div class="sum-num" style="color:${gradeColor(sc.grade)}">${sc.grade}</div><div class="sum-lbl">Grade</div></div>
    <div class="sum-cell"><div class="sum-num">#${sc.rank} / ${sc.totalStudents}</div><div class="sum-lbl">Class Rank</div></div>
  </div>
  <div class="sig">
    <div><div class="sig-line"></div>Class Teacher</div>
    <div style="text-align:center"><div class="sig-line"></div>Parent / Guardian</div>
    <div style="text-align:right"><div class="sig-line"></div>Principal</div>
  </div>
  <div class="footer">This is a computer-generated report card. — ${esc(inst?.name ?? '')}</div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=740,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Print: Admit Card ─────────────────────────────────────────────────────────

function printAdmitCard(ac: AdmitCard) {
  const inst = ac.institution;
  const studentName = `${ac.student.firstName} ${ac.student.lastName}`;
  const className = ac.student.academicUnit?.displayName || ac.student.academicUnit?.name || '—';
  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const subjectRows = ac.subjects.map((s) => `
    <tr>
      <td>${esc(s.subjectName)}</td>
      <td class="c">${s.examDate ? new Date(s.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
      <td class="c">${esc(s.examTime ?? '—')}</td>
      <td class="c">${s.maxMarks}</td>
      <td class="c">${s.passingMarks}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Admit Card — ${esc(studentName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#f1f5f9;padding:28px}
  .card{max-width:660px;margin:0 auto;background:#fff;border:2px solid #0f172a;border-radius:8px;overflow:hidden}
  .letterhead{background:#0f172a;color:#fff;padding:18px 24px;text-align:center}
  .letterhead h1{font-size:17px;font-weight:700;letter-spacing:.5px;margin-bottom:3px}
  .letterhead .sub{font-size:11px;opacity:.65;line-height:1.5}
  .title-bar{background:#fef9c3;border-bottom:1px solid #fde047;border-top:1px solid #fde047;padding:8px 20px;text-align:center;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#713f12}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0}
  .info-cell{padding:9px 20px;border-right:1px solid #e2e8f0;font-size:12px}
  .info-cell:nth-child(even){border-right:none}
  .info-label{color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
  .info-value{font-weight:600;color:#0f172a}
  .info-cell.full{grid-column:1/-1;border-right:none}
  table{width:100%;border-collapse:collapse}
  th{background:#f8fafc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;padding:8px 12px;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0}
  td{padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155}
  td.c{text-align:center}
  .instructions{background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 20px;font-size:11px;color:#475569}
  .instructions ul{list-style:disc;padding-left:16px;line-height:1.8}
  .sig{display:flex;justify-content:space-between;padding:16px 32px 8px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b}
  .sig-line{border-top:1px solid #94a3b8;width:140px;margin-bottom:4px}
  .footer{text-align:center;font-size:10px;color:#94a3b8;padding:10px;border-top:1px solid #f1f5f9}
  @media print{body{background:#fff;padding:0}.card{border-radius:0};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div class="card">
  <div class="letterhead">
    <h1>${esc(inst?.name ?? '—')}</h1>
    <div class="sub">${esc([inst?.board, inst?.address].filter(Boolean).join(' · '))}</div>
  </div>
  <div class="title-bar">Admit Card — ${esc(ac.exam.name)} (${esc(ac.exam.academicYear)})</div>
  <div class="info-grid">
    <div class="info-cell"><div class="info-label">Student Name</div><div class="info-value">${esc(studentName)}</div></div>
    <div class="info-cell"><div class="info-label">Admission No</div><div class="info-value">${esc(ac.student.admissionNo)}</div></div>
    <div class="info-cell"><div class="info-label">Class / Section</div><div class="info-value">${esc(className)}</div></div>
    ${ac.student.rollNo ? `<div class="info-cell"><div class="info-label">Roll No</div><div class="info-value">${esc(ac.student.rollNo)}</div></div>` : ''}
    ${ac.exam.examCenter ? `<div class="info-cell full"><div class="info-label">Exam Center</div><div class="info-value">${esc(ac.exam.examCenter)}</div></div>` : ''}
    ${ac.exam.reportingTime ? `<div class="info-cell full"><div class="info-label">Reporting Time</div><div class="info-value">${esc(ac.exam.reportingTime)}</div></div>` : ''}
  </div>
  <table>
    <thead><tr><th style="text-align:left">Subject</th><th class="c">Date</th><th class="c">Time</th><th class="c">Max Marks</th><th class="c">Passing Marks</th></tr></thead>
    <tbody>${subjectRows}</tbody>
  </table>
  <div class="instructions">
    <strong style="display:block;margin-bottom:6px">Instructions:</strong>
    <ul>
      <li>Bring this admit card to the examination hall. Entry will not be permitted without it.</li>
      <li>Arrive at the exam center at the reporting time mentioned above.</li>
      <li>No electronic devices or unfair materials are allowed inside the hall.</li>
      <li>Verify your name, class, and subjects before the examination.</li>
    </ul>
  </div>
  <div class="sig">
    <div><div class="sig-line"></div>Student Signature</div>
    <div style="text-align:right"><div class="sig-line"></div>Principal / Exam Controller</div>
  </div>
  <div class="footer">${esc(inst?.name ?? '')} · This admit card is issued for ${esc(ac.exam.name)} · ${esc(ac.exam.academicYear)}</div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=720,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-green-700', A: 'text-green-600', B: 'text-blue-600',
  C: 'text-amber-600', D: 'text-orange-600', F: 'text-red-600',
};

export default function ParentExamsPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loadingScorecard, setLoadingScorecard] = useState(false);
  const [admitCard, setAdmitCard] = useState<AdmitCard | null>(null);
  const [loadingAdmitCard, setLoadingAdmitCard] = useState<string | null>(null); // examId being loaded

  useEffect(() => {
    Promise.all([apiFetch('/students/child'), apiFetch('/academic/years')])
      .then(([kids, ys]) => {
        const children = Array.isArray(kids) ? (kids as Child[]) : [];
        setChildren(children);
        if (children.length === 0) { setNotLinked(true); return; }
        setSelectedChildId(children[0].id);
        setYears(ys);
        const cur: AcademicYear = ys.find((y: AcademicYear) => y.isCurrent) ?? ys[0];
        if (cur) setSelectedYearId(cur.id);
      })
      .catch(() => setNotLinked(true));
  }, []);

  useEffect(() => {
    if (!selectedYearId) return;
    setSelectedExamId('');
    setScorecard(null);
    apiFetch(`/exams?yearId=${selectedYearId}`)
      .then((e: Exam[]) => setExams(e))
      .catch(() => setExams([]));
  }, [selectedYearId]);

  useEffect(() => {
    if (!selectedExamId || !selectedChildId) { setScorecard(null); return; }
    setLoadingScorecard(true);
    apiFetch(`/exams/${selectedExamId}/scorecard/${selectedChildId}`)
      .then((s) => setScorecard(s as Scorecard))
      .catch(() => setScorecard(null))
      .finally(() => setLoadingScorecard(false));
  }, [selectedExamId, selectedChildId]);

  const fetchAndPrintAdmitCard = async (examId: string) => {
    if (!selectedChildId) return;
    setLoadingAdmitCard(examId);
    try {
      const ac = await apiFetch(`/exams/${examId}/admit-card/${selectedChildId}`) as AdmitCard;
      setAdmitCard(ac);
      printAdmitCard(ac);
    } catch {
      // ignore — no subjects may be configured yet
    } finally {
      setLoadingAdmitCard(null);
    }
  };

  if (notLinked) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          Your child's record has not been linked yet. Please contact the school admin.
        </div>
      </div>
    );
  }

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const completedExams = exams.filter((e) => e.status === 'completed');
  const activeExams = exams.filter((e) => e.status === 'active');
  const upcomingExams = exams.filter((e) => e.status === 'draft');

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Exam Schedule & Results</h1>
      <p className="text-sm text-gray-400 mb-6">View exams and your child's scorecards</p>

      {/* Child + Year selectors */}
      <div className="flex flex-wrap gap-4 mb-6">
        {children.length > 1 && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Child</label>
            <select
              value={selectedChildId}
              onChange={(e) => { setSelectedChildId(e.target.value); setScorecard(null); }}
              className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Academic Year</label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
          >
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
      </div>

      {/* Exam status overview */}
      {exams.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-blue-700">{activeExams.length}</p>
            <p className="text-sm text-blue-700 font-medium mt-1">In Progress</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-700">{completedExams.length}</p>
            <p className="text-sm text-green-700 font-medium mt-1">Completed</p>
          </div>
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-700">{upcomingExams.length}</p>
            <p className="text-sm text-gray-600 font-medium mt-1">Upcoming</p>
          </div>
        </div>
      )}

      {/* All exams list */}
      {exams.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">All Examinations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click a completed exam to view {selectedChild?.firstName}'s scorecard
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {exams.map((e) => (
              <div
                key={e.id}
                className={`px-5 py-3 flex items-center justify-between ${selectedExamId === e.id ? 'bg-blue-50' : ''}`}
              >
                <p className="text-sm font-medium text-gray-800">{e.name}</p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[e.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {e.status === 'active' ? 'In Progress' : e.status === 'completed' ? 'Completed' : 'Upcoming'}
                  </span>
                  {/* Admit Card — available for upcoming and active exams */}
                  {(e.status === 'draft' || e.status === 'active') && (
                    <button
                      onClick={() => fetchAndPrintAdmitCard(e.id)}
                      disabled={loadingAdmitCard === e.id}
                      className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50"
                    >
                      {loadingAdmitCard === e.id ? '…' : 'Admit Card'}
                    </button>
                  )}
                  {e.status === 'completed' && (
                    <button
                      onClick={() => setSelectedExamId(selectedExamId === e.id ? '' : e.id)}
                      className="text-xs text-indigo-600 font-medium hover:underline"
                    >
                      {selectedExamId === e.id ? 'Hide results ↑' : 'View results →'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {exams.length === 0 && selectedYearId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-400 text-sm">No examinations scheduled for this academic year.</p>
        </div>
      )}

      {/* Scorecard */}
      {selectedExamId && (
        loadingScorecard ? (
          <p className="text-sm text-gray-400">Loading scorecard...</p>
        ) : !scorecard ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">No marks recorded yet for {selectedChild?.firstName} in {selectedExam?.name}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-black text-white px-5 py-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-gray-400">{selectedExam?.name}</p>
                <button
                  onClick={() => scorecard && printReportCard(scorecard)}
                  className="text-xs bg-white text-black px-3 py-1 rounded-lg font-semibold hover:bg-gray-100"
                >
                  Print Report Card
                </button>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-xl font-bold">{scorecard.totalObtained} / {scorecard.totalMax}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Percentage</p>
                  <p className="text-xl font-bold">{scorecard.percentage?.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Class Rank</p>
                  <p className="text-xl font-bold">#{scorecard.rank ?? '—'}</p>
                </div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs">Subject</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Marks</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Max</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">%</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium text-xs">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scorecard.rows.map((r, i) => {
                  const isAbsent = r.marksObtained === 'AB';
                  const pct = !isAbsent && r.maxMarks > 0 && typeof r.marksObtained === 'number'
                    ? ((r.marksObtained / r.maxMarks) * 100).toFixed(0) + '%'
                    : '—';
                  return (
                    <tr key={i}>
                      <td className="px-5 py-3 text-gray-800 font-medium">{r.subject}</td>
                      <td className="px-5 py-3 text-center text-gray-700">
                        {isAbsent ? <span className="text-xs text-gray-400">Absent</span> : (r.marksObtained ?? '—')}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500">{r.maxMarks}</td>
                      <td className="px-5 py-3 text-center text-gray-600">{pct}</td>
                      <td className="px-5 py-3 text-center">
                        {isAbsent
                          ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Absent</span>
                          : r.passed
                            ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Pass</span>
                            : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Fail</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
