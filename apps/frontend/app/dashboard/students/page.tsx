'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ── Date Select ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function DateSelect({ value, onChange, minYear, maxYear }: {
  value: string; onChange: (v: string) => void; minYear: number; maxYear: number;
}) {
  const [d, setD] = useState('');
  const [m, setM] = useState('');
  const [y, setY] = useState('');

  // Sync from external value (e.g. form reset or edit prefill)
  useEffect(() => {
    if (!value) { setD(''); setM(''); setY(''); return; }
    const p = value.split('-');
    setD(p[2] || ''); setM(p[1] || ''); setY(p[0] || '');
  }, [value]);

  const update = (day: string, mon: string, year: string) => {
    setD(day); setM(mon); setY(year);
    if (day && mon && year) onChange(`${year}-${mon.padStart(2,'0')}-${day.padStart(2,'0')}`);
    // Do not call onChange('') on partial — keep local state until all three are filled
  };
  const sel = 'form-select';
  const daysInMonth = m && y ? new Date(Number(y), Number(m), 0).getDate() : 31;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  return (
    <div className="flex gap-2">
      <select className={`${sel} w-20`} value={d} onChange={(e) => update(e.target.value, m, y)}>
        <option value="">DD</option>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <option key={day} value={String(day).padStart(2,'0')}>{String(day).padStart(2,'0')}</option>
        ))}
      </select>
      <select className={`${sel} flex-1`} value={m} onChange={(e) => update(d, e.target.value, y)}>
        <option value="">Month</option>
        {MONTHS.map((name, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{name}</option>)}
      </select>
      <select className={`${sel} w-24`} value={y} onChange={(e) => update(d, m, e.target.value)}>
        <option value="">YYYY</option>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Student {
  id: string; admissionNo: string; rollNo?: string;
  firstName: string; lastName: string;
  dateOfBirth?: string; gender?: string; phone?: string; email?: string;
  address?: string; fatherName?: string; motherName?: string;
  parentPhone?: string; secondaryPhone?: string;
  admissionDate?: string; academicUnitId?: string;
  bloodGroup?: string; nationality?: string; religion?: string;
  casteCategory?: string; aadharNumber?: string;
  tcFromPrevious?: string; tcPreviousInstitution?: string;
  status?: string; createdAt: string;
  academicUnit?: { id: string; name: string; displayName?: string };
  userAccount?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  parentUser?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
}

interface AcademicUnit { id: string; displayName?: string; name?: string; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface FeeHead { id: string; name: string; }
interface FeeStructure { id: string; feeHeadId: string; amount: number; installmentName?: string; dueDate?: string; feeHead: FeeHead; }

const emptyForm = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '',
  phone: '', email: '',
  fatherName: '', motherName: '', parentPhone: '', secondaryPhone: '',
  address: '',
  academicUnitId: '', admissionDate: '',
  tcFromPrevious: '', tcPreviousInstitution: '',
  bloodGroup: '', nationality: 'Indian', religion: '', casteCategory: '', aadharNumber: '',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isReady, setIsReady] = useState(false);

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [academicUnits, setAcademicUnits] = useState<AcademicUnit[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const PAGE_SIZE = 50;

  // Form
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState('');

  // Fee step
  const [showFeeStep, setShowFeeStep] = useState(false);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feesPaid, setFeesPaid] = useState<'yes' | 'no' | 'partial'>('yes');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [feeDueDate, setFeeDueDate] = useState('');
  const [selectedFeeHeadId, setSelectedFeeHeadId] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Credentials modal
  const [credentials, setCredentials] = useState<{
    admissionNo: string; rollNo?: string;
    parentCredentials: { userId: string; phone?: string; isNew: boolean; generatedPassword?: string };
    feePayment?: { receiptNo?: string; amount: number; feeHead?: { name: string } } | null;
  } | null>(null);

  // Student profile slide panel
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Link modal — search-only, no user dropdown
  const [linkingStudent, setLinkingStudent] = useState<Student | null>(null);
  const [linkUserId, setLinkUserId] = useState('');
  const [linkType, setLinkType] = useState<'student' | 'parent'>('parent');
  const [linkSearch, setLinkSearch] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; email?: string; phone?: string } | null | 'not_found'>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [linking, setLinking] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { setIsReady(true); }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const fetchStudents = useCallback(async (p = page) => {
    try {
      const res = await apiFetch(`/students?page=${p}&limit=${PAGE_SIZE}`) as any;
      setStudents(res.data || res || []);
      if (res.total !== undefined) setTotalStudents(res.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!isReady || !user?.institutionId) return;
    Promise.all([
      apiFetch(`/students?page=${page}&limit=${PAGE_SIZE}`),
      apiFetch('/academic/units/classes'),
      apiFetch('/academic/years'),
      apiFetch('/fees/heads'),
    ]).then(([s, u, y, fh]) => {
      const sr = s as any;
      setStudents(sr.data || sr || []);
      if (sr.total !== undefined) setTotalStudents(sr.total);
      setAcademicUnits(Array.isArray(u) ? u : []);
      const years: AcademicYear[] = Array.isArray(y) ? y : [];
      setAcademicYears(years);
      const cur = years.find((yr) => yr.isCurrent);
      if (cur) setCurrentYearId(cur.id);
      setFeeHeads(Array.isArray(fh) ? fh : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isReady, user?.institutionId, page]);

  const resetForm = () => { setForm({ ...emptyForm }); setEditingId(null); setError(null); };

  const f = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return 'First and last name are required';
    if (!form.fatherName.trim()) return 'Father name is required';
    if (!form.motherName.trim()) return 'Mother name is required';
    if (!form.parentPhone.trim()) return 'Parent phone is required';
    if (!form.address.trim()) return 'Residential address is required';
    if (!form.academicUnitId) return 'Please select a class';
    return null;
  };

  // ── Step 1 complete → open fee step ──────────────────────────────────────
  const openFeeStep = async () => {
    setError(null);
    const err = validate();
    if (err) return setError(err);
    setShowFeeStep(true);
    setFeesPaid('yes');
    setAmountPaid('');
    setPaymentMode('cash');
    setFeeDueDate('');
    setSelectedFeeHeadId('');
    if (form.academicUnitId && currentYearId) {
      setLoadingFees(true);
      try {
        const res = await apiFetch(`/fees/structures?unitId=${form.academicUnitId}&yearId=${currentYearId}`);
        const structs: FeeStructure[] = Array.isArray(res) ? res : [];
        setFeeStructures(structs);
        // Default: find "Admission" fee head
        const admissionHead = structs.find((s) => s.feeHead.name.toLowerCase().includes('admission'));
        if (admissionHead) setSelectedFeeHeadId(admissionHead.feeHeadId);
      } catch { setFeeStructures([]); } finally { setLoadingFees(false); }
    }
  };

  // ── Step 2: Confirm admission ─────────────────────────────────────────────
  const confirmAdmission = async () => {
    setConfirming(true);
    setError(null);
    try {
      const payload: any = {
        ...form,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        admissionDate: form.admissionDate || new Date().toISOString().split('T')[0],
        tcFromPrevious: form.tcFromPrevious || undefined,
        bloodGroup: form.bloodGroup || undefined,
        nationality: form.nationality || 'Indian',
        religion: form.religion.trim() || undefined,
        casteCategory: form.casteCategory || undefined,
        aadharNumber: form.aadharNumber.trim() || undefined,
        tcPreviousInstitution: form.tcPreviousInstitution.trim() || undefined,
      };

      // Admission fee
      if (selectedFeeHeadId && (feesPaid === 'yes' || feesPaid === 'partial')) {
        payload.admissionFee = {
          paid: true,
          amountPaid: parseFloat(amountPaid) || 0,
          paymentMode,
          feeHeadId: selectedFeeHeadId,
          academicYearId: currentYearId || undefined,
        };
      } else if (feesPaid === 'no') {
        payload.admissionFee = { paid: false, dueDate: feeDueDate || undefined };
      }

      const result = await apiFetch('/students/confirm-admission', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowFeeStep(false);
      resetForm();
      await fetchStudents();
      setCredentials(result);
    } catch (e: any) {
      setError(e.message || 'Admission failed');
    } finally {
      setConfirming(false);
    }
  };

  // ── Edit / Update ─────────────────────────────────────────────────────────
  const handleEdit = (student: Student) => {
    setEditingId(student.id);
    setError(null);
    setForm({
      firstName: student.firstName || '', lastName: student.lastName || '',
      dateOfBirth: student.dateOfBirth?.split('T')[0] || '',
      gender: student.gender || '', phone: student.phone || '', email: student.email || '',
      address: student.address || '',
      fatherName: student.fatherName || '', motherName: student.motherName || '',
      parentPhone: student.parentPhone || '', secondaryPhone: student.secondaryPhone || '',
      admissionDate: student.admissionDate?.split('T')[0] || '',
      academicUnitId: student.academicUnitId || '',
      bloodGroup: student.bloodGroup || '', nationality: student.nationality || 'Indian',
      religion: student.religion || '', casteCategory: student.casteCategory || '',
      aadharNumber: student.aadharNumber || '', tcFromPrevious: student.tcFromPrevious || '',
      tcPreviousInstitution: student.tcPreviousInstitution || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setError(null);
    setUpdating(true);
    try {
      await apiFetch(`/students/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: form.firstName.trim(), lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth || undefined, gender: form.gender || undefined,
          phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
          address: form.address.trim(), fatherName: form.fatherName.trim(),
          motherName: form.motherName.trim(), parentPhone: form.parentPhone.trim(),
          secondaryPhone: form.secondaryPhone.trim() || undefined,
          admissionDate: form.admissionDate || undefined,
          academicUnitId: form.academicUnitId,
          bloodGroup: form.bloodGroup || undefined, nationality: form.nationality || 'Indian',
          religion: form.religion.trim() || undefined, casteCategory: form.casteCategory || undefined,
          aadharNumber: form.aadharNumber.trim() || undefined,
          tcFromPrevious: form.tcFromPrevious || undefined,
          tcPreviousInstitution: form.tcPreviousInstitution.trim() || undefined,
        }),
      });
      resetForm();
      await fetchStudents();
      showSuccess('Student updated');
    } catch (e: any) { setError(e.message || 'Failed to update'); } finally { setUpdating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this student? (soft-delete, recoverable)')) return;
    try {
      await apiFetch(`/students/${id}`, { method: 'DELETE' });
      await fetchStudents();
      showSuccess('Student removed');
    } catch (e: any) { setError(e.message || 'Failed to delete'); }
  };

  // ── Unlink ────────────────────────────────────────────────────────────────
  const handleUnlink = async (studentId: string, role: 'student' | 'parent') => {
    if (!confirm(`Unlink ${role} account? The user will immediately lose portal access.`)) return;
    setUnlinking(true);
    try {
      await apiFetch(`/students/${studentId}/link-user?role=${role}`, { method: 'DELETE' });
      await fetchStudents();
      if (profileStudent?.id === studentId) {
        const updated = await apiFetch(`/students/${studentId}`);
        setProfileStudent(updated);
      }
      showSuccess(`${role} account unlinked and deactivated`);
    } catch (e: any) { setError(e.message || 'Failed to unlink'); } finally { setUnlinking(false); }
  };

  // ── Manual link modal ─────────────────────────────────────────────────────
  const openLinkModal = async (student: Student) => {
    setLinkingStudent(student);
    setLinkUserId('');
    setLinkType('parent');
    setFoundUser(null);
    // Pre-fill search with student's parent phone (auto-search)
    const preSearch = student.parentPhone || '';
    setLinkSearch(preSearch);
    if (preSearch) searchUserByIdentifier(preSearch);
  };

  const searchUserByIdentifier = async (identifier: string) => {
    if (!identifier.trim()) return;
    setSearchingUser(true);
    setFoundUser(null);
    setLinkUserId('');
    try {
      const users = await apiFetch('/users') as { id: string; email?: string; phone?: string; roles: { role: { code: string } }[] }[];
      const match = users.find(
        (u) =>
          (u.phone && u.phone === identifier.trim()) ||
          (u.email && u.email.toLowerCase() === identifier.trim().toLowerCase()),
      );
      if (match) {
        setFoundUser({ id: match.id, email: match.email, phone: match.phone });
        setLinkUserId(match.id);
      } else {
        setFoundUser('not_found');
      }
    } catch { /* ignore */ } finally { setSearchingUser(false); }
  };

  const handleLink = async () => {
    if (!linkingStudent || !linkUserId) return;
    setLinking(true);
    try {
      await apiFetch(`/students/${linkingStudent.id}/link-user`, {
        method: 'POST',
        body: JSON.stringify({ userId: linkUserId, role: linkType }),
      });
      showSuccess(`${linkType} account linked`);
      setLinkingStudent(null);
      await fetchStudents();
    } catch (e: any) { setError(e.message || 'Failed to link'); } finally { setLinking(false); }
  };

  const filteredStudents = search.trim().length >= 1
    ? students.filter((s) => {
        const q = search.toLowerCase();
        return (
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          (s.parentPhone || '').includes(q)
        );
      })
    : students;

  const totalFeeStructure = feeStructures.reduce((sum, s) => sum + s.amount, 0);
  const inp = 'border border-gray-300 p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white';
  const lbl = 'text-xs font-medium text-gray-600 block mb-1';
  const sec = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-1 pb-1 border-b border-gray-100';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Admission</h1>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-600 text-sm">{success}</div>}

      {/* ── Step 1: Admission Form ── */}
      <div className="bg-white shadow-sm rounded-xl p-6 mb-6 border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-medium">{editingId ? 'Edit Student Record' : 'Admission Form'}</h2>
            {!editingId && <p className="text-xs text-gray-400 mt-0.5">Step 1 of 2 — Fill details, then confirm with fee info</p>}
          </div>
          {editingId && <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">Cancel Edit</button>}
        </div>

        <p className={sec}>Admission Details</p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <label className={lbl}>Class *{academicUnits.length === 0 && <span className="text-red-500 ml-1">(no classes)</span>}</label>
            <select className={inp} value={form.academicUnitId} onChange={f('academicUnitId')}>
              <option value="">{academicUnits.length === 0 ? 'No classes available' : 'Select Class'}</option>
              {academicUnits.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Academic Year</label>
            <select className={inp} value={currentYearId} onChange={(e) => setCurrentYearId(e.target.value)}>
              <option value="">Select Year</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Admission Date</label>
            <DateSelect value={form.admissionDate} onChange={(v) => setForm({ ...form, admissionDate: v })} minYear={2000} maxYear={new Date().getFullYear()} />
          </div>
          <div>
            <label className={lbl}>TC from Previous School</label>
            <select className={inp} value={form.tcFromPrevious} onChange={f('tcFromPrevious')}>
              <option value="">Auto-detect by class</option>
              <option value="not_applicable">Not Applicable (Class 1)</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="waived">Waived</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Previous School Name</label>
            <input className={inp} placeholder="Name of previous school" value={form.tcPreviousInstitution} onChange={f('tcPreviousInstitution')} />
          </div>
        </div>

        <p className={sec}>Student Information</p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div><label className={lbl}>First Name *</label><input className={inp} placeholder="e.g. Priya" value={form.firstName} onChange={f('firstName')} /></div>
          <div><label className={lbl}>Last Name *</label><input className={inp} placeholder="e.g. Sharma" value={form.lastName} onChange={f('lastName')} /></div>
          <div><label className={lbl}>Date of Birth</label><DateSelect value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} minYear={1990} maxYear={new Date().getFullYear() - 3} /></div>
          <div>
            <label className={lbl}>Gender</label>
            <select className={inp} value={form.gender} onChange={f('gender')}>
              <option value="">Select</option>
              <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </div>
          <div><label className={lbl}>Student Phone</label><input className={inp} placeholder="Optional" value={form.phone} onChange={f('phone')} /></div>
          <div><label className={lbl}>Email</label><input className={inp} type="email" placeholder="Optional" value={form.email} onChange={f('email')} /></div>
        </div>

        <p className={sec}>Parent / Guardian</p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div><label className={lbl}>Father Name *</label><input className={inp} value={form.fatherName} onChange={f('fatherName')} /></div>
          <div><label className={lbl}>Mother Name *</label><input className={inp} value={form.motherName} onChange={f('motherName')} /></div>
          <div><label className={lbl}>Primary Contact (Parent) *</label><input className={inp} placeholder="e.g. 9876543210" value={form.parentPhone} onChange={f('parentPhone')} /></div>
          <div><label className={lbl}>Secondary Contact</label><input className={inp} placeholder="Optional" value={form.secondaryPhone} onChange={f('secondaryPhone')} /></div>
        </div>

        <p className={sec}>Address</p>
        <div className="mb-5">
          <label className={lbl}>Residential Address *</label>
          <textarea className={inp} rows={2} placeholder="House No, Street, Village/Town, District, State, PIN" value={form.address} onChange={f('address')} />
        </div>

        <p className={sec}>Demographics</p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <label className={lbl}>Caste Category</label>
            <select className={inp} value={form.casteCategory} onChange={f('casteCategory')}>
              <option value="">Select</option>
              {['General','OBC','SC','ST','NT','SBC','VJ/DT'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Religion</label><input className={inp} placeholder="e.g. Hindu" value={form.religion} onChange={f('religion')} /></div>
          <div><label className={lbl}>Nationality</label><input className={inp} value={form.nationality} onChange={f('nationality')} /></div>
          <div><label className={lbl}>Aadhar Number</label><input className={inp} placeholder="12-digit Aadhar" maxLength={12} value={form.aadharNumber} onChange={f('aadharNumber')} /></div>
          <div>
            <label className={lbl}>Blood Group</label>
            <select className={inp} value={form.bloodGroup} onChange={f('bloodGroup')}>
              <option value="">Select</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-2">
          {editingId ? (
            <div className="flex gap-3">
              <button onClick={handleUpdate} disabled={updating}
                className="flex-1 bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {updating ? 'Updating...' : 'Update Student'}
              </button>
              <button onClick={resetForm} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          ) : (
            <button onClick={openFeeStep}
              className="w-full bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800">
              Next: Fee &amp; Confirm Admission →
            </button>
          )}
        </div>
      </div>

      {/* ── Recently Admitted ── */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-medium text-gray-800">Recently Admitted</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 10 admissions — link parent portal access from here</p>
          </div>
          <Link href="/dashboard/students/directory"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Student Directory →
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No students admitted yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Adm. No', 'Name', 'Class', 'Parent Phone', 'Portal Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...students].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map((s) => {
                  const unit = academicUnits.find((u) => u.id === s.academicUnitId) || s.academicUnit;
                  const hasParent = !!s.parentUser;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.admissionNo}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        <button onClick={() => setProfileStudent(s)} className="hover:underline text-left">
                          {s.firstName} {s.lastName}
                        </button>
                        {s.gender && <div className="text-xs text-gray-400 capitalize">{s.gender}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{(unit as any)?.displayName || (unit as any)?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{s.parentPhone || '—'}</td>
                      <td className="px-4 py-3">
                        {hasParent ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            Parent linked
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            No portal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openLinkModal(s)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">
                          {hasParent ? 'Re-link' : 'Link Parent'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && students.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>
              Page {page}
              {totalStudents > 0 && ` · ${totalStudents} total students`}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                ← Prev
              </button>
              <button
                disabled={students.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Step 2: Fee & Confirmation Modal ── */}
      {showFeeStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Step 2 — Fee & Admission Confirmation</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Admitting: <span className="font-medium text-gray-700">{form.firstName} {form.lastName}</span>
                {form.academicUnitId && ` → ${academicUnits.find((u) => u.id === form.academicUnitId)?.displayName || ''}`}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Fee structure for class */}
              {loadingFees ? (
                <p className="text-sm text-gray-400">Loading fee structure...</p>
              ) : feeStructures.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Class Fee Structure</p>
                  <div className="bg-gray-50 rounded-lg divide-y divide-gray-100 text-sm">
                    {feeStructures.map((s) => (
                      <div key={s.id} className="flex justify-between px-4 py-2.5">
                        <span className="text-gray-700">{s.feeHead.name}{s.installmentName ? ` (${s.installmentName})` : ''}</span>
                        <span className="font-medium text-gray-800">₹{s.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-2.5 font-semibold">
                      <span>Total Due</span>
                      <span>₹{totalFeeStructure.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  No fee structure configured for this class yet. You can set it up in the Fees section. Admission will proceed without fee collection.
                </div>
              )}

              {/* Fee payment section */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Admission Fee Payment</p>
                <div className="flex gap-2 mb-4">
                  {[
                    { val: 'yes', label: 'Paid in Full' },
                    { val: 'partial', label: 'Partial Payment' },
                    { val: 'no', label: 'Due Later' },
                  ].map((opt) => (
                    <button key={opt.val} onClick={() => setFeesPaid(opt.val as any)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        feesPaid === opt.val ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {(feesPaid === 'yes' || feesPaid === 'partial') && (
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>Fee Head (for this payment)</label>
                      <select className={inp} value={selectedFeeHeadId} onChange={(e) => setSelectedFeeHeadId(e.target.value)}>
                        <option value="">Select fee head...</option>
                        {feeHeads.map((fh) => <option key={fh.id} value={fh.id}>{fh.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Amount Paid (₹)</label>
                        <input className={inp} type="number" placeholder="e.g. 5000"
                          value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
                      </div>
                      <div>
                        <label className={lbl}>Payment Mode</label>
                        <select className={inp} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                          {['cash','upi','cheque','dd','neft'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {feesPaid === 'no' && (
                  <div>
                    <label className={lbl}>Fee Due Date</label>
                    <input className={inp} type="date" value={feeDueDate} onChange={(e) => setFeeDueDate(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">Admission will proceed. Fee must be collected by this date.</p>
                  </div>
                )}
              </div>

              {/* Parent portal note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-0.5">Parent Portal Account</p>
                <p className="text-xs text-blue-600">
                  A parent portal account will be auto-created using the parent phone number <strong>{form.parentPhone}</strong>.
                  The system will generate a one-time password for you to share with the parent.
                </p>
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={confirmAdmission} disabled={confirming}
                className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
                {confirming ? 'Confirming...' : 'Confirm Admission & Create Portal Access'}
              </button>
              <button onClick={() => { setShowFeeStep(false); setError(null); }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {credentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                <h2 className="font-semibold text-gray-800">Admission Confirmed!</h2>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Admission No</p>
                  <p className="font-mono font-semibold text-gray-800">{credentials.admissionNo}</p>
                </div>
                {credentials.rollNo && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Roll No</p>
                    <p className="font-mono font-semibold text-gray-800">{credentials.rollNo}</p>
                  </div>
                )}
              </div>

              {credentials.parentCredentials.isNew ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">Parent Portal Credentials (share with parent)</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Email or Phone field</span>
                      <span className="font-mono font-medium text-gray-800">{credentials.parentCredentials.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Password (one-time)</span>
                      <span className="font-mono font-bold text-indigo-700 text-base tracking-widest">
                        {credentials.parentCredentials.generatedPassword}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    On the login page, enter the school code, use the phone number above in the &quot;Email or Phone&quot; field, and the password shown. Parent can change their password after first login.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    A parent account with phone <strong>{credentials.parentCredentials.phone}</strong> already existed and has been linked to this student.
                  </p>
                </div>
              )}

              {credentials.feePayment && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Fee Payment Recorded</p>
                  <p className="text-sm text-gray-700">
                    ₹{(credentials.feePayment as any).amount?.toLocaleString('en-IN')} — {(credentials.feePayment as any).feeHead?.name}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100">
              <button onClick={() => setCredentials(null)}
                className="w-full bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Profile Panel ── */}
      {profileStudent && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setProfileStudent(null)} />
          <div className="w-96 bg-white h-full shadow-xl flex flex-col overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">{profileStudent.firstName} {profileStudent.lastName}</h2>
                <p className="text-xs text-gray-400 font-mono">{profileStudent.admissionNo}</p>
              </div>
              <button onClick={() => setProfileStudent(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Class</p>
                <p className="text-gray-700">{(profileStudent.academicUnit as any)?.displayName || (profileStudent.academicUnit as any)?.name || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Parent</p>
                <p>{profileStudent.fatherName} / {profileStudent.motherName}</p>
                <p className="text-gray-500">{profileStudent.parentPhone}</p>
              </div>

              {/* Parent Portal Access */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Parent Portal Access</p>
                {profileStudent.parentUser ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-green-700">Linked & Active</p>
                        <p className="text-xs text-green-600 mt-0.5">
                          {profileStudent.parentUser.email || profileStudent.parentUser.phone || profileStudent.parentUser.id.slice(-8)}
                        </p>
                      </div>
                      <button onClick={() => handleUnlink(profileStudent.id, 'parent')} disabled={unlinking}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Unlink
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700">No parent portal account linked.</p>
                    <button onClick={() => { setProfileStudent(null); openLinkModal(profileStudent); }}
                      className="text-xs text-indigo-600 hover:underline mt-1">
                      Link manually →
                    </button>
                  </div>
                )}
              </div>

              {/* Student Portal Access */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Student Portal Access</p>
                {profileStudent.userAccount ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-green-700">Linked</p>
                      <p className="text-xs text-green-600">{profileStudent.userAccount.email || profileStudent.userAccount.phone}</p>
                    </div>
                    <button onClick={() => handleUnlink(profileStudent.id, 'student')} disabled={unlinking}
                      className="text-xs text-red-500 hover:text-red-700 font-medium">
                      Unlink
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Not linked (future scope)</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Link Modal ── */}
      {linkingStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-0.5">Link Portal Account</h2>
            <p className="text-xs text-gray-400 mb-4">
              Student: <span className="font-medium text-gray-700">{linkingStudent.firstName} {linkingStudent.lastName}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Account Type</label>
                <div className="flex gap-2">
                  {(['parent', 'student'] as const).map((t) => (
                    <button key={t} onClick={() => { setLinkType(t); setFoundUser(null); setLinkUserId(''); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        linkType === t ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}>
                      {t === 'student' ? 'Student Login' : 'Parent Login'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Search by Phone or Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Phone number or email"
                    value={linkSearch}
                    onChange={(e) => { setLinkSearch(e.target.value); setFoundUser(null); setLinkUserId(''); }}
                  />
                  <button
                    onClick={() => searchUserByIdentifier(linkSearch)}
                    disabled={searchingUser || !linkSearch.trim()}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                  >
                    {searchingUser ? '...' : 'Search'}
                  </button>
                </div>
                {linkType === 'parent' && linkingStudent.parentPhone && (
                  <p className="text-xs text-gray-400 mt-1">
                    Registered parent phone: <span className="font-medium">{linkingStudent.parentPhone}</span>
                  </p>
                )}
              </div>

              {/* Search result */}
              {foundUser === 'not_found' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  No account found with that phone/email. The parent may need to be registered first.
                </div>
              )}
              {foundUser && foundUser !== 'not_found' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-700">Account found</p>
                    <p className="text-xs text-green-600 mt-0.5">{foundUser.email || foundUser.phone}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ready to link</span>
                </div>
              )}
            </div>
            {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={handleLink} disabled={linking || !linkUserId}
                className="flex-1 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {linking ? 'Linking...' : 'Link Account'}
              </button>
              <button onClick={() => { setLinkingStudent(null); setError(null); }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
