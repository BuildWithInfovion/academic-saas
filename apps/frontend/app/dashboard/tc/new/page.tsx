'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  bloodGroup?: string;
  admissionDate?: string;
  status: string;
  academicUnit?: { id: string; displayName?: string; name?: string };
}

interface TcFormState {
  // Personal (operator-editable overrides)
  nationality: string;
  religion: string;
  casteCategory: string;
  gender: string;
  bloodGroup: string;
  // Academic (operator-editable)
  subjectsStudied: string;
  lastExamName: string;
  lastExamResult: string;
  promotionEligible: string;
  // Fee (operator-editable)
  feesPaidUpToMonth: string;
  // TC-specific
  conductGrade: string;
  reason: string;
}

const INITIAL_FORM: TcFormState = {
  nationality: '',
  religion: '',
  casteCategory: '',
  gender: '',
  bloodGroup: '',
  subjectsStudied: '',
  lastExamName: '',
  lastExamResult: '',
  promotionEligible: '',
  feesPaidUpToMonth: '',
  conductGrade: 'Good',
  reason: '',
};

// ── Helper components ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6 first:mt-0">
      {children}
    </h2>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text', required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-300 p-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options, required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 p-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-gray-400 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewTcPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');

  const [student, setStudent] = useState<Student | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [form, setForm] = useState<TcFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof TcFormState) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  useEffect(() => {
    if (!studentId) return;
    void (async () => {
      try {
        const s = await apiFetch(`/students/${studentId}`) as Student;
        setStudent(s);
        // Pre-fill form from student record
        setForm((f) => ({
          ...f,
          nationality:   s.nationality   ?? '',
          religion:      s.religion      ?? '',
          casteCategory: s.casteCategory ?? '',
          gender:        s.gender        ?? '',
          bloodGroup:    s.bloodGroup    ?? '',
        }));
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load student');
      } finally {
        setLoadingStudent(false);
      }
    })();
  }, [studentId]);

  const handleSubmit = async () => {
    if (!student) return;
    setSubmitting(true);
    setError(null);

    // Build payload — only include non-empty overrides so backend auto-computes where blank
    const payload: Record<string, string> = { studentId: student.id };
    const keys = Object.keys(form) as (keyof TcFormState)[];
    for (const k of keys) {
      if (form[k].trim()) payload[k] = form[k].trim();
    }

    try {
      await apiFetch('/tc', { method: 'POST', body: JSON.stringify(payload) });
      router.push('/dashboard/tc');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit TC request');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  if (!studentId) {
    return (
      <div className="p-10 text-center text-gray-500">
        <p className="text-sm">No student selected.</p>
        <button onClick={() => router.back()} className="mt-4 text-xs underline text-gray-400 hover:text-gray-600">
          Go back
        </button>
      </div>
    );
  }

  if (loadingStudent) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading student details…</div>;
  }

  if (!student) {
    return (
      <div className="p-10 text-center text-red-500 text-sm">
        {error || 'Student not found.'}
      </div>
    );
  }

  const className = student.academicUnit?.displayName || student.academicUnit?.name || '—';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push(`/dashboard/students/${student.id}`)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
      >
        ← Back to Student Profile
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Request Transfer Certificate</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Fill in all TC fields for <strong>{student.firstName} {student.lastName}</strong> — an approver must review before the TC can be issued.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Left column — student snapshot (read-only) */}
        <div className="col-span-1 bg-gray-50 rounded-xl border border-gray-100 p-4 self-start">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Student Snapshot</p>
          <InfoRow label="Name"          value={`${student.firstName} ${student.lastName}`} />
          <InfoRow label="Admission No"  value={student.admissionNo} />
          <InfoRow label="Class"         value={className} />
          <InfoRow label="Date of Birth" value={fmt(student.dateOfBirth)} />
          <InfoRow label="Admission Date" value={fmt(student.admissionDate)} />
          <p className="text-[10px] text-gray-400 mt-4">
            Attendance, subjects, exam results &amp; fee dues are computed automatically by the system at submission time.
          </p>
        </div>

        {/* Right column — editable form */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">

          {/* Personal Details */}
          <div>
            <SectionTitle>Personal Details</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Gender" value={form.gender} onChange={set('gender')} required
                options={[['', 'Select Gender'], ['Male', 'Male'], ['Female', 'Female'], ['Other', 'Other']]}
              />
              <SelectField
                label="Blood Group" value={form.bloodGroup} onChange={set('bloodGroup')} required
                options={[
                  ['', 'Select Blood Group'],
                  ...['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => [bg, bg] as [string, string]),
                ]}
              />
              <Field label="Nationality" value={form.nationality} onChange={set('nationality')} placeholder="e.g. Indian" required />
              <Field label="Religion" value={form.religion} onChange={set('religion')} placeholder="e.g. Hindu" required />
              <SelectField
                label="Caste / Category" value={form.casteCategory} onChange={set('casteCategory')} required
                options={[
                  ['', 'Select Category'],
                  ['General','General'], ['OBC','OBC'], ['SC','SC'],
                  ['ST','ST'], ['NT','NT'], ['SBC','SBC'],
                ]}
              />
            </div>
          </div>

          {/* Academic Details */}
          <div>
            <SectionTitle>Academic Details</SectionTitle>
            <p className="text-xs text-gray-400 mb-3">
              Leave blank to auto-compute from records. Fill only if you need to override.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field
                  label="Subjects Studied"
                  value={form.subjectsStudied}
                  onChange={set('subjectsStudied')}
                  placeholder="Auto-computed from class subject list (override if needed)"
                />
              </div>
              <div className="col-span-2">
                <Field
                  label="Last Exam (name)"
                  value={form.lastExamName}
                  onChange={set('lastExamName')}
                  placeholder="e.g. Annual Examination 2024–25 (auto-computed)"
                />
              </div>
              <SelectField
                label="Exam Result"
                value={form.lastExamResult}
                onChange={set('lastExamResult')}
                options={[['', 'Auto-detect'], ['Pass', 'Pass'], ['Fail', 'Fail'], ['N/A', 'N/A']]}
              />
              <SelectField
                label="Eligible for Promotion"
                value={form.promotionEligible}
                onChange={set('promotionEligible')}
                options={[['', 'Auto-detect'], ['Yes', 'Yes'], ['No', 'No'], ['N/A', 'N/A']]}
              />
            </div>
          </div>

          {/* Fee Details */}
          <div>
            <SectionTitle>Fee Details</SectionTitle>
            <Field
              label="Fees Paid Up To Month"
              value={form.feesPaidUpToMonth}
              onChange={set('feesPaidUpToMonth')}
              placeholder="e.g. March 2025 (auto-computed from last payment)"
            />
          </div>

          {/* TC Details */}
          <div>
            <SectionTitle>TC Details</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Conduct &amp; Character" value={form.conductGrade} onChange={set('conductGrade')} required
                options={[['Excellent','Excellent'], ['Good','Good'], ['Satisfactory','Satisfactory'], ['Poor','Poor']]}
              />
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Reason for Leaving</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Family relocation, admission to another school…"
                  rows={2}
                  className="border border-gray-300 p-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={() => router.push(`/dashboard/students/${student.id}`)}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.gender || !form.nationality || !form.religion || !form.casteCategory}
              className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit TC Request →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
