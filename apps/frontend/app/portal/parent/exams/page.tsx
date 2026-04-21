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
  const studentName = `${ac.student.firstName} ${ac.student.lastName}`.toUpperCase();
  const className = ac.student.academicUnit?.displayName || ac.student.academicUnit?.name || '—';
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDay = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'short' }) : '—';
  const fmtDob = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const subjectRows = ac.subjects.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="text-align:center;font-weight:600;color:#374151">${i + 1}</td>
      <td style="font-weight:500">${esc(s.subjectName)}</td>
      <td style="text-align:center">${fmtDate(s.examDate)}</td>
      <td style="text-align:center;color:#6b7280">${fmtDay(s.examDate)}</td>
      <td style="text-align:center;font-weight:600;color:#1d4ed8">${esc(s.examTime ?? '—')}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<title>Hall Ticket — ${esc(studentName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Times New Roman',Times,serif;font-size:12px;color:#111;background:#e5e7eb;padding:24px}
  .card{max-width:680px;margin:0 auto;background:#fff;border:2px solid #1e3a5f;padding:0;page-break-inside:avoid}
  /* Header */
  .header{display:flex;align-items:center;gap:16px;padding:14px 20px 12px;border-bottom:3px double #1e3a5f}
  .header-logo{width:56px;height:56px;border:2px solid #1e3a5f;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#1e3a5f;flex-shrink:0;border-radius:4px;font-family:Arial,sans-serif}
  .header-text{flex:1;text-align:center}
  .school-name{font-size:18px;font-weight:700;color:#1e3a5f;letter-spacing:.3px;line-height:1.2}
  .school-sub{font-size:10.5px;color:#374151;margin-top:2px;line-height:1.4}
  /* Title */
  .title-section{background:#1e3a5f;color:#fff;text-align:center;padding:7px 16px}
  .title-main{font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
  .title-exam{font-size:11px;letter-spacing:.8px;opacity:.85;margin-top:2px}
  /* Student info */
  .student-section{display:flex;gap:0;border-bottom:1px solid #d1d5db}
  .student-details{flex:1;padding:12px 16px}
  .photo-box{width:90px;border-left:1px solid #d1d5db;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 6px;flex-shrink:0}
  .photo-inner{width:72px;height:86px;border:1px dashed #9ca3af;display:flex;align-items:center;justify-content:center;font-size:9px;color:#9ca3af;text-align:center;line-height:1.4}
  .photo-label{font-size:8.5px;color:#6b7280;margin-top:4px;text-align:center}
  /* Info rows in 2-col */
  .info-table{width:100%;border-collapse:collapse}
  .info-table td{padding:3px 0;font-size:11.5px;vertical-align:top}
  .info-label{color:#6b7280;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;width:110px;padding-right:6px;white-space:nowrap}
  .info-colon{width:10px;color:#374151}
  .info-value{font-weight:700;color:#111;font-size:12px}
  /* Important notice */
  .notice{background:#fef3c7;border:1px solid #f59e0b;border-left:4px solid #d97706;margin:0 16px 12px;padding:6px 10px;font-size:10.5px;color:#92400e;font-weight:600}
  /* Schedule table */
  .schedule-wrap{border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db}
  .schedule-title{background:#f3f4f6;padding:6px 16px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#374151;border-bottom:1px solid #d1d5db}
  .sched-table{width:100%;border-collapse:collapse}
  .sched-table th{background:#1e3a5f;color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:6px 10px;text-align:center}
  .sched-table th:first-child{text-align:center;width:36px}
  .sched-table th.left{text-align:left}
  .sched-table td{padding:7px 10px;font-size:11.5px;border-bottom:1px solid #e5e7eb;color:#111}
  /* Instructions */
  .instructions{padding:10px 16px;font-size:10.5px;color:#374151}
  .instructions-title{font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1e3a5f;margin-bottom:5px;font-size:10px}
  .instructions ol{padding-left:16px;line-height:1.8}
  .instructions li{margin-bottom:1px}
  /* Signatures */
  .sig-section{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid #d1d5db;padding:12px 20px 8px;gap:12px}
  .sig-block{text-align:center}
  .sig-line{border-top:1px solid #374151;margin-bottom:4px;width:100%}
  .sig-name{font-size:9.5px;color:#374151;font-weight:600}
  /* Footer */
  .footer{background:#f3f4f6;border-top:1px solid #d1d5db;padding:5px 16px;display:flex;justify-content:space-between;font-size:9px;color:#6b7280}
  /* Stamp box */
  .stamp-area{position:absolute;right:16px;bottom:60px;width:68px;height:68px;border:1px dashed #9ca3af;display:flex;align-items:center;justify-content:center;font-size:8.5px;color:#9ca3af;text-align:center;line-height:1.4}
  @media print{
    body{background:#fff;padding:0}
    .card{border:2px solid #000;max-width:100%}
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }
</style></head><body>
<div class="card">

  <!-- Header -->
  <div class="header">
    <div class="header-logo">${esc((inst?.name ?? 'S')[0].toUpperCase())}</div>
    <div class="header-text">
      <div class="school-name">${esc(inst?.name ?? 'School Name')}</div>
      <div class="school-sub">
        ${inst?.board ? `Affiliated to ${esc(inst.board)}` : ''}
        ${inst?.address ? (inst?.board ? ' &nbsp;|&nbsp; ' : '') + esc(inst.address) : ''}
        ${inst?.phone ? ' &nbsp;|&nbsp; ' + esc(inst.phone) : ''}
      </div>
    </div>
  </div>

  <!-- Title -->
  <div class="title-section">
    <div class="title-main">Hall Ticket / Admit Card</div>
    <div class="title-exam">${esc(ac.exam.name)} &nbsp;&bull;&nbsp; Academic Year ${esc(ac.exam.academicYear)}</div>
  </div>

  <!-- Student Details + Photo -->
  <div class="student-section">
    <div class="student-details">
      <table class="info-table">
        <tbody>
          <tr>
            <td class="info-label">Student Name</td>
            <td class="info-colon">:</td>
            <td class="info-value" style="font-size:13px">${esc(studentName)}</td>
          </tr>
          <tr>
            <td class="info-label">Class / Section</td>
            <td class="info-colon">:</td>
            <td class="info-value">${esc(className)}</td>
          </tr>
          <tr>
            <td class="info-label">Roll No.</td>
            <td class="info-colon">:</td>
            <td class="info-value">${esc(ac.student.rollNo ?? '—')}</td>
          </tr>
          <tr>
            <td class="info-label">Admission No.</td>
            <td class="info-colon">:</td>
            <td class="info-value">${esc(ac.student.admissionNo)}</td>
          </tr>
          ${ac.student.dateOfBirth ? `<tr>
            <td class="info-label">Date of Birth</td>
            <td class="info-colon">:</td>
            <td class="info-value">${fmtDob(ac.student.dateOfBirth)}</td>
          </tr>` : ''}
          ${ac.exam.examCenter ? `<tr>
            <td class="info-label">Exam Centre</td>
            <td class="info-colon">:</td>
            <td class="info-value">${esc(ac.exam.examCenter)}</td>
          </tr>` : ''}
          ${ac.exam.reportingTime ? `<tr>
            <td class="info-label">Reporting Time</td>
            <td class="info-colon">:</td>
            <td class="info-value" style="color:#1d4ed8">${esc(ac.exam.reportingTime)}</td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>
    <div class="photo-box">
      <div class="photo-inner">Affix<br/>Photograph<br/>&amp;<br/>Sign across</div>
      <div class="photo-label">Sign &amp; Stamp</div>
    </div>
  </div>

  <!-- Notice -->
  <div style="padding:10px 16px 0">
    <div class="notice">
      &#9888;&nbsp; This Hall Ticket must be produced at the examination hall. Entry will not be permitted without it. It must bear the signature and stamp of the Principal.
    </div>
  </div>

  <!-- Exam Schedule -->
  <div class="schedule-wrap" style="margin:10px 0 0">
    <div class="schedule-title">Examination Schedule</div>
    <table class="sched-table">
      <thead>
        <tr>
          <th>S.No</th>
          <th class="left">Subject</th>
          <th>Date</th>
          <th>Day</th>
          <th>Timing</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows || `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:12px">No exam schedule published yet</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Instructions -->
  <div class="instructions">
    <div class="instructions-title">Important Instructions</div>
    <ol>
      <li>Candidates must carry this Hall Ticket to every examination session. No candidate will be admitted without it.</li>
      <li>Be seated in the examination hall <strong>15 minutes</strong> before the scheduled time.</li>
      <li>Mobile phones, smartwatches, Bluetooth devices and electronic gadgets are strictly prohibited.</li>
      <li>Unfair means will lead to immediate cancellation of the examination.</li>
      <li>Verify your name, class, roll number, and subjects carefully. Report any discrepancy immediately.</li>
      <li>This card is valid only with the signature and official seal of the Principal/Exam Controller.</li>
    </ol>
  </div>

  <!-- Signatures -->
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Student's Signature</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Parent / Guardian</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Principal / Controller of Examinations</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>${esc(inst?.name ?? '')} &nbsp;&bull;&nbsp; ${esc(ac.exam.name)} &nbsp;&bull;&nbsp; Academic Year ${esc(ac.exam.academicYear)}</span>
    <span>Date of Issue: ${issueDate}</span>
  </div>

</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=760,height=960');
  if (w) { w.document.write(html); w.document.close(); }
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-ds-bg2 text-ds-text2',
  active: 'bg-ds-info-bg text-ds-info-text',
  completed: 'bg-ds-success-bg text-ds-success-text',
};

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-ds-success-text', A: 'text-ds-success-text', B: 'text-ds-brand',
  C: 'text-ds-warning-text', D: 'text-orange-600', F: 'text-ds-error-text',
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
      <div className="p-4 sm:p-6">
        <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5 text-sm text-ds-warning-text">
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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Exam Schedule & Results</h1>
      <p className="text-sm text-ds-text3 mb-6">View exams and your child's scorecards</p>

      {/* Child + Year selectors */}
      <div className="flex flex-wrap gap-4 mb-6">
        {children.length > 1 && (
          <div>
            <label className="text-xs font-medium text-ds-text2 block mb-1">Child</label>
            <select
              value={selectedChildId}
              onChange={(e) => { setSelectedChildId(e.target.value); setScorecard(null); }}
              className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand"
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
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="border border-ds-border-strong rounded-lg p-2 text-sm bg-ds-surface focus:outline-none focus:ring-2 focus:ring-ds-brand"
          >
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>
      </div>

      {/* Exam status overview */}
      {exams.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-ds-info-bg border border-ds-info-border rounded-xl p-4">
            <p className="text-2xl font-bold text-ds-info-text">{activeExams.length}</p>
            <p className="text-sm text-ds-info-text font-medium mt-1">In Progress</p>
          </div>
          <div className="bg-ds-success-bg border border-ds-success-border rounded-xl p-4">
            <p className="text-2xl font-bold text-ds-success-text">{completedExams.length}</p>
            <p className="text-sm text-ds-success-text font-medium mt-1">Completed</p>
          </div>
          <div className="bg-ds-surface border border-ds-border shadow-sm rounded-xl p-4">
            <p className="text-2xl font-bold text-ds-text1">{upcomingExams.length}</p>
            <p className="text-sm text-ds-text2 font-medium mt-1">Upcoming</p>
          </div>
        </div>
      )}

      {/* All exams list */}
      {exams.length > 0 && (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-ds-border">
            <h2 className="font-semibold text-ds-text1 text-sm">All Examinations</h2>
            <p className="text-xs text-ds-text3 mt-0.5">
              Click a completed exam to view {selectedChild?.firstName}'s scorecard
            </p>
          </div>
          <div className="divide-y divide-ds-border">
            {exams.map((e) => (
              <div
                key={e.id}
                className={`px-5 py-3 flex items-center justify-between ${selectedExamId === e.id ? 'bg-blue-50' : ''}`}
              >
                <p className="text-sm font-medium text-ds-text1">{e.name}</p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[e.status] ?? 'bg-ds-bg2 text-ds-text2'}`}>
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
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-10 text-center">
          <p className="text-ds-text3 text-sm">No examinations scheduled for this academic year.</p>
        </div>
      )}

      {/* Scorecard */}
      {selectedExamId && (
        loadingScorecard ? (
          <p className="text-sm text-ds-text3">Loading scorecard...</p>
        ) : !scorecard ? (
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-8 text-center">
            <p className="text-ds-text3 text-sm">No marks recorded yet for {selectedChild?.firstName} in {selectedExam?.name}.</p>
          </div>
        ) : (
          <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-ds-text3">{selectedExam?.name}</p>
                <button
                  onClick={() => scorecard && printReportCard(scorecard)}
                  className="text-xs bg-ds-surface text-ds-text1 px-3 py-1 rounded-lg font-semibold hover:bg-ds-bg2"
                >
                  Print Report Card
                </button>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-ds-text3">Total</p>
                  <p className="text-xl font-bold">{scorecard.totalObtained} / {scorecard.totalMax}</p>
                </div>
                <div>
                  <p className="text-xs text-ds-text3">Percentage</p>
                  <p className="text-xl font-bold">{scorecard.percentage?.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-ds-text3">Class Rank</p>
                  <p className="text-xl font-bold">#{scorecard.rank ?? '—'}</p>
                </div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-ds-bg2">
                <tr>
                  <th className="text-left px-5 py-3 text-ds-text2 font-medium text-xs">Subject</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Marks</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Max</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">%</th>
                  <th className="text-center px-5 py-3 text-ds-text2 font-medium text-xs">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {scorecard.rows.map((r, i) => {
                  const isAbsent = r.marksObtained === 'AB';
                  const pct = !isAbsent && r.maxMarks > 0 && typeof r.marksObtained === 'number'
                    ? ((r.marksObtained / r.maxMarks) * 100).toFixed(0) + '%'
                    : '—';
                  return (
                    <tr key={i}>
                      <td className="px-5 py-3 text-ds-text1 font-medium">{r.subject}</td>
                      <td className="px-5 py-3 text-center text-ds-text1">
                        {isAbsent ? <span className="text-xs text-ds-text3">Absent</span> : (r.marksObtained ?? '—')}
                      </td>
                      <td className="px-5 py-3 text-center text-ds-text2">{r.maxMarks}</td>
                      <td className="px-5 py-3 text-center text-ds-text2">{pct}</td>
                      <td className="px-5 py-3 text-center">
                        {isAbsent
                          ? <span className="text-xs bg-ds-bg2 text-ds-text2 px-2 py-0.5 rounded-full">Absent</span>
                          : r.passed
                            ? <span className="text-xs bg-ds-success-bg text-ds-success-text px-2 py-0.5 rounded-full">Pass</span>
                            : <span className="text-xs bg-ds-error-bg text-ds-error-text px-2 py-0.5 rounded-full">Fail</span>}
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
