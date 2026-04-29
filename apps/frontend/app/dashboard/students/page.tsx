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

  useEffect(() => {
    if (!value) { setD(''); setM(''); setY(''); return; }
    const p = value.split('-');
    setD(p[2] || ''); setM(p[1] || ''); setY(p[0] || '');
  }, [value]);

  const update = (day: string, mon: string, year: string) => {
    setD(day); setM(mon); setY(year);
    if (day && mon && year) onChange(`${year}-${mon.padStart(2,'0')}-${day.padStart(2,'0')}`);
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
  firstName: string; middleName?: string; lastName: string;
  dateOfBirth?: string; placeOfBirth?: string; gender?: string;
  phone?: string; email?: string; motherTongue?: string;
  fatherName?: string; fatherOccupation?: string; fatherQualification?: string; fatherEmail?: string; fatherAadhar?: string;
  motherName?: string; motherOccupation?: string; motherQualification?: string; motherEmail?: string; motherAadhar?: string;
  parentPhone?: string; secondaryPhone?: string;
  annualIncome?: string; isEwsCategory?: boolean;
  emergencyContactName?: string; emergencyContactRelation?: string; emergencyContactPhone?: string;
  address?: string; locality?: string; city?: string; state?: string; pinCode?: string;
  bloodGroup?: string; nationality?: string; religion?: string;
  casteCategory?: string; aadharNumber?: string;
  tcFromPrevious?: string; tcPreviousInstitution?: string;
  previousClass?: string; previousBoard?: string; previousMarks?: string;
  hasDisability?: boolean; disabilityDetails?: string; medicalConditions?: string;
  admissionDate?: string; academicUnitId?: string;
  status?: string; createdAt: string;
  academicUnit?: { id: string; name: string; displayName?: string };
  userAccount?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  parentUser?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
}

interface AcademicUnit { id: string; displayName?: string; name?: string; }
interface AcademicYear { id: string; name: string; isCurrent: boolean; }
interface FeeHead { id: string; name: string; }
interface FeeStructure { id: string; feeHeadId: string; amount: number; installmentName?: string; dueDate?: string; feeHead: FeeHead; }

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const QUALIFICATIONS = [
  'Below 10th','10th / SSC','12th / HSC','ITI / Diploma','Graduate (B.A./B.Sc./B.Com)',
  'Graduate (B.E./B.Tech)','Post Graduate','Doctorate (PhD)','Other',
];

const INCOME_BRACKETS = [
  'Below ₹1 Lakh','₹1–2 Lakh','₹2–5 Lakh','₹5–10 Lakh','Above ₹10 Lakh',
];

const emptyForm = {
  // Admission
  academicUnitId: '', admissionDate: new Date().toISOString().split('T')[0],
  // Personal
  firstName: '', middleName: '', lastName: '',
  dateOfBirth: '', placeOfBirth: '', gender: '', motherTongue: '',
  phone: '', email: '',
  aadharNumber: '', bloodGroup: '', nationality: 'Indian',
  // Father
  fatherName: '', fatherOccupation: '', fatherQualification: '', fatherEmail: '', fatherAadhar: '',
  // Mother
  motherName: '', motherOccupation: '', motherQualification: '', motherEmail: '', motherAadhar: '',
  // Contacts
  parentPhone: '', secondaryPhone: '',
  // Financial
  annualIncome: '', isEwsCategory: false,
  // Emergency
  emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '',
  // Address
  address: '', locality: '', city: '', state: '', pinCode: '',
  // Previous School
  tcFromPrevious: '', tcPreviousInstitution: '', previousClass: '', previousBoard: '', previousMarks: '',
  tcReceivedDate: '',
  // Demographics
  religion: '', casteCategory: '',
  // Health
  hasDisability: false, disabilityDetails: '', medicalConditions: '',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [isReady, setIsReady] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [academicUnits, setAcademicUnits] = useState<AcademicUnit[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const PAGE_SIZE = 50;

  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState('');

  // Fee step
  const [showFeeStep, setShowFeeStep] = useState(false);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feesPaid, setFeesPaid] = useState<'yes' | 'no' | 'partial'>('yes');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [feeDueDate, setFeeDueDate] = useState('');

  type FeeLineItem = { feeHeadId: string; name: string; structureAmount: number; amount: string; checked: boolean; };
  const [feeItems, setFeeItems] = useState<FeeLineItem[]>([]);
  const [confirming, setConfirming] = useState(false);

  const [credentials, setCredentials] = useState<{
    admissionNo: string; rollNo?: string;
    parentCredentials: { userId: string; phone?: string; isNew: boolean; generatedPassword?: string };
    feePayments?: { receiptNo?: string; amount: number; feeHead?: { name: string } }[];
  } | null>(null);

  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [unlinking, setUnlinking] = useState(false);
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

  const resetForm = () => {
    setForm({ ...emptyForm, admissionDate: new Date().toISOString().split('T')[0] });
    setEditingId(null);
    setError(null);
  };

  const sf = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const validate = () => {
    if (!form.firstName.trim()) return 'First name is required';
    if (!form.lastName.trim()) return 'Last name is required';
    if (!form.dateOfBirth) return 'Date of Birth is required';
    if (!form.gender) return 'Gender is required';
    if (!form.fatherName.trim()) return 'Father\'s name is required';
    if (!form.motherName.trim()) return 'Mother\'s name is required';
    if (!form.parentPhone.trim()) return 'Parent mobile number is required';
    if (!/^[6-9]\d{9}$/.test(form.parentPhone.trim())) return 'Parent mobile must be a valid 10-digit Indian number (starting with 6–9)';
    if (form.phone.trim() && !/^[6-9]\d{9}$/.test(form.phone.trim())) return 'Student mobile must be a valid 10-digit Indian number';
    if (form.secondaryPhone.trim() && !/^[6-9]\d{9}$/.test(form.secondaryPhone.trim())) return 'Mother\'s mobile must be a valid 10-digit Indian number';
    if (form.emergencyContactPhone.trim() && !/^[6-9]\d{9}$/.test(form.emergencyContactPhone.trim())) return 'Emergency contact must be a valid 10-digit Indian number';
    if (form.aadharNumber && !/^\d{12}$/.test(form.aadharNumber)) return 'Aadhar number must be exactly 12 digits';
    if (form.pinCode && !/^\d{6}$/.test(form.pinCode)) return 'PIN code must be exactly 6 digits';
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
    setPaymentMode('cash');
    setFeeDueDate('');
    setFeeItems([]);
    if (form.academicUnitId && currentYearId) {
      setLoadingFees(true);
      try {
        const res = await apiFetch(`/fees/structures?unitId=${form.academicUnitId}&yearId=${currentYearId}`);
        const structs: FeeStructure[] = Array.isArray(res) ? res : [];
        setFeeStructures(structs);
        if (structs.length > 0) {
          const items = structs.map((s) => ({
            feeHeadId: s.feeHeadId,
            name: s.feeHead.name + (s.installmentName ? ` (${s.installmentName})` : ''),
            structureAmount: s.amount,
            amount: '',
            checked: false,
          }));
          const admIdx = items.findIndex((i) => i.name.toLowerCase().includes('admission'));
          if (admIdx >= 0) { items[admIdx].checked = true; items[admIdx].amount = String(items[admIdx].structureAmount); }
          setFeeItems(items);
        } else {
          setFeeItems(feeHeads.map((fh) => ({ feeHeadId: fh.id, name: fh.name, structureAmount: 0, amount: '', checked: false })));
        }
      } catch { setFeeStructures([]); setFeeItems([]); } finally { setLoadingFees(false); }
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
        tcReceivedDate: form.tcReceivedDate || undefined,
        bloodGroup: form.bloodGroup || undefined,
        nationality: form.nationality || 'Indian',
        religion: form.religion.trim() || undefined,
        casteCategory: form.casteCategory || undefined,
        aadharNumber: form.aadharNumber.trim() || undefined,
        tcPreviousInstitution: form.tcPreviousInstitution.trim() || undefined,
        previousClass: form.previousClass.trim() || undefined,
        previousBoard: form.previousBoard.trim() || undefined,
        previousMarks: form.previousMarks.trim() || undefined,
        middleName: form.middleName.trim() || undefined,
        placeOfBirth: form.placeOfBirth.trim() || undefined,
        motherTongue: form.motherTongue.trim() || undefined,
        fatherOccupation: form.fatherOccupation.trim() || undefined,
        fatherQualification: form.fatherQualification || undefined,
        fatherEmail: form.fatherEmail.trim() || undefined,
        fatherAadhar: form.fatherAadhar.trim() || undefined,
        motherOccupation: form.motherOccupation.trim() || undefined,
        motherQualification: form.motherQualification || undefined,
        motherEmail: form.motherEmail.trim() || undefined,
        motherAadhar: form.motherAadhar.trim() || undefined,
        annualIncome: form.annualIncome || undefined,
        isEwsCategory: form.isEwsCategory,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactRelation: form.emergencyContactRelation.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        address: form.address.trim() || undefined,
        locality: form.locality.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
        pinCode: form.pinCode.trim() || undefined,
        hasDisability: form.hasDisability,
        disabilityDetails: form.hasDisability ? form.disabilityDetails.trim() || undefined : undefined,
        medicalConditions: form.medicalConditions.trim() || undefined,
      };

      if (feesPaid === 'yes' || feesPaid === 'partial') {
        const paidItems = feeItems.filter((i) => i.checked && parseFloat(i.amount) > 0);
        if (paidItems.length > 0) {
          payload.admissionFees = paidItems.map((i) => ({
            feeHeadId: i.feeHeadId,
            amountPaid: parseFloat(i.amount),
            paymentMode,
            academicYearId: currentYearId || undefined,
          }));
        }
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
      const msg: string = e.message || 'Admission failed';
      const isWakeUp = msg.toLowerCase().includes('waking up') || msg.toLowerCase().includes('unavailable');
      setError(isWakeUp ? 'Database is waking up — please wait 5 seconds and try again.' : msg);
    } finally {
      setConfirming(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingId(student.id);
    setError(null);
    setForm({
      academicUnitId: student.academicUnitId || '',
      admissionDate: student.admissionDate?.split('T')[0] || '',
      firstName: student.firstName || '', middleName: student.middleName || '', lastName: student.lastName || '',
      dateOfBirth: student.dateOfBirth?.split('T')[0] || '', placeOfBirth: student.placeOfBirth || '',
      gender: student.gender || '', motherTongue: student.motherTongue || '',
      phone: student.phone || '', email: student.email || '',
      aadharNumber: student.aadharNumber || '', bloodGroup: student.bloodGroup || '',
      nationality: student.nationality || 'Indian',
      fatherName: student.fatherName || '', fatherOccupation: student.fatherOccupation || '',
      fatherQualification: student.fatherQualification || '', fatherEmail: student.fatherEmail || '',
      fatherAadhar: student.fatherAadhar || '',
      motherName: student.motherName || '', motherOccupation: student.motherOccupation || '',
      motherQualification: student.motherQualification || '', motherEmail: student.motherEmail || '',
      motherAadhar: student.motherAadhar || '',
      parentPhone: student.parentPhone || '', secondaryPhone: student.secondaryPhone || '',
      annualIncome: student.annualIncome || '', isEwsCategory: student.isEwsCategory ?? false,
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactRelation: student.emergencyContactRelation || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
      address: student.address || '', locality: student.locality || '',
      city: student.city || '', state: student.state || '', pinCode: student.pinCode || '',
      religion: student.religion || '', casteCategory: student.casteCategory || '',
      tcFromPrevious: student.tcFromPrevious || '',
      tcPreviousInstitution: student.tcPreviousInstitution || '',
      tcReceivedDate: '',
      previousClass: student.previousClass || '', previousBoard: student.previousBoard || '',
      previousMarks: student.previousMarks || '',
      hasDisability: student.hasDisability ?? false,
      disabilityDetails: student.disabilityDetails || '',
      medicalConditions: student.medicalConditions || '',
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
          ...form,
          dateOfBirth: form.dateOfBirth || undefined,
          tcReceivedDate: form.tcReceivedDate || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          middleName: form.middleName.trim() || undefined,
          placeOfBirth: form.placeOfBirth.trim() || undefined,
          motherTongue: form.motherTongue.trim() || undefined,
          fatherOccupation: form.fatherOccupation.trim() || undefined,
          fatherQualification: form.fatherQualification || undefined,
          fatherEmail: form.fatherEmail.trim() || undefined,
          fatherAadhar: form.fatherAadhar.trim() || undefined,
          motherOccupation: form.motherOccupation.trim() || undefined,
          motherQualification: form.motherQualification || undefined,
          motherEmail: form.motherEmail.trim() || undefined,
          motherAadhar: form.motherAadhar.trim() || undefined,
          annualIncome: form.annualIncome || undefined,
          emergencyContactName: form.emergencyContactName.trim() || undefined,
          emergencyContactRelation: form.emergencyContactRelation.trim() || undefined,
          emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
          address: form.address.trim() || undefined,
          locality: form.locality.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state || undefined,
          pinCode: form.pinCode.trim() || undefined,
          previousClass: form.previousClass.trim() || undefined,
          previousBoard: form.previousBoard.trim() || undefined,
          previousMarks: form.previousMarks.trim() || undefined,
          religion: form.religion.trim() || undefined,
          casteCategory: form.casteCategory || undefined,
          aadharNumber: form.aadharNumber.trim() || undefined,
          bloodGroup: form.bloodGroup || undefined,
          hasDisability: form.hasDisability,
          disabilityDetails: form.hasDisability ? form.disabilityDetails.trim() || undefined : undefined,
          medicalConditions: form.medicalConditions.trim() || undefined,
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
      showSuccess(`${role} account unlinked`);
    } catch (e: any) { setError(e.message || 'Failed to unlink'); } finally { setUnlinking(false); }
  };

  const openLinkModal = async (student: Student) => {
    setLinkingStudent(student);
    setLinkUserId('');
    setLinkType('parent');
    setFoundUser(null);
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
      const id = identifier.trim();
      const isEmail = id.includes('@');
      const param = isEmail ? `email=${encodeURIComponent(id)}` : `phone=${encodeURIComponent(id)}`;
      const users = await apiFetch(`/users?${param}`) as { id: string; email?: string; phone?: string }[];
      const match = Array.isArray(users) && users.length > 0 ? users[0] : null;
      if (match) { setFoundUser({ id: match.id, email: match.email, phone: match.phone }); setLinkUserId(match.id); }
      else setFoundUser('not_found');
    } catch { } finally { setSearchingUser(false); }
  };

  const handleLink = async () => {
    if (!linkingStudent || !linkUserId) return;
    setLinking(true);
    try {
      await apiFetch(`/students/${linkingStudent.id}/link-user`, {
        method: 'POST', body: JSON.stringify({ userId: linkUserId, role: linkType }),
      });
      showSuccess(`${linkType} account linked`);
      setLinkingStudent(null);
      await fetchStudents();
    } catch (e: any) { setError(e.message || 'Failed to link'); } finally { setLinking(false); }
  };

  const handleAutoCreateAndLink = async () => {
    if (!linkingStudent) return;
    const phone = linkSearch.trim() || linkingStudent.parentPhone;
    if (!phone) { setError('No phone number available to create account'); return; }
    setLinking(true);
    setError(null);
    try {
      const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
      const lower = 'abcdefghjkmnpqrstuvwxyz';
      const digits = '23456789';
      const all = upper + lower + digits;
      const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
      const tempPwd = rand(upper) + rand(lower) + rand(digits) + Array.from({ length: 5 }, () => rand(all)).join('');
      const newUser = await apiFetch('/users', {
        method: 'POST', body: JSON.stringify({ phone, password: tempPwd, role: 'parent' }),
      }) as { id: string };
      await apiFetch(`/students/${linkingStudent.id}/link-user`, {
        method: 'POST', body: JSON.stringify({ userId: newUser.id, role: 'parent' }),
      });
      showSuccess(`Parent account created — Phone: ${phone} · Password: ${tempPwd}`);
      setLinkingStudent(null);
      await fetchStudents();
    } catch (e: any) { setError(e.message || 'Failed to create account'); } finally { setLinking(false); }
  };

  const filteredStudents = search.trim().length >= 1
    ? students.filter((s) => {
        const q = search.toLowerCase();
        return s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) || (s.parentPhone || '').includes(q);
      })
    : students;

  const totalFeeStructure = feeStructures.reduce((sum, s) => sum + s.amount, 0);
  const inp = 'border border-ds-border-strong p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';
  const lbl = 'text-xs font-medium text-ds-text2 block mb-1';
  const sec = 'text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-3 mt-1 pb-1 border-b border-ds-border';

  // ── Checkbox helper ──────────────────────────────────────────────────────
  const Checkbox = ({ checked, onChange, label, desc }: { checked: boolean; onChange: () => void; label: string; desc?: string }) => (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ? 'bg-ds-brand border-ds-brand' : 'border-ds-border-strong bg-ds-surface'}`}
        onClick={onChange}
      >
        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><polyline points="1.5,6 4.5,9 10.5,3" /></svg>}
      </div>
      <div>
        <span className="text-sm font-medium text-ds-text1">{label}</span>
        {desc && <p className="text-xs text-ds-text3 mt-0.5">{desc}</p>}
      </div>
    </label>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-6">Student Admission</h1>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* ── Admission Form ── */}
      <div className="bg-ds-surface shadow-sm rounded-xl p-6 mb-6 border border-ds-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-ds-text1">{editingId ? 'Edit Student Record' : 'Admission Form'}</h2>
            {!editingId && <p className="text-xs text-ds-text3 mt-0.5">Step 1 of 2 — Complete student details, then proceed to fee confirmation</p>}
          </div>
          {editingId && <button onClick={resetForm} className="text-sm text-ds-text2 hover:text-ds-text1 underline">Cancel Edit</button>}
        </div>

        {/* ── Section 1: Admission Details ── */}
        <p className={sec}>1. Admission Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>Class Admitted To *{academicUnits.length === 0 && <span className="text-red-500 ml-1">(no classes configured)</span>}</label>
            <select className={inp} value={form.academicUnitId} onChange={sf('academicUnitId')}>
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
            <label className={lbl}>Date of Admission</label>
            <DateSelect value={form.admissionDate} onChange={(v) => setForm({ ...form, admissionDate: v })} minYear={2000} maxYear={new Date().getFullYear()} />
          </div>
        </div>

        {/* ── Section 2: Student Personal Information ── */}
        <p className={sec}>2. Student Personal Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>First Name *</label>
            <input className={inp} placeholder="e.g. Priya" value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })} />
          </div>
          <div>
            <label className={lbl}>Middle Name</label>
            <input className={inp} placeholder="Optional" value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })} />
          </div>
          <div>
            <label className={lbl}>Last Name / Surname *</label>
            <input className={inp} placeholder="e.g. Sharma" value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })} />
          </div>
          <div>
            <label className={lbl}>Date of Birth *</label>
            <DateSelect value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} minYear={1990} maxYear={new Date().getFullYear() - 3} />
          </div>
          <div>
            <label className={lbl}>Place of Birth</label>
            <input className={inp} placeholder="City / Village" value={form.placeOfBirth} onChange={sf('placeOfBirth')} />
          </div>
          <div>
            <label className={lbl}>Gender *</label>
            <select className={inp} value={form.gender} onChange={sf('gender')}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / Third Gender</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Mother Tongue</label>
            <input className={inp} placeholder="e.g. Hindi, Marathi, Tamil" value={form.motherTongue} onChange={sf('motherTongue')} />
          </div>
          <div>
            <label className={lbl}>Blood Group</label>
            <select className={inp} value={form.bloodGroup} onChange={sf('bloodGroup')}>
              <option value="">Select</option>
              {['A+','A−','B+','B−','AB+','AB−','O+','O−'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Aadhar Number (Student)</label>
            <input className={inp} placeholder="12-digit Aadhar" inputMode="numeric" maxLength={12}
              value={form.aadharNumber}
              onChange={(e) => setForm({ ...form, aadharNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })} />
          </div>
          <div>
            <label className={lbl}>Student Mobile</label>
            <input className={inp} placeholder="Optional, for Class 9+" inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
          </div>
          <div>
            <label className={lbl}>Student Email</label>
            <input className={inp} type="email" placeholder="Optional" value={form.email} onChange={sf('email')} />
          </div>
          <div>
            <label className={lbl}>Nationality</label>
            <input className={inp} value={form.nationality} onChange={sf('nationality')} />
          </div>
        </div>

        {/* ── Section 3: Previous School ── */}
        <p className={sec}>3. Previous School Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>TC Status</label>
            <select className={inp} value={form.tcFromPrevious} onChange={sf('tcFromPrevious')}>
              <option value="">Auto-detect by class</option>
              <option value="not_applicable">Not Applicable (Class 1 / New Entry)</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="waived">Waived by Principal</option>
            </select>
          </div>
          <div>
            <label className={lbl}>TC Received Date</label>
            <DateSelect value={form.tcReceivedDate} onChange={(v) => setForm({ ...form, tcReceivedDate: v })} minYear={2000} maxYear={new Date().getFullYear()} />
          </div>
          <div className="sm:col-span-1">
            <label className={lbl}>Previous School Name</label>
            <input className={inp} placeholder="Name of previous school" value={form.tcPreviousInstitution} onChange={sf('tcPreviousInstitution')} />
          </div>
          <div>
            <label className={lbl}>Class Last Studied</label>
            <input className={inp} placeholder="e.g. Class 5, KG-II" value={form.previousClass} onChange={sf('previousClass')} />
          </div>
          <div>
            <label className={lbl}>Previous Board</label>
            <select className={inp} value={form.previousBoard} onChange={sf('previousBoard')}>
              <option value="">Select Board</option>
              {['CBSE','ICSE / ISC','State Board','IB (International Baccalaureate)','IGCSE','NIOS','Other'].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Last Exam Marks / Grade</label>
            <input className={inp} placeholder="e.g. 85% or Grade A" value={form.previousMarks} onChange={sf('previousMarks')} />
          </div>
        </div>

        {/* ── Section 4: Father's Information ── */}
        <p className={sec}>4. Father&apos;s Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>Father&apos;s Full Name *</label>
            <input className={inp} placeholder="As per official records" value={form.fatherName}
              onChange={(e) => setForm({ ...form, fatherName: e.target.value.replace(/[^a-zA-Z\s.]/g, '') })} />
          </div>
          <div>
            <label className={lbl}>Occupation</label>
            <input className={inp} placeholder="e.g. Engineer, Farmer, Business" value={form.fatherOccupation} onChange={sf('fatherOccupation')} />
          </div>
          <div>
            <label className={lbl}>Qualification</label>
            <select className={inp} value={form.fatherQualification} onChange={sf('fatherQualification')}>
              <option value="">Select</option>
              {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Mobile Number (Primary Contact) *</label>
            <input className={inp} placeholder="10-digit mobile" inputMode="numeric" maxLength={10}
              value={form.parentPhone}
              onChange={(e) => setForm({ ...form, parentPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
            <p className="text-xs text-ds-text3 mt-0.5">Used for parent portal login</p>
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input className={inp} type="email" placeholder="Optional" value={form.fatherEmail} onChange={sf('fatherEmail')} />
          </div>
          <div>
            <label className={lbl}>Aadhar Number</label>
            <input className={inp} placeholder="12-digit Aadhar" inputMode="numeric" maxLength={12}
              value={form.fatherAadhar}
              onChange={(e) => setForm({ ...form, fatherAadhar: e.target.value.replace(/\D/g, '').slice(0, 12) })} />
          </div>
        </div>

        {/* ── Section 5: Mother's Information ── */}
        <p className={sec}>5. Mother&apos;s Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>Mother&apos;s Full Name *</label>
            <input className={inp} placeholder="As per official records" value={form.motherName}
              onChange={(e) => setForm({ ...form, motherName: e.target.value.replace(/[^a-zA-Z\s.]/g, '') })} />
          </div>
          <div>
            <label className={lbl}>Occupation</label>
            <input className={inp} placeholder="e.g. Teacher, Homemaker, Doctor" value={form.motherOccupation} onChange={sf('motherOccupation')} />
          </div>
          <div>
            <label className={lbl}>Qualification</label>
            <select className={inp} value={form.motherQualification} onChange={sf('motherQualification')}>
              <option value="">Select</option>
              {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Mobile Number</label>
            <input className={inp} placeholder="Optional secondary contact" inputMode="numeric" maxLength={10}
              value={form.secondaryPhone}
              onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input className={inp} type="email" placeholder="Optional" value={form.motherEmail} onChange={sf('motherEmail')} />
          </div>
          <div>
            <label className={lbl}>Aadhar Number</label>
            <input className={inp} placeholder="12-digit Aadhar" inputMode="numeric" maxLength={12}
              value={form.motherAadhar}
              onChange={(e) => setForm({ ...form, motherAadhar: e.target.value.replace(/\D/g, '').slice(0, 12) })} />
          </div>
        </div>

        {/* ── Section 6: Emergency Contact ── */}
        <p className={sec}>6. Emergency Contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>Contact Person Name</label>
            <input className={inp} placeholder="Full name" value={form.emergencyContactName} onChange={sf('emergencyContactName')} />
          </div>
          <div>
            <label className={lbl}>Relation to Student</label>
            <input className={inp} placeholder="e.g. Grandmother, Uncle" value={form.emergencyContactRelation} onChange={sf('emergencyContactRelation')} />
          </div>
          <div>
            <label className={lbl}>Mobile Number</label>
            <input className={inp} placeholder="10-digit mobile" inputMode="numeric" maxLength={10}
              value={form.emergencyContactPhone}
              onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
          </div>
        </div>

        {/* ── Section 7: Residential Address ── */}
        <p className={sec}>7. Residential Address</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="sm:col-span-2">
            <label className={lbl}>House No / Flat / Street</label>
            <input className={inp} placeholder="e.g. 12/A, MG Road, Near Bus Stand" value={form.address} onChange={sf('address')} />
          </div>
          <div>
            <label className={lbl}>Locality / Colony / Village</label>
            <input className={inp} placeholder="e.g. Andheri East, Sector 15" value={form.locality} onChange={sf('locality')} />
          </div>
          <div>
            <label className={lbl}>City / Town</label>
            <input className={inp} placeholder="e.g. Mumbai, Pune" value={form.city} onChange={sf('city')} />
          </div>
          <div>
            <label className={lbl}>State</label>
            <select className={inp} value={form.state} onChange={sf('state')}>
              <option value="">Select State / UT</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>PIN Code</label>
            <input className={inp} placeholder="6-digit PIN" inputMode="numeric" maxLength={6}
              value={form.pinCode}
              onChange={(e) => setForm({ ...form, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
          </div>
        </div>

        {/* ── Section 8: Social & Demographic ── */}
        <p className={sec}>8. Social &amp; Demographic Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>Religion</label>
            <select className={inp} value={form.religion} onChange={sf('religion')}>
              <option value="">Select</option>
              {['Hindu','Muslim','Christian','Sikh','Buddhist','Jain','Parsi','Other'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Caste Category</label>
            <select className={inp} value={form.casteCategory} onChange={sf('casteCategory')}>
              <option value="">Select</option>
              {['General','OBC','SC','ST','NT','SBC','VJ/DT','EWS'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Annual Family Income</label>
            <select className={inp} value={form.annualIncome} onChange={sf('annualIncome')}>
              <option value="">Select bracket</option>
              {INCOME_BRACKETS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <p className="text-xs text-ds-text3 mt-0.5">Required for scholarships &amp; concessions</p>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-ds-border bg-ds-bg2 mb-6">
          <Checkbox
            checked={form.isEwsCategory}
            onChange={() => setForm({ ...form, isEwsCategory: !form.isEwsCategory })}
            label="Economically Weaker Section (EWS)"
            desc="Student belongs to EWS category and may be eligible for RTE 25% quota or fee waiver"
          />
        </div>

        {/* ── Section 9: Health & Medical ── */}
        <p className={sec}>9. Health &amp; Medical Information</p>
        <div className="space-y-4 mb-6">
          <div>
            <label className={lbl}>Known Medical Conditions / Allergies</label>
            <input className={inp} placeholder="e.g. Asthma, Peanut allergy, Epilepsy, or None" value={form.medicalConditions} onChange={sf('medicalConditions')} />
          </div>
          <div className="p-4 rounded-lg border border-ds-border bg-ds-bg2">
            <Checkbox
              checked={form.hasDisability}
              onChange={() => setForm({ ...form, hasDisability: !form.hasDisability, disabilityDetails: !form.hasDisability ? form.disabilityDetails : '' })}
              label="Student has a disability (CWSN)"
              desc="Children With Special Needs — visual, hearing, locomotor, cognitive, or learning disability"
            />
            {form.hasDisability && (
              <div className="mt-3">
                <label className={lbl}>Disability Details</label>
                <input className={inp}
                  placeholder="e.g. Visual impairment (low vision), Hearing loss (moderate), Dyslexia, Cerebral Palsy"
                  value={form.disabilityDetails}
                  onChange={(e) => setForm({ ...form, disabilityDetails: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-2">
          {editingId ? (
            <div className="flex gap-3">
              <button onClick={handleUpdate} disabled={updating} className="flex-1 btn-brand px-4 py-2.5 rounded-lg">
                {updating ? 'Updating...' : 'Update Student Record'}
              </button>
              <button onClick={resetForm} className="px-6 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
            </div>
          ) : (
            <button onClick={openFeeStep} className="btn-brand w-full px-4 py-2.5 rounded-lg">
              Next: Fee &amp; Confirm Admission →
            </button>
          )}
        </div>
      </div>

      {/* ── Recently Admitted ── */}
      <div className="bg-ds-surface shadow-sm rounded-xl border border-ds-border overflow-hidden">
        <div className="px-6 py-4 border-b border-ds-border flex items-center justify-between">
          <div>
            <h2 className="font-medium text-ds-text1">Recently Admitted</h2>
            <p className="text-xs text-ds-text3 mt-0.5">Last 10 admissions</p>
          </div>
          <Link href="/dashboard/students/directory" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Student Directory →
          </Link>
        </div>
        <div className="px-4 py-3 border-b border-ds-border">
          <input className={`${inp} max-w-sm`} placeholder="Search by name, admission no, or phone..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="p-8 text-center text-ds-text3 text-sm">Loading...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-ds-text3 text-sm">No students found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ds-bg2">
              <tr>
                {['Adm. No','Name','Class','Parent Mobile','Portal','Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {[...filteredStudents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10).map((s) => {
                  const unit = academicUnits.find((u) => u.id === s.academicUnitId) || s.academicUnit;
                  const hasParent = !!s.parentUser;
                  return (
                    <tr key={s.id} className="hover:bg-ds-bg2 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-ds-text2">{s.admissionNo}</td>
                      <td className="px-4 py-3 font-medium text-ds-text1">
                        <button onClick={() => setProfileStudent(s)} className="hover:underline text-left">
                          {s.firstName} {s.middleName ? `${s.middleName} ` : ''}{s.lastName}
                        </button>
                        {s.gender && <div className="text-xs text-ds-text3 capitalize">{s.gender}</div>}
                      </td>
                      <td className="px-4 py-3 text-ds-text2 text-xs">{(unit as any)?.displayName || (unit as any)?.name || '—'}</td>
                      <td className="px-4 py-3 text-ds-text2 text-xs">{s.parentPhone || '—'}</td>
                      <td className="px-4 py-3">
                        {hasParent ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-ds-success-text border border-green-200 rounded-full px-2 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            Parent linked
                          </span>
                        ) : (
                          <span className="text-xs text-ds-warning-text bg-ds-warning-bg border border-ds-warning-border rounded-full px-2 py-0.5">No portal</span>
                        )}
                      </td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => openLinkModal(s)} className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">
                          {hasParent ? 'Re-link' : 'Link Parent'}
                        </button>
                        <button onClick={() => handleEdit(s)} className="text-ds-text2 hover:text-ds-text1 font-medium text-xs">Edit</button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
        {!loading && students.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ds-border text-sm text-ds-text2">
            <span>Page {page}{totalStudents > 0 && ` · ${totalStudents} total students`}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-ds-border disabled:opacity-40 hover:bg-ds-bg2">← Prev</button>
              <button disabled={students.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-ds-border disabled:opacity-40 hover:bg-ds-bg2">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Step 2: Fee & Confirmation Modal ── */}
      {showFeeStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-ds-surface rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-ds-border">
              <h2 className="font-semibold text-ds-text1">Step 2 — Fee &amp; Admission Confirmation</h2>
              <p className="text-xs text-ds-text3 mt-0.5">
                Admitting: <span className="font-medium text-ds-text1">{form.firstName} {form.middleName ? `${form.middleName} ` : ''}{form.lastName}</span>
                {form.academicUnitId && ` → ${academicUnits.find((u) => u.id === form.academicUnitId)?.displayName || ''}`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {loadingFees ? (
                <p className="text-sm text-ds-text3">Loading fee structure...</p>
              ) : feeStructures.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-2">Class Fee Structure</p>
                  <div className="bg-ds-bg2 rounded-lg divide-y divide-ds-border text-sm">
                    {feeStructures.map((s) => (
                      <div key={s.id} className="flex justify-between px-4 py-2.5">
                        <span className="text-ds-text1">{s.feeHead.name}{s.installmentName ? ` (${s.installmentName})` : ''}</span>
                        <span className="font-medium text-ds-text1">₹{s.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-2.5 font-semibold">
                      <span>Total Due</span>
                      <span>₹{totalFeeStructure.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 text-xs text-ds-warning-text">
                  No fee structure configured for this class. Set it up in the Fees section after admission.
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-3">Admission Fee Payment</p>
                <div className="flex gap-2 mb-4">
                  {[{ val: 'yes', label: 'Paid in Full' }, { val: 'partial', label: 'Partial Payment' }, { val: 'no', label: 'Due Later' }].map((opt) => (
                    <button key={opt.val} onClick={() => setFeesPaid(opt.val as any)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${feesPaid === opt.val ? 'bg-ds-brand text-white border-ds-brand-dark' : 'bg-ds-surface text-ds-text2 border-ds-border-strong hover:border-gray-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(feesPaid === 'yes' || feesPaid === 'partial') && (
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>Select Fees Being Paid</label>
                      <div className="space-y-2 mt-1">
                        {feeItems.map((item, idx) => (
                          <div key={item.feeHeadId} className={`rounded-lg border transition-colors ${item.checked ? 'border-gray-800 bg-ds-bg2' : 'border-ds-border bg-ds-surface'}`}>
                            <div className="flex items-center justify-between px-4 py-3 cursor-pointer"
                              onClick={() => setFeeItems((prev) => prev.map((it, i) =>
                                i === idx ? { ...it, checked: !it.checked, amount: !it.checked && it.structureAmount ? String(it.structureAmount) : it.amount } : it
                              ))}>
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${item.checked ? 'bg-ds-brand border-ds-brand' : 'border-ds-border-strong'}`}>
                                  {item.checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><polyline points="1.5,6 4.5,9 10.5,3" /></svg>}
                                </div>
                                <span className="text-sm font-medium text-ds-text1">{item.name}</span>
                              </div>
                              {item.structureAmount > 0 && <span className="text-sm text-ds-text2">₹{item.structureAmount.toLocaleString('en-IN')}</span>}
                            </div>
                            {item.checked && (
                              <div className="px-4 pb-3">
                                <input type="number" className={inp} placeholder="Amount paid (₹)" value={item.amount}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setFeeItems((prev) => prev.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {feeItems.some((i) => i.checked) && (
                        <div className="mt-2 flex justify-between text-sm font-semibold text-ds-text1 px-1">
                          <span>Total collecting now</span>
                          <span>₹{feeItems.filter((i) => i.checked).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                    {feeItems.some((i) => i.checked) && (
                      <div>
                        <label className={lbl}>Payment Mode</label>
                        <select className={inp} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                          {['cash','upi','cheque','dd','neft'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                {feesPaid === 'no' && (
                  <div>
                    <label className={lbl}>Fee Due Date</label>
                    <input className={inp} type="date" value={feeDueDate} onChange={(e) => setFeeDueDate(e.target.value)} />
                    <p className="text-xs text-ds-text3 mt-1">Admission proceeds. Fee must be collected by this date.</p>
                  </div>
                )}
              </div>

              <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3">
                <p className="text-xs font-semibold text-ds-info-text mb-0.5">Parent Portal Account</p>
                <p className="text-xs text-ds-brand">
                  A parent portal account will be auto-created using <strong>{form.parentPhone}</strong> as the login.
                  A one-time password will be generated for you to share.
                </p>
              </div>
              {error && <p className="text-ds-error-text text-sm">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-ds-border flex gap-3">
              <button onClick={confirmAdmission} disabled={confirming} className="btn-brand flex-1 py-2.5 rounded-lg">
                {confirming ? 'Confirming...' : 'Confirm Admission & Create Portal Access'}
              </button>
              <button onClick={() => { setShowFeeStep(false); setError(null); }} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {credentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-ds-surface rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-ds-border">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                <h2 className="font-semibold text-ds-text1">Admission Confirmed!</h2>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ds-bg2 rounded-lg p-3">
                  <p className="text-xs text-ds-text2 mb-0.5">Admission No</p>
                  <p className="font-mono font-semibold text-ds-text1">{credentials.admissionNo}</p>
                </div>
                {credentials.rollNo && (
                  <div className="bg-ds-bg2 rounded-lg p-3">
                    <p className="text-xs text-ds-text2 mb-0.5">Roll No</p>
                    <p className="font-mono font-semibold text-ds-text1">{credentials.rollNo}</p>
                  </div>
                )}
              </div>
              {credentials.parentCredentials.isNew ? (
                <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-4">
                  <p className="text-xs font-semibold text-ds-success-text mb-2 uppercase tracking-wider">Parent Portal Credentials (share with parent)</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ds-text2">Login (Phone)</span>
                      <span className="font-mono font-medium text-ds-text1">{credentials.parentCredentials.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ds-text2">Password (one-time)</span>
                      <span className="font-mono font-bold text-indigo-700 text-base tracking-widest">{credentials.parentCredentials.generatedPassword}</span>
                    </div>
                  </div>
                  <p className="text-xs text-ds-success-text mt-2">Parent can change their password after first login.</p>
                </div>
              ) : (
                <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3">
                  <p className="text-xs text-ds-info-text">
                    Existing parent account (<strong>{credentials.parentCredentials.phone}</strong>) has been linked to this student.
                  </p>
                </div>
              )}
              {credentials.feePayments && credentials.feePayments.length > 0 && (
                <div className="bg-ds-bg2 rounded-lg p-3">
                  <p className="text-xs font-semibold text-ds-text2 mb-2">Fee Payments Recorded</p>
                  <div className="space-y-1.5">
                    {credentials.feePayments.map((fp, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-ds-text2">{fp.feeHead?.name ?? 'Fee'}</span>
                        <span className="font-semibold text-ds-text1">₹{fp.amount?.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold pt-1 border-t border-ds-border mt-1">
                      <span>Total collected</span>
                      <span>₹{credentials.feePayments.reduce((s, fp) => s + (fp.amount || 0), 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3">
                <p className="text-xs font-semibold text-ds-warning-text mb-1">Next Steps</p>
                <ul className="text-xs text-ds-warning-text space-y-1 list-disc list-inside">
                  <li>Go to <strong>Fees → Fee Structures</strong> to set up the full fee plan for this class</li>
                  {(!credentials.feePayments || credentials.feePayments.length === 0) && <li>No fee was recorded — add it from the Fees page</li>}
                </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-ds-border">
              <button onClick={() => setCredentials(null)} className="btn-brand w-full py-2.5 rounded-lg">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Profile Panel ── */}
      {profileStudent && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setProfileStudent(null)} />
          <div className="w-96 bg-ds-surface h-full shadow-xl flex flex-col overflow-y-auto">
            <div className="px-6 py-5 border-b border-ds-border flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-ds-text1">{profileStudent.firstName} {profileStudent.middleName ? `${profileStudent.middleName} ` : ''}{profileStudent.lastName}</h2>
                <p className="text-xs text-ds-text3 font-mono">{profileStudent.admissionNo}</p>
              </div>
              <button onClick={() => setProfileStudent(null)} className="text-ds-text3 hover:text-ds-text2 text-xl">×</button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">Class</p>
                <p className="text-ds-text1">{(profileStudent.academicUnit as any)?.displayName || (profileStudent.academicUnit as any)?.name || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">Parents</p>
                <p>{profileStudent.fatherName} / {profileStudent.motherName}</p>
                <p className="text-ds-text2">{profileStudent.parentPhone}{profileStudent.secondaryPhone ? ` · ${profileStudent.secondaryPhone}` : ''}</p>
              </div>
              {profileStudent.city && (
                <div>
                  <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">Address</p>
                  <p className="text-ds-text2 text-xs">{[profileStudent.address, profileStudent.locality, profileStudent.city, profileStudent.state, profileStudent.pinCode].filter(Boolean).join(', ')}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-2">Parent Portal</p>
                {profileStudent.parentUser ? (
                  <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-ds-success-text">Linked & Active</p>
                      <p className="text-xs text-ds-success-text mt-0.5">{profileStudent.parentUser.email || profileStudent.parentUser.phone || profileStudent.parentUser.id.slice(-8)}</p>
                    </div>
                    <button onClick={() => handleUnlink(profileStudent.id, 'parent')} disabled={unlinking} className="text-xs text-red-500 hover:text-ds-error-text font-medium">Unlink</button>
                  </div>
                ) : (
                  <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3">
                    <p className="text-xs text-ds-warning-text">No parent portal account linked.</p>
                    <button onClick={() => { setProfileStudent(null); openLinkModal(profileStudent); }} className="text-xs text-indigo-600 hover:underline mt-1">Link manually →</button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-2">Student Portal</p>
                {profileStudent.userAccount ? (
                  <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-ds-success-text">Linked</p>
                      <p className="text-xs text-ds-success-text">{profileStudent.userAccount.email || profileStudent.userAccount.phone}</p>
                    </div>
                    <button onClick={() => handleUnlink(profileStudent.id, 'student')} disabled={unlinking} className="text-xs text-red-500 hover:text-ds-error-text font-medium">Unlink</button>
                  </div>
                ) : (
                  <p className="text-xs text-ds-text3">Not linked</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Link Modal ── */}
      {linkingStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-ds-surface rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-ds-text1 mb-0.5">Link Portal Account</h2>
            <p className="text-xs text-ds-text3 mb-4">Student: <span className="font-medium text-ds-text1">{linkingStudent.firstName} {linkingStudent.lastName}</span></p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Account Type</label>
                <div className="flex gap-2">
                  {(['parent','student'] as const).map((t) => (
                    <button key={t} onClick={() => { setLinkType(t); setFoundUser(null); setLinkUserId(''); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${linkType === t ? 'bg-ds-brand text-white border-ds-brand-dark' : 'bg-ds-surface text-ds-text2 border-ds-border-strong hover:border-gray-400'}`}>
                      {t === 'student' ? 'Student Login' : 'Parent Login'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ds-text2 block mb-1">Search by Phone or Email</label>
                <div className="flex gap-2">
                  <input type="text" className="flex-1 p-2.5 border border-ds-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand"
                    placeholder="Phone or email" value={linkSearch}
                    onChange={(e) => { setLinkSearch(e.target.value); setFoundUser(null); setLinkUserId(''); }} />
                  <button onClick={() => searchUserByIdentifier(linkSearch)} disabled={searchingUser || !linkSearch.trim()}
                    className="px-4 py-2 btn-brand rounded-lg text-sm font-medium disabled:opacity-50">
                    {searchingUser ? '...' : 'Search'}
                  </button>
                </div>
                {linkType === 'parent' && linkingStudent.parentPhone && (
                  <p className="text-xs text-ds-text3 mt-1">Registered parent phone: <span className="font-medium">{linkingStudent.parentPhone}</span></p>
                )}
              </div>
              {foundUser === 'not_found' && (
                <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 text-xs text-ds-warning-text space-y-2">
                  <p>No account found. You can auto-create one using the phone number above.</p>
                  {linkType === 'parent' && (
                    <button onClick={handleAutoCreateAndLink} disabled={linking}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {linking ? 'Creating…' : 'Create Parent Account & Link'}
                    </button>
                  )}
                </div>
              )}
              {foundUser && foundUser !== 'not_found' && (
                <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-ds-success-text">Account found</p>
                    <p className="text-xs text-ds-success-text mt-0.5">{foundUser.email || foundUser.phone}</p>
                  </div>
                  <span className="text-xs bg-ds-success-bg text-ds-success-text px-2 py-0.5 rounded-full font-medium">Ready to link</span>
                </div>
              )}
            </div>
            {error && <p className="text-ds-error-text text-xs mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={handleLink} disabled={linking || !linkUserId} className="flex-1 py-2.5 btn-brand rounded-lg disabled:opacity-50">
                {linking ? 'Linking...' : 'Link Account'}
              </button>
              <button onClick={() => { setLinkingStudent(null); setError(null); }} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm text-ds-text2 hover:bg-ds-bg2">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
