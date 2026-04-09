'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

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
  status: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  aadharNumber?: string;
  tcFromPrevious?: string;
  tcPreviousInstitution?: string;
  createdAt: string;
}

interface AcademicUnit { id: string; displayName?: string; name?: string; }

const TC_LABELS: Record<string, string> = {
  not_applicable: 'Not Applicable', pending: 'Pending', received: 'Received', waived: 'Waived',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  transferred: 'bg-yellow-100 text-yellow-700',
  alumni: 'bg-blue-100 text-blue-700',
};

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Student>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, u] = await Promise.all([
          apiFetch(`/students/${id}`),
          apiFetch('/academic/units/leaf'),
        ]);
        setStudent(s as Student);
        setUnits(Array.isArray(u) ? (u as AcademicUnit[]) : ((u as { data: AcademicUnit[] }).data || []));
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load student');
      } finally {
        setLoading(false);
      }
    };
    if (id) void load();
  }, [id]);

  const startEdit = () => {
    if (!student) return;
    setForm({
      firstName: student.firstName, lastName: student.lastName,
      dateOfBirth: student.dateOfBirth?.split('T')[0],
      gender: student.gender, phone: student.phone, email: student.email,
      address: student.address, fatherName: student.fatherName,
      motherName: student.motherName, parentPhone: student.parentPhone,
      secondaryPhone: student.secondaryPhone,
      admissionDate: student.admissionDate?.split('T')[0],
      academicUnitId: student.academicUnitId, rollNo: student.rollNo,
      bloodGroup: student.bloodGroup, nationality: student.nationality,
      religion: student.religion, casteCategory: student.casteCategory,
      aadharNumber: student.aadharNumber,
      tcFromPrevious: student.tcFromPrevious,
      tcPreviousInstitution: student.tcPreviousInstitution,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setStudent(updated as Student);
      setEditing(false);
      setSuccess('Student updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'border border-gray-300 p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-black';
  const lbl = 'text-xs font-medium text-gray-500 block mb-1';

  if (loading) return <div className="p-10 text-gray-400">Loading...</div>;
  if (error && !student) return <div className="p-10 text-red-500">{error}</div>;
  if (!student) return null;

  const unit = units.find((u) => u.id === student.academicUnitId);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push('/dashboard/students')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
        ← Back to Students
      </button>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{student.firstName} {student.lastName}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500 font-mono">{student.admissionNo}</span>
              {student.rollNo && <span className="text-sm text-gray-500">Roll: {student.rollNo}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[student.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {student.status}
              </span>
            </div>
            <div className="mt-1 text-sm text-gray-500">{unit?.displayName || unit?.name || 'No class assigned'}</div>
          </div>
          {!editing && (
            <button onClick={startEdit}
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-medium">Edit Details</h2>

          <Section title="Basic Information">
            <div className="grid grid-cols-3 gap-4">
              <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} inp={inp} lbl={lbl} />
              <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} inp={inp} lbl={lbl} />
              <Field label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} inp={inp} lbl={lbl} />
              <SelectField label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} lbl={lbl} inp={inp}
                options={[['', 'Select'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']]} />
              <Field label="Student Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inp={inp} lbl={lbl} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} inp={inp} lbl={lbl} />
              <Field label="Roll No" value={form.rollNo} onChange={(v) => setForm({ ...form, rollNo: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Parent / Guardian">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Father Name" value={form.fatherName} onChange={(v) => setForm({ ...form, fatherName: v })} inp={inp} lbl={lbl} />
              <Field label="Mother Name" value={form.motherName} onChange={(v) => setForm({ ...form, motherName: v })} inp={inp} lbl={lbl} />
              <Field label="Primary Contact" value={form.parentPhone} onChange={(v) => setForm({ ...form, parentPhone: v })} inp={inp} lbl={lbl} />
              <Field label="Secondary Contact" value={form.secondaryPhone} onChange={(v) => setForm({ ...form, secondaryPhone: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Address">
            <div>
              <label className={lbl}>Residential Address</label>
              <textarea className={inp} rows={2} value={form.address ?? ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </Section>

          <Section title="Academic">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Class</label>
                <select className={inp} value={form.academicUnitId ?? ''} onChange={(e) => setForm({ ...form, academicUnitId: e.target.value })}>
                  <option value="">Select Class</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
                </select>
              </div>
              <Field label="Admission Date" type="date" value={form.admissionDate} onChange={(v) => setForm({ ...form, admissionDate: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Demographics (Optional)">
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="Blood Group" value={form.bloodGroup} onChange={(v) => setForm({ ...form, bloodGroup: v })} lbl={lbl} inp={inp}
                options={[['', 'Select'], ...['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => [bg, bg] as [string, string])]} />
              <Field label="Nationality" value={form.nationality} onChange={(v) => setForm({ ...form, nationality: v })} inp={inp} lbl={lbl} />
              <Field label="Religion" value={form.religion} onChange={(v) => setForm({ ...form, religion: v })} inp={inp} lbl={lbl} />
              <SelectField label="Caste Category" value={form.casteCategory} onChange={(v) => setForm({ ...form, casteCategory: v })} lbl={lbl} inp={inp}
                options={[['', 'Select'], ['General','General'], ['OBC','OBC'], ['SC','SC'], ['ST','ST'], ['NT','NT'], ['SBC','SBC']]} />
              <Field label="Aadhar Number" value={form.aadharNumber} onChange={(v) => setForm({ ...form, aadharNumber: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <Section title="Transfer Certificate">
            <div className="grid grid-cols-3 gap-4">
              <SelectField label="TC Status" value={form.tcFromPrevious} onChange={(v) => setForm({ ...form, tcFromPrevious: v })} lbl={lbl} inp={inp}
                options={[['not_applicable','Not Applicable'],['pending','Pending'],['received','Received'],['waived','Waived']]} />
              <Field label="Previous Institution" value={form.tcPreviousInstitution} onChange={(v) => setForm({ ...form, tcPreviousInstitution: v })} inp={inp} lbl={lbl} />
            </div>
          </Section>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-black text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <InfoCard title="Personal Information">
            <Row label="Date of Birth" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-IN') : '—'} />
            <Row label="Gender" value={student.gender ?? '—'} />
            <Row label="Phone" value={student.phone ?? '—'} />
            <Row label="Email" value={student.email ?? '—'} />
            <Row label="Blood Group" value={student.bloodGroup ?? '—'} />
            <Row label="Nationality" value={student.nationality ?? '—'} />
            <Row label="Religion" value={student.religion ?? '—'} />
            <Row label="Caste Category" value={student.casteCategory ?? '—'} />
            {student.aadharNumber && <Row label="Aadhar" value={`XXXX XXXX ${student.aadharNumber.slice(-4)}`} />}
            <Row label="Address" value={student.address ?? '—'} />
          </InfoCard>

          <InfoCard title="Family Details">
            <Row label="Father Name" value={student.fatherName ?? '—'} />
            <Row label="Mother Name" value={student.motherName ?? '—'} />
            <Row label="Primary Contact" value={student.parentPhone ?? '—'} />
            <Row label="Secondary Contact" value={student.secondaryPhone ?? '—'} />
          </InfoCard>

          <InfoCard title="Academic Details">
            <Row label="Class" value={unit?.displayName || unit?.name || '—'} />
            <Row label="Roll No" value={student.rollNo ?? '—'} />
            <Row label="Admission Date" value={student.admissionDate ? new Date(student.admissionDate).toLocaleDateString('en-IN') : '—'} />
            <Row label="Admitted On" value={new Date(student.createdAt).toLocaleDateString('en-IN')} />
          </InfoCard>

          <InfoCard title="Transfer Certificate">
            <Row label="Incoming TC" value={TC_LABELS[student.tcFromPrevious ?? ''] ?? student.tcFromPrevious ?? '—'} />
            <Row label="Previous Institution" value={student.tcPreviousInstitution ?? '—'} />
          </InfoCard>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-800 font-medium text-right max-w-[60%]">{value}</dd>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, inp, lbl, type = 'text' }: {
  label: string; value?: string; onChange: (v: string) => void;
  inp: string; lbl: string; type?: string;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input type={type} className={inp} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, onChange, inp, lbl, options }: {
  label: string; value?: string; onChange: (v: string) => void;
  inp: string; lbl: string; options: [string, string][];
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <select className={inp} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
