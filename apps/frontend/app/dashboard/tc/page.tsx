'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TC {
  id: string;
  status: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  dateOfBirth?: string;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  bloodGroup?: string;
  classLastStudied: string;
  admissionDate?: string;
  academicYearName?: string;
  // Academic snapshot
  subjectsStudied?: string;
  lastExamName?: string;
  lastExamResult?: string;
  promotionEligible?: string;
  // Fee snapshot
  feesPaidUpToMonth?: string;
  conductGrade: string;
  reason?: string;
  tcNumber?: string;
  workingDays?: number;
  presentDays?: number;
  hasDues: boolean;
  duesRemark?: string;
  rejectionRemark?: string;
  requestedAt: string;
  approvedAt?: string;
  issuedAt?: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    academicUnit?: { displayName?: string; name?: string };
  };
  institution?: {
    name: string;
    code: string;
    board?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    stampUrl?: string;
    signatureUrl?: string;
    affiliationNo?: string;
    principalName?: string;
    udiseCode?: string;
    gstin?: string;
  };
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved:         'Approved',
  rejected:         'Rejected',
  issued:           'Issued',
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-ds-warning-bg text-ds-warning-text',
  approved:         'bg-ds-info-bg text-ds-info-text',
  rejected:         'bg-ds-error-bg text-ds-error-text',
  issued:           'bg-ds-success-bg text-ds-success-text',
};

const TABS = ['all', 'pending_approval', 'approved', 'rejected', 'issued'] as const;
const TAB_LABELS: Record<string, string> = {
  all: 'All', pending_approval: 'Pending', approved: 'Approved',
  rejected: 'Rejected', issued: 'Issued',
};

// ── TC Document — Government-approved format ─────────────────────────────────

function TcDocument({ tc }: { tc: TC }) {
  const institution = tc.institution;

  // Short date: "15 April 2020"
  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  // Field 6: "DD/MM/YYYY  (DD Month YYYY)" — figures & words
  const dobFiguresAndWords = (d?: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    const dd   = String(date.getDate()).padStart(2, '0');
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const words = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${dd}/${mm}/${yyyy}   (${words})`;
  };

  // Field 5: admission date + class (best approximation — class at admission not separately tracked)
  const admissionWithClass = tc.admissionDate
    ? `${fmt(tc.admissionDate)} — ${tc.classLastStudied}`
    : '—';

  // Fields 12-13: attendance
  const attendanceLine =
    tc.workingDays != null ? String(tc.workingDays) : '—';
  const presentLine =
    tc.presentDays != null ? String(tc.presentDays) : '—';

  // Fields 8: exam + result
  const examLine = tc.lastExamName
    ? `${tc.lastExamName} — ${tc.lastExamResult ?? 'N/A'}`
    : '—';

  const rows: [string, string, string][] = [
    ['1.',  'Name of Pupil',                                             tc.studentName],
    ['2.',  "Mother's Name",                                             tc.motherName    ?? '—'],
    ['3.',  "Father's / Guardian's Name",                               tc.fatherName    ?? '—'],
    ['4.',  'Nationality',                                               tc.nationality   ?? '—'],
    ['5.',  'Religion',                                                  tc.religion      ?? '—'],
    ['6.',  'Caste / Category',                                          tc.casteCategory ?? '—'],
    ['7.',  'Gender',                                                    tc.gender        ?? '—'],
    ['8.',  'Blood Group',                                               tc.bloodGroup    ?? '—'],
    ['9.',  'Date of first admission in the school with class',          admissionWithClass],
    ['10.', 'Date of Birth (in figures & words)',                        dobFiguresAndWords(tc.dateOfBirth)],
    ['11.', 'Class in which the pupil last studied',                     tc.classLastStudied],
    ['12.', 'School/Board Annual Examination last taken with result',    examLine],
    ['13.', 'Subjects Studied',                                          tc.subjectsStudied ?? '—'],
    ['14.', 'Whether qualified for promotion to higher class',           tc.promotionEligible ?? '—'],
    ['15.', 'Month up to which the student has paid fees',               tc.feesPaidUpToMonth ?? '—'],
    ['16.', 'Total No. of working days in the session',                  attendanceLine],
    ['17.', 'Total No. of working days present',                         presentLine],
    ['18.', 'General conduct',                                           tc.conductGrade],
    ['19.', 'Date of application for certificate',                       fmt(tc.requestedAt)],
    ['20.', 'Date of issue of certificate',                              fmt(tc.issuedAt)],
    ['21.', 'Reasons for leaving the school',                            tc.reason ?? '—'],
  ];

  return (
    <div
      id="tc-print-area"
      className="bg-ds-surface text-ds-text1"
      style={{ fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.7 }}
    >
      {/* School letterhead */}
      <div className="border-b-2 border-gray-800 pb-4 mb-5" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {institution?.logoUrl && (
          <img src={institution.logoUrl} alt="Logo" style={{ width: 60, height: 60, objectFit: 'contain', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p className="text-2xl font-bold uppercase tracking-wide">{institution?.name ?? '—'}</p>
          {institution?.board && (
            <p className="text-sm text-ds-text2 mt-0.5">Affiliated to {institution.board}{institution.affiliationNo ? ` · Affil No: ${institution.affiliationNo}` : ''}</p>
          )}
          {institution?.address && (
            <p className="text-xs text-ds-text2 mt-0.5">{institution.address}</p>
          )}
          <div className="flex justify-center gap-6 text-xs text-ds-text2 mt-1">
            {institution?.phone && <span>Ph: {institution.phone}</span>}
            {institution?.email && <span>Email: {institution.email}</span>}
            {institution?.website && <span>{institution.website}</span>}
            {institution?.udiseCode && <span>UDISE: {institution.udiseCode}</span>}
          </div>
        </div>
        {institution?.stampUrl && (
          <img src={institution.stampUrl} alt="Stamp" style={{ width: 60, height: 60, objectFit: 'contain', opacity: 0.8, flexShrink: 0 }} />
        )}
      </div>

      {/* Certificate title */}
      <h1
        className="text-center font-bold uppercase mb-5"
        style={{ fontSize: 15, letterSpacing: '0.18em', textDecoration: 'underline' }}
      >
        Transfer Certificate
      </h1>

      {/* TC No + Admission No header row */}
      <div className="flex justify-between text-sm mb-4 font-medium">
        <span>TC No: &nbsp;<span className="font-bold">{tc.tcNumber ?? '____________'}</span></span>
        <span>Admission No: &nbsp;<span className="font-bold">{tc.admissionNo}</span></span>
      </div>

      {/* Numbered fields — government format */}
      <table className="w-full text-sm border-collapse mb-8" style={{ borderTop: '1px solid #d1d5db' }}>
        <tbody>
          {rows.map(([no, label, value]) => (
            <tr key={no} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td className="py-2 pr-2 align-top text-ds-text2" style={{ width: 28, whiteSpace: 'nowrap' }}>{no}</td>
              <td className="py-2 pr-6 align-top font-medium text-ds-text1" style={{ width: 290 }}>{label}</td>
              <td className="py-2 align-top text-ds-text1">: &nbsp;{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signature lines */}
      <div className="flex justify-between mt-12 pt-2 items-end">
        <div className="text-center text-xs text-ds-text2">
          <div style={{ borderTop: '1px solid #6b7280', width: 160, marginBottom: 4 }} />
          Signature of Class Teacher
        </div>
        <div className="text-center text-xs text-ds-text2">
          {institution?.signatureUrl && (
            <img src={institution.signatureUrl} alt="Signature" style={{ maxHeight: 44, maxWidth: 140, objectFit: 'contain', marginBottom: 2 }} />
          )}
          <div style={{ borderTop: '1px solid #6b7280', width: 200, marginBottom: 4 }} />
          {institution?.principalName ? institution.principalName : 'Principal'} — Sign &amp; Seal
        </div>
      </div>

      <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 28 }}>
        Certified that the above information is correct as per the school records. — {institution?.name}{institution?.gstin ? `  ·  GSTIN: ${institution.gstin}` : ''}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TcPage() {
  const router = useRouter();
  const [list, setList]             = useState<TC[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<string>('all');
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [rejectBusy, setRejectBusy]     = useState(false);

  // Print / view modal
  const [printTc, setPrintTc]       = useState<TC | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const load = async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = status && status !== 'all' ? `?status=${status}` : '';
      const data = await apiFetch(`/tc${params}`);
      setList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(tab); }, [tab]);

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/tc/${id}/approve`, { method: 'PATCH', body: '{}' });
      showSuccess('TC approved');
      void load(tab);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectRemark.trim()) return;
    setRejectBusy(true);
    try {
      await apiFetch(`/tc/${rejectTarget}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ remark: rejectRemark }),
      });
      setRejectTarget(null);
      setRejectRemark('');
      showSuccess('TC rejected');
      void load(tab);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to reject');
    } finally {
      setRejectBusy(false);
    }
  };

  const handleIssue = async (id: string) => {
    try {
      const issued = await apiFetch(`/tc/${id}/issue`, { method: 'POST', body: '{}' }) as TC;
      showSuccess(`TC issued — ${issued.tcNumber}`);
      // Show the TC document immediately
      const full = await apiFetch(`/tc/${id}`) as TC;
      setPrintTc(full);
      void load(tab);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to issue');
    }
  };

  const openPrint = async (id: string) => {
    setPrintLoading(true);
    try {
      const full = await apiFetch(`/tc/${id}`) as TC;
      setPrintTc(full);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load TC');
    } finally {
      setPrintLoading(false);
    }
  };

  const doPrint = () => {
    if (!printTc) return;
    const tc = printTc;
    const inst = tc.institution;

    function esc(s?: string | null) {
      if (!s) return '';
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function fmt(d?: string | null) {
      return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    }
    function dobFmt(d?: string | null) {
      if (!d) return '—';
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}   (${dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })})`;
    }
    const admissionWithClass = tc.admissionDate ? `${fmt(tc.admissionDate)} — ${tc.classLastStudied}` : '—';
    const examLine = tc.lastExamName ? `${tc.lastExamName} — ${tc.lastExamResult ?? 'N/A'}` : '—';
    const rows: [string, string][] = [
      ['1.  Name of Pupil', tc.studentName],
      ["2.  Mother's Name", tc.motherName ?? '—'],
      ["3.  Father's / Guardian's Name", tc.fatherName ?? '—'],
      ['4.  Nationality', tc.nationality ?? '—'],
      ['5.  Religion', tc.religion ?? '—'],
      ['6.  Caste / Category', tc.casteCategory ?? '—'],
      ['7.  Gender', tc.gender ?? '—'],
      ['8.  Blood Group', tc.bloodGroup ?? '—'],
      ['9.  Date of first admission in the school with class', admissionWithClass],
      ['10. Date of Birth (in figures & words)', dobFmt(tc.dateOfBirth)],
      ['11. Class in which the pupil last studied', tc.classLastStudied],
      ['12. School/Board Annual Examination last taken with result', examLine],
      ['13. Subjects Studied', tc.subjectsStudied ?? '—'],
      ['14. Whether qualified for promotion to higher class', tc.promotionEligible ?? '—'],
      ['15. Month up to which the student has paid fees', tc.feesPaidUpToMonth ?? '—'],
      ['16. Total No. of working days in the session', tc.workingDays != null ? String(tc.workingDays) : '—'],
      ['17. Total No. of working days present', tc.presentDays != null ? String(tc.presentDays) : '—'],
      ['18. General conduct', tc.conductGrade],
      ['19. Date of application for certificate', fmt(tc.requestedAt)],
      ['20. Date of issue of certificate', fmt(tc.issuedAt)],
      ['21. Reasons for leaving the school', tc.reason ?? '—'],
    ];
    const rowsHtml = rows.map(([label, value]) =>
      `<tr><td class="label-col">${esc(label)}</td><td>:&nbsp;&nbsp;${esc(value)}</td></tr>`
    ).join('');
    const subLine = [inst?.board ? `Affiliated to ${esc(inst.board)}` : '', inst?.affiliationNo ? `Affil No: ${esc(inst.affiliationNo)}` : '', inst?.udiseCode ? `UDISE: ${esc(inst.udiseCode)}` : ''].filter(Boolean).join('  ·  ');
    const contactLine = [inst?.address ? esc(inst.address) : '', inst?.phone ? `Ph: ${esc(inst.phone)}` : '', inst?.email ? `Email: ${esc(inst.email)}` : '', inst?.website ? esc(inst.website) : ''].filter(Boolean).join('  ·  ');

    const html = `<!DOCTYPE html><html><head><title>Transfer Certificate — ${esc(tc.tcNumber ?? tc.admissionNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,serif;font-size:13px;color:#111;margin:40px;line-height:1.7}
  .letterhead{display:flex;align-items:center;gap:16px;border-bottom:2px solid #333;padding-bottom:14px;margin-bottom:20px}
  .lh-logo{width:62px;height:62px;object-fit:contain;flex-shrink:0}
  .lh-center{flex:1;text-align:center}
  .lh-center h2{font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .lh-center .sub{font-size:11px;color:#4b5563;line-height:1.7}
  .lh-stamp{width:62px;height:62px;object-fit:contain;flex-shrink:0;opacity:.8}
  h1{text-align:center;font-size:15px;text-transform:uppercase;letter-spacing:.18em;text-decoration:underline;margin-bottom:20px}
  .meta{display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-bottom:36px;border-top:1px solid #d1d5db}
  td{padding:7px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:12.5px}
  .label-col{width:320px;color:#374151;font-weight:500}
  .sig-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px}
  .sig-block{text-align:center;font-size:11px;color:#6b7280}
  .sig-block img{display:block;max-height:44px;max-width:140px;object-fit:contain;margin:0 auto 3px}
  .sig-line{border-top:1px solid #6b7280;width:180px;margin:0 auto 4px}
  .footnote{font-size:10px;color:#9ca3af;text-align:center;margin-top:28px}
  @media print{body{margin:20px}@page{margin:18mm}}
</style></head><body>
  <div class="letterhead">
    ${inst?.logoUrl ? `<img class="lh-logo" src="${esc(inst.logoUrl)}" alt="Logo" />` : '<div style="width:62px;flex-shrink:0"></div>'}
    <div class="lh-center">
      <h2>${esc(inst?.name ?? '—')}</h2>
      ${subLine ? `<div class="sub">${subLine}</div>` : ''}
      ${contactLine ? `<div class="sub">${contactLine}</div>` : ''}
    </div>
    ${inst?.stampUrl ? `<img class="lh-stamp" src="${esc(inst.stampUrl)}" alt="Stamp" />` : '<div style="width:62px;flex-shrink:0"></div>'}
  </div>
  <h1>Transfer Certificate</h1>
  <div class="meta">
    <span>TC No:&nbsp;<strong>${esc(tc.tcNumber ?? '____________')}</strong></span>
    <span>Admission No:&nbsp;<strong>${esc(tc.admissionNo)}</strong></span>
  </div>
  <table><tbody>${rowsHtml}</tbody></table>
  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-line"></div>
      Signature of Class Teacher
    </div>
    <div class="sig-block">
      ${inst?.signatureUrl ? `<img src="${esc(inst.signatureUrl)}" alt="Signature" />` : ''}
      <div class="sig-line"></div>
      ${inst?.principalName ? esc(inst.principalName) : 'Principal'} — Sign &amp; Seal
    </div>
  </div>
  <div class="footnote">Certified that the above information is correct as per the school records. — ${esc(inst?.name ?? '')}${inst?.gstin ? `  ·  GSTIN: ${esc(inst.gstin)}` : ''}</div>
<script>window.onload=function(){window.print();}</script></body></html>`;

    const w = window.open('', '_blank', 'width=820,height=960');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const displayed = list;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ds-text1">Transfer Certificates</h1>
          <p className="text-sm text-ds-text3 mt-0.5">Manage outgoing TC requests for departing students</p>
        </div>
      </div>

      {error   && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 border-b border-ds-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-ds-brand text-ds-text1'
                : 'border-transparent text-ds-text2 hover:text-ds-text1'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-ds-text3">Loading...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-ds-text3">
          <p className="text-sm">No transfer certificates {tab !== 'all' ? `with status "${TAB_LABELS[tab]}"` : ''}.</p>
          <p className="text-xs mt-1">To request a TC, go to a student's profile page.</p>
        </div>
      ) : (
        <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead>
              <tr className="bg-ds-bg2 border-b border-ds-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-ds-text2 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ds-text2 uppercase tracking-wide">Class</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-ds-text2 uppercase tracking-wide">Requested</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-ds-text2 uppercase tracking-wide">Conduct</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-ds-text2 uppercase tracking-wide">Dues</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-ds-text2 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ds-text2 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((tc) => {
                const className =
                  tc.student?.academicUnit?.displayName ||
                  tc.student?.academicUnit?.name ||
                  tc.classLastStudied;
                return (
                  <tr
                    key={tc.id}
                    className="border-b border-ds-border hover:bg-ds-bg2 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ds-text1">{tc.studentName}</p>
                      <p className="text-xs text-ds-text3 font-mono">{tc.admissionNo}</p>
                    </td>
                    <td className="px-4 py-3 text-ds-text2 align-top">{className}</td>
                    <td className="px-4 py-3 text-ds-text2 text-xs text-center align-top">
                      {new Date(tc.requestedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-ds-text2 text-center align-top">{tc.conductGrade}</td>
                    <td className="px-4 py-3 text-center align-top">
                      {tc.hasDues ? (
                        <span className="text-xs text-ds-error-text bg-ds-error-bg border border-ds-error-border rounded-full px-2 py-0.5">Has Dues</span>
                      ) : (
                        <span className="text-xs text-ds-success-text bg-ds-success-bg border border-ds-success-border rounded-full px-2 py-0.5">Clear</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center align-top">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[tc.status] ?? 'bg-ds-bg2 text-ds-text2'}`}>
                        {STATUS_LABELS[tc.status] ?? tc.status}
                      </span>
                      {tc.tcNumber && (
                        <p className="text-[10px] text-ds-text3 font-mono mt-0.5">{tc.tcNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Go to student profile */}
                        <button
                          onClick={() => router.push(`/dashboard/students/${tc.studentId}`)}
                          className="text-xs text-ds-text2 hover:text-ds-text1 underline"
                        >
                          Profile
                        </button>

                        {tc.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => handleApprove(tc.id)}
                              className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setRejectTarget(tc.id); setRejectRemark(''); }}
                              className="text-xs border border-red-300 text-ds-error-text px-2.5 py-1 rounded-lg hover:bg-ds-error-bg font-medium"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {tc.status === 'approved' && (
                          <button
                            onClick={() => handleIssue(tc.id)}
                            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 font-medium"
                          >
                            Issue TC
                          </button>
                        )}

                        {tc.status === 'issued' && (
                          <button
                            onClick={() => openPrint(tc.id)}
                            disabled={printLoading}
                            className="btn-brand text-xs px-2.5 py-1 rounded-lg"
                          >
                            View / Print
                          </button>
                        )}

                        {tc.status === 'rejected' && tc.rejectionRemark && (
                          <span
                            title={tc.rejectionRemark}
                            className="text-xs text-red-500 underline cursor-help"
                          >
                            See reason
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Reject modal ── */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ds-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-ds-text1 mb-1">Reject TC Request</h2>
            <p className="text-xs text-ds-text2 mb-4">
              Provide a reason — the operator who raised the request will see this.
            </p>
            <textarea
              className="w-full border border-ds-border-strong rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ds-brand"
              rows={3}
              placeholder="e.g. Outstanding fees not cleared, re-submit after payment"
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 border border-ds-border-strong text-ds-text1 py-2 rounded-lg text-sm hover:bg-ds-bg2"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectBusy || !rejectRemark.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejectBusy ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TC Document modal ── */}
      {printTc && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-ds-surface rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-ds-border">
              <div>
                <h2 className="text-base font-bold text-ds-text1">Transfer Certificate</h2>
                {printTc.tcNumber && (
                  <p className="text-xs text-ds-text3 font-mono mt-0.5">{printTc.tcNumber}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={doPrint}
                  className="btn-brand px-4 py-2 rounded-lg"
                >
                  Print
                </button>
                <button
                  onClick={() => setPrintTc(null)}
                  className="text-ds-text3 hover:text-ds-text2 text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Document preview */}
            <div className="p-8">
              <TcDocument tc={printTc} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
