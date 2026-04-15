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
  pending_approval: 'bg-amber-100 text-amber-700',
  approved:         'bg-blue-100 text-blue-700',
  rejected:         'bg-red-100 text-red-700',
  issued:           'bg-green-100 text-green-700',
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
    ['5.',  'Date of first admission in the school with class',          admissionWithClass],
    ['6.',  'Date of Birth (in figures & words)',                        dobFiguresAndWords(tc.dateOfBirth)],
    ['7.',  'Class in which the pupil last studied',                     tc.classLastStudied],
    ['8.',  'School/Board Annual Examination last taken with result',    examLine],
    ['9.',  'Subjects Studied',                                          tc.subjectsStudied ?? '—'],
    ['10.', 'Whether qualified for promotion to higher class',           tc.promotionEligible ?? '—'],
    ['11.', 'Month up to which the student has paid fees',               tc.feesPaidUpToMonth ?? '—'],
    ['12.', 'Total No. of working days in the session',                  attendanceLine],
    ['13.', 'Total No. of working days present',                         presentLine],
    ['14.', 'General conduct',                                           tc.conductGrade],
    ['15.', 'Date of application for certificate',                       fmt(tc.requestedAt)],
    ['16.', 'Date of issue of certificate',                              fmt(tc.issuedAt)],
    ['17.', 'Reasons for leaving the school',                            tc.reason ?? '—'],
  ];

  return (
    <div
      id="tc-print-area"
      className="bg-white text-gray-900"
      style={{ fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.7 }}
    >
      {/* School letterhead */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-5">
        <p className="text-2xl font-bold uppercase tracking-wide">{institution?.name ?? '—'}</p>
        {institution?.board && (
          <p className="text-sm text-gray-600 mt-0.5">Affiliated to {institution.board}</p>
        )}
        {institution?.address && (
          <p className="text-xs text-gray-500 mt-0.5">{institution.address}</p>
        )}
        <div className="flex justify-center gap-6 text-xs text-gray-500 mt-1">
          {institution?.phone && <span>Ph: {institution.phone}</span>}
          {institution?.email && <span>Email: {institution.email}</span>}
        </div>
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
              <td className="py-2 pr-2 align-top text-gray-500" style={{ width: 28, whiteSpace: 'nowrap' }}>{no}</td>
              <td className="py-2 pr-6 align-top font-medium text-gray-700" style={{ width: 290 }}>{label}</td>
              <td className="py-2 align-top text-gray-900">: &nbsp;{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signature lines */}
      <div className="flex justify-between mt-12 pt-2">
        <div className="text-center text-xs text-gray-600">
          <div style={{ borderTop: '1px solid #6b7280', width: 160, marginBottom: 4 }} />
          Signature of Class Teacher
        </div>
        <div className="text-center text-xs text-gray-600">
          <div style={{ borderTop: '1px solid #6b7280', width: 200, marginBottom: 4 }} />
          Principal / Manager — Sign &amp; Seal
        </div>
      </div>

      <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 28 }}>
        Certified that the above information is correct as per the school records. — {institution?.name}
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
    const el = document.getElementById('tc-print-area');
    if (!el) return;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`
      <html><head><title>Transfer Certificate</title>
      <style>
        body { font-family: Georgia, serif; font-size: 13px; margin: 40px; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
        h1 { text-align: center; font-size: 15px; text-transform: uppercase; letter-spacing: 0.15em; text-decoration: underline; margin-bottom: 20px; }
        .letterhead { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
        .letterhead h2 { font-size: 18px; text-transform: uppercase; margin: 0; }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const displayed = list;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Transfer Certificates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage outgoing TC requests for departing students</p>
        </div>
      </div>

      {error   && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-black text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No transfer certificates {tab !== 'all' ? `with status "${TAB_LABELS[tab]}"` : ''}.</p>
          <p className="text-xs mt-1">To request a TC, go to a student's profile page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conduct</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dues</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
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
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{tc.studentName}</p>
                      <p className="text-xs text-gray-400 font-mono">{tc.admissionNo}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{className}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(tc.requestedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{tc.conductGrade}</td>
                    <td className="px-4 py-3">
                      {tc.hasDues ? (
                        <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">Has Dues</span>
                      ) : (
                        <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Clear</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[tc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[tc.status] ?? tc.status}
                      </span>
                      {tc.tcNumber && (
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{tc.tcNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Go to student profile */}
                        <button
                          onClick={() => router.push(`/dashboard/students/${tc.studentId}`)}
                          className="text-xs text-gray-500 hover:text-gray-800 underline"
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
                              className="text-xs border border-red-300 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 font-medium"
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
                            className="text-xs bg-black text-white px-2.5 py-1 rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Reject TC Request</h2>
            <p className="text-xs text-gray-500 mb-4">
              Provide a reason — the operator who raised the request will see this.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
              rows={3}
              placeholder="e.g. Outstanding fees not cleared, re-submit after payment"
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Transfer Certificate</h2>
                {printTc.tcNumber && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{printTc.tcNumber}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={doPrint}
                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Print
                </button>
                <button
                  onClick={() => setPrintTc(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
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
