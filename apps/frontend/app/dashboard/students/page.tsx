'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
interface FeePlanInstallment { id: string; label: string; amount: number; dueDate?: string; }
interface FeePlanItem { id: string; feeCategoryId: string; feeCategory: { id: string; name: string }; totalAmount: number; installments: FeePlanInstallment[]; }
interface FeePlan { id: string; name: string; items: FeePlanItem[]; }

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

// ── Draft helpers ──────────────────────────────────────────────────────────────
interface AdmissionDraft {
  id: string;
  savedAt: string;
  label: string;
  form: typeof emptyForm;
  yearId: string;
}

function draftKey(institutionId: string) {
  return `admission-drafts-${institutionId}`;
}
function loadDraftsFromStorage(institutionId: string): AdmissionDraft[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(draftKey(institutionId)) ?? '[]'); }
  catch { return []; }
}
function saveDraftsToStorage(institutionId: string, drafts: AdmissionDraft[]) {
  localStorage.setItem(draftKey(institutionId), JSON.stringify(drafts));
}

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
  const [activePlan, setActivePlan] = useState<FeePlan | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [collectNow, setCollectNow] = useState(true);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [feeDueDate, setFeeDueDate] = useState('');
  const [existingParentInfo, setExistingParentInfo] = useState<{ phone: string } | null>(null);

  // Extended FeeLineItem supports both old (feeHeadId) and new (feePlanItemId) systems
  type FeeLineItem = {
    feeHeadId?: string;           // legacy
    feePlanItemId?: string;       // new plan system
    feePlanInstallmentId?: string;// new plan system (if installment-based)
    feeCategoryId?: string;       // new plan system
    name: string;
    structureAmount: number;
    amount: string;
    checked: boolean;
  };
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

  // ── Drafts ────────────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<AdmissionDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs that always hold the latest values — used in beforeunload and unmount
  // handlers where closures would otherwise capture stale state.
  const formRef            = useRef(form);
  const editingIdRef       = useRef(editingId);
  const activeDraftIdRef   = useRef(activeDraftId);
  const currentYearIdRef   = useRef(currentYearId);
  const academicUnitsRef   = useRef(academicUnits);

  // ── Ledger import ────────────────────────────────────────────────────────
  type ImportRow = {
    firstName: string; lastName: string; middleName?: string; gender?: string;
    dateOfBirth?: string; className: string; oldAdmissionNo?: string;
    admissionDate?: string; fatherName?: string; motherName?: string;
    parentPhone?: string; address?: string; religion?: string;
    casteCategory?: string; bloodGroup?: string;
    _rowNum: number; _errors: string[];
  };
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; error: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => { setIsReady(true); }, []);

  // Keep refs in sync with latest state so unmount/beforeunload handlers are never stale
  useEffect(() => { formRef.current          = form;          }, [form]);
  useEffect(() => { editingIdRef.current     = editingId;     }, [editingId]);
  useEffect(() => { activeDraftIdRef.current = activeDraftId; }, [activeDraftId]);
  useEffect(() => { currentYearIdRef.current = currentYearId; }, [currentYearId]);
  useEffect(() => { academicUnitsRef.current = academicUnits; }, [academicUnits]);

  // Load drafts from localStorage on mount
  useEffect(() => {
    if (user?.institutionId) setDrafts(loadDraftsFromStorage(user.institutionId));
  }, [user?.institutionId]);

  // Auto-save draft every 60 s when the form has content (only for new admissions)
  useEffect(() => {
    if (editingId || !form.firstName.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDraft(true), 60_000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [form, editingId, saveDraft]);

  // ── Save on navigation away (unmount) and on browser refresh ─────────────
  // Uses refs so the handlers always see current state, not stale closures.
  const saveFromRefs = useCallback(() => {
    const institutionId = user?.institutionId;
    if (!institutionId || editingIdRef.current) return;
    const f = formRef.current;
    if (!f.firstName.trim()) return;
    const existing = loadDraftsFromStorage(institutionId);
    const id = activeDraftIdRef.current ?? `draft-${Date.now()}`;
    const label = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(' ').trim() || 'Unnamed Student';
    const unit  = academicUnitsRef.current.find((u) => u.id === f.academicUnitId);
    const cls   = unit?.displayName ?? unit?.name ?? '';
    const draft: AdmissionDraft = { id, savedAt: new Date().toISOString(), label: cls ? `${label} — ${cls}` : label, form: f, yearId: currentYearIdRef.current };
    saveDraftsToStorage(institutionId, [draft, ...existing.filter((d) => d.id !== id)]);
  }, [user?.institutionId]);

  // Fires when the SPA navigates away (component unmounts)
  useEffect(() => () => { saveFromRefs(); }, [saveFromRefs]);

  // Fires on browser refresh / tab close
  useEffect(() => {
    window.addEventListener('beforeunload', saveFromRefs);
    return () => window.removeEventListener('beforeunload', saveFromRefs);
  }, [saveFromRefs]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const fetchStudents = useCallback(async (p = page) => {
    try {
      const res = await apiFetch(`/students?page=${p}&limit=${PAGE_SIZE}`) as any;
      setStudents(res.data || res || []);
      const total = res.meta?.total ?? res.total;
      if (total !== undefined) setTotalStudents(total);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!isReady || !user?.institutionId) return;
    Promise.allSettled([
      apiFetch(`/students?page=${page}&limit=${PAGE_SIZE}`),
      apiFetch('/academic/units/classes'),
      apiFetch('/academic/years'),
      apiFetch('/fees/heads'),
    ]).then(([s, u, y, fh]) => {
      if (s.status === 'fulfilled') {
        const sr = s.value as any;
        setStudents(sr.data || sr || []);
        const total = sr.meta?.total ?? sr.total;
        if (total !== undefined) setTotalStudents(total);
      } else {
        setError(s.reason?.message || 'Failed to load students');
      }
      if (u.status === 'fulfilled') setAcademicUnits(Array.isArray(u.value) ? u.value : []);
      if (y.status === 'fulfilled') {
        const years: AcademicYear[] = Array.isArray(y.value) ? y.value : [];
        setAcademicYears(years);
        const cur = years.find((yr) => yr.isCurrent);
        if (cur) setCurrentYearId(cur.id);
      }
      if (fh.status === 'fulfilled') setFeeHeads(Array.isArray(fh.value) ? fh.value : []);
    }).finally(() => setLoading(false));
  }, [isReady, user?.institutionId, page]);

  const resetForm = () => {
    setForm({ ...emptyForm, admissionDate: new Date().toISOString().split('T')[0] });
    setEditingId(null);
    setActiveDraftId(null);
    setDraftSaved(false);
    setError(null);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  };

  // ── Draft functions ────────────────────────────────────────────────────────
  const saveDraft = useCallback((silent = false) => {
    if (!user?.institutionId) return;
    if (!form.firstName.trim()) { if (!silent) setError('Enter at least the student\'s first name before saving as draft.'); return; }
    const existing = loadDraftsFromStorage(user.institutionId);
    const id = activeDraftId ?? `draft-${Date.now()}`;
    const label = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ').trim()
      || 'Unnamed Student';
    const className = academicUnits.find((u) => u.id === form.academicUnitId)?.displayName ?? '';
    const draft: AdmissionDraft = { id, savedAt: new Date().toISOString(), label: className ? `${label} — ${className}` : label, form: { ...form }, yearId: currentYearId };
    const updated = [draft, ...existing.filter((d) => d.id !== id)];
    saveDraftsToStorage(user.institutionId, updated);
    setDrafts(updated);
    setActiveDraftId(id);
    if (!silent) { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2500); }
  }, [form, activeDraftId, user?.institutionId, academicUnits, currentYearId]);

  const loadDraft = (draft: AdmissionDraft) => {
    setForm({ ...draft.form });
    setActiveDraftId(draft.id);
    setDraftSaved(false);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteDraft = (id: string) => {
    if (!user?.institutionId) return;
    const updated = drafts.filter((d) => d.id !== id);
    saveDraftsToStorage(user.institutionId, updated);
    setDrafts(updated);
    if (activeDraftId === id) { setActiveDraftId(null); setDraftSaved(false); }
  };

  const clearDraftAfterAdmission = useCallback((id: string | null) => {
    if (!id || !user?.institutionId) return;
    const updated = loadDraftsFromStorage(user.institutionId).filter((d) => d.id !== id);
    saveDraftsToStorage(user.institutionId, updated);
    setDrafts(updated);
  }, [user?.institutionId]);

  const sf = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  // Title-case handler for name fields (Each Word Capitalized)
  const sfName = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase());
      setForm({ ...form, [key]: v });
    };

  // Uppercase handler for institution/school names
  const sfUpper = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value.toUpperCase() });

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
    setCollectNow(true);
    setPaymentMode('cash');
    setFeeDueDate('');
    setFeeItems([]);
    setActivePlan(null);
    setFeeStructures([]);
    setExistingParentInfo(null);
    setLoadingFees(true);

    // Try new FeePlan system first, fall back to legacy FeeStructure
    const planPromise = (form.academicUnitId && currentYearId)
      ? apiFetch<FeePlan[]>(`/fees/plans?yearId=${currentYearId}&unitId=${form.academicUnitId}`).catch(() => null)
      : Promise.resolve(null);

    const legacyPromise = (form.academicUnitId && currentYearId)
      ? apiFetch(`/fees/structures?unitId=${form.academicUnitId}&yearId=${currentYearId}`).catch(() => null)
      : Promise.resolve(null);

    // Sibling detection — check if this parent phone already has a portal account
    const parentPromise = form.parentPhone
      ? apiFetch(`/users?phone=${encodeURIComponent(form.parentPhone)}`).catch(() => null)
      : Promise.resolve(null);

    try {
      const [planRes, legacyRes, parentRes] = await Promise.all([planPromise, legacyPromise, parentPromise]);

      const plans: FeePlan[] = Array.isArray(planRes) ? planRes : [];
      const plan = plans.length > 0 ? plans[0] : null;

      if (plan && plan.items.length > 0) {
        // ── New plan system ──
        setActivePlan(plan);
        const items: FeeLineItem[] = [];
        for (const item of plan.items) {
          if (item.installments.length > 0) {
            for (const inst of item.installments) {
              items.push({
                feePlanItemId: item.id,
                feePlanInstallmentId: inst.id,
                feeCategoryId: item.feeCategoryId,
                name: `${item.feeCategory.name} — ${inst.label}`,
                structureAmount: inst.amount,
                amount: '',
                checked: false,
              });
            }
          } else {
            items.push({
              feePlanItemId: item.id,
              feeCategoryId: item.feeCategoryId,
              name: item.feeCategory.name,
              structureAmount: item.totalAmount,
              amount: '',
              checked: false,
            });
          }
        }
        // Auto-check admission fee if present
        const admIdx = items.findIndex((i) => i.name.toLowerCase().includes('admission'));
        if (admIdx >= 0) { items[admIdx].checked = true; items[admIdx].amount = String(items[admIdx].structureAmount); }
        setFeeItems(items);
      } else {
        // ── Legacy FeeStructure fallback ──
        const structs: FeeStructure[] = Array.isArray(legacyRes) ? legacyRes : [];
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
      }

      if (Array.isArray(parentRes) && parentRes.length > 0) {
        setExistingParentInfo({ phone: form.parentPhone });
      }
    } catch {
      setActivePlan(null);
      setFeeStructures([]);
      setFeeItems([]);
    } finally {
      setLoadingFees(false);
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

      if (collectNow) {
        const paidItems = feeItems.filter((i) => i.checked && parseFloat(i.amount) > 0);
        if (paidItems.length > 0) {
          if (activePlan) {
            // New plan system — send admissionCollections
            payload.admissionCollections = paidItems.map((i) => ({
              feePlanItemId: i.feePlanItemId,
              feePlanInstallmentId: i.feePlanInstallmentId ?? undefined,
              feeCategoryId: i.feeCategoryId,
              amount: parseFloat(i.amount),
              paymentMode,
              academicYearId: currentYearId || undefined,
            }));
          } else {
            // Legacy system — send admissionFees with feeHeadId
            payload.admissionFees = paidItems.map((i) => ({
              feeHeadId: i.feeHeadId,
              amountPaid: parseFloat(i.amount),
              paymentMode,
              academicYearId: currentYearId || undefined,
            }));
          }
        }
      } else {
        payload.admissionFee = { paid: false, dueDate: feeDueDate || undefined };
      }

      const result = await apiFetch('/students/confirm-admission', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowFeeStep(false);
      clearDraftAfterAdmission(activeDraftId);
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
      const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const randChar = (s: string) => {
        const arr = new Uint8Array(1);
        crypto.getRandomValues(arr);
        return s[arr[0] % s.length];
      };
      const tempPwd = Array.from({ length: 10 }, () => randChar(CHARS)).join('');
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

  // ── Ledger import helpers ────────────────────────────────────────────────
  const parseCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setError('CSV file is empty or has only headers'); return; }
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const COL: Record<string, string> = {
        'first name': 'firstName', 'first name*': 'firstName',
        'last name': 'lastName', 'last name*': 'lastName',
        'middle name': 'middleName',
        'gender (male/female/other)': 'gender', 'gender': 'gender',
        'date of birth (dd-mm-yyyy)': 'dateOfBirth', 'date of birth': 'dateOfBirth',
        'class': 'className', 'class*': 'className',
        'old admission no': 'oldAdmissionNo',
        'admission date (dd-mm-yyyy)': 'admissionDate', 'admission date': 'admissionDate',
        'father name': 'fatherName', "father's name": 'fatherName',
        'mother name': 'motherName', "mother's name": 'motherName',
        'parent mobile': 'parentPhone', 'parent mobile*': 'parentPhone',
        'address': 'address', 'religion': 'religion',
        'caste category': 'casteCategory', 'blood group': 'bloodGroup',
      };
      const parseDMY = (s: string): string | undefined => {
        if (!s) return undefined;
        const p = s.split(/[-\/]/);
        if (p.length !== 3) return undefined;
        const [d, m, y] = p;
        if (y.length !== 4) return undefined;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      };
      const parsed: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells: string[] = [];
        let cur = ''; let inQ = false;
        for (const ch of lines[i]) {
          if (ch === '"') inQ = !inQ;
          else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
          else cur += ch;
        }
        cells.push(cur.trim());
        const raw: Record<string, string> = {};
        headers.forEach((h, idx) => { if (COL[h]) raw[COL[h]] = (cells[idx] || '').trim(); });
        const errs: string[] = [];
        if (!raw.firstName) errs.push('First name required');
        if (!raw.lastName) errs.push('Last name required');
        if (!raw.className) errs.push('Class required');
        if (raw.parentPhone && !/^[6-9]\d{9}$/.test(raw.parentPhone.replace(/\s/g, ''))) errs.push('Invalid phone (10 digits, starts 6–9)');
        if (raw.gender && !['male', 'female', 'other'].includes(raw.gender.toLowerCase())) errs.push(`Gender must be Male/Female/Other`);
        const dob = parseDMY(raw.dateOfBirth ?? '');
        const adm = parseDMY(raw.admissionDate ?? '');
        if (raw.dateOfBirth && !dob) errs.push('DOB must be DD-MM-YYYY');
        parsed.push({
          firstName: raw.firstName ?? '', lastName: raw.lastName ?? '',
          middleName: raw.middleName, gender: raw.gender?.toLowerCase(),
          dateOfBirth: dob, className: raw.className ?? '',
          oldAdmissionNo: raw.oldAdmissionNo, admissionDate: adm,
          fatherName: raw.fatherName, motherName: raw.motherName,
          parentPhone: raw.parentPhone?.replace(/\s/g, ''),
          address: raw.address, religion: raw.religion,
          casteCategory: raw.casteCategory, bloodGroup: raw.bloodGroup,
          _rowNum: i + 1, _errors: errs,
        });
      }
      setImportRows(parsed);
      setImportStep('preview');
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter((r) => r._errors.length === 0);
    if (!validRows.length) { setError('No valid rows to import'); return; }
    setImporting(true);
    try {
      const result = await apiFetch('/students/import', {
        method: 'POST',
        body: JSON.stringify({ rows: validRows.map(({ _rowNum: _r, _errors: _e, ...rest }) => rest) }),
      }) as any;
      setImportResult(result);
      setImportStep('result');
      await fetchStudents();
    } catch (e: any) { setError(e.message || 'Import failed'); }
    finally { setImporting(false); }
  };

  const filteredStudents = search.trim().length >= 1
    ? students.filter((s) => {
        const q = search.toLowerCase();
        return s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) || (s.parentPhone || '').includes(q);
      })
    : students;

  const totalFeeStructure = activePlan
    ? activePlan.items.reduce((sum, item) => sum + item.totalAmount, 0)
    : feeStructures.reduce((sum, s) => sum + s.amount, 0);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ds-text1">Student Admission</h1>
        <button
          onClick={() => { setShowImport(true); setImportStep('upload'); setImportRows([]); setImportResult(null); setError(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ds-border text-sm font-medium text-ds-text1 hover:bg-ds-bg2 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Import from Ledger
        </button>
      </div>

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

        {/* Setup guide — shown when basic configuration is missing */}
        {(academicUnits.length === 0 || academicYears.length === 0) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Setup required before admission</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              {academicUnits.length === 0 && (
                <li>No classes configured — <a href="/dashboard/classes" className="underline font-medium">Go to Classes</a> to add LKG, Class 1, etc.</li>
              )}
              {academicYears.length === 0 && (
                <li>No academic year set up — <a href="/dashboard/settings" className="underline font-medium">Go to Settings</a> to add 2025-26.</li>
              )}
            </ul>
          </div>
        )}

        {/* ── Section 1: Admission Details ── */}
        <p className={sec}>1. Admission Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={lbl}>Class Admitted To *</label>
            <select className={inp} value={form.academicUnitId} onChange={sf('academicUnitId')}>
              <option value="">{academicUnits.length === 0 ? '— No classes configured —' : 'Select Class'}</option>
              {academicUnits.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Academic Year</label>
            <select className={inp} value={currentYearId} onChange={(e) => setCurrentYearId(e.target.value)}>
              <option value="">{academicYears.length === 0 ? '— No academic year —' : 'Select Year'}</option>
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
              onChange={(e) => setForm({ ...form, firstName: e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\b\w/g, (c) => c.toUpperCase()) })} />
          </div>
          <div>
            <label className={lbl}>Middle Name</label>
            <input className={inp} placeholder="Optional" value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\b\w/g, (c) => c.toUpperCase()) })} />
          </div>
          <div>
            <label className={lbl}>Last Name / Surname *</label>
            <input className={inp} placeholder="e.g. Sharma" value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\b\w/g, (c) => c.toUpperCase()) })} />
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
            <input className={inp} placeholder="Name of previous school" value={form.tcPreviousInstitution}
              onChange={(e) => setForm({ ...form, tcPreviousInstitution: e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()) })} />
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
              onChange={(e) => setForm({ ...form, fatherName: e.target.value.replace(/[^a-zA-Z\s.]/g, '').replace(/\b\w/g, (c) => c.toUpperCase()) })} />
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
              onChange={(e) => setForm({ ...form, motherName: e.target.value.replace(/[^a-zA-Z\s.]/g, '').replace(/\b\w/g, (c) => c.toUpperCase()) })} />
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
            <div className="space-y-2">
              <button onClick={openFeeStep} className="btn-brand w-full px-4 py-2.5 rounded-lg">
                Next: Fee &amp; Confirm Admission →
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => saveDraft()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-ds-border text-sm font-medium text-ds-text2 hover:bg-ds-bg2 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  {draftSaved ? '✓ Draft Saved' : activeDraftId ? 'Update Draft' : 'Save as Draft'}
                </button>
                {activeDraftId && (
                  <span className="text-xs text-ds-brand font-medium px-2 py-1 bg-ds-info-bg border border-ds-info-border rounded-md">
                    Draft active
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Drafts Section ── */}
      {drafts.length > 0 && !editingId && (
        <div className="bg-ds-surface shadow-sm rounded-xl border border-amber-200 overflow-hidden mb-2">
          <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between" style={{ background: 'rgba(254,243,199,0.5)' }}>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <h2 className="font-medium text-amber-800 text-sm">Saved Drafts</h2>
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">{drafts.length}</span>
            </div>
            <p className="text-xs text-amber-600">Click a draft to continue filling the form</p>
          </div>
          <div className="divide-y divide-amber-100">
            {drafts.map((draft) => (
              <div key={draft.id} className={`flex items-center justify-between px-6 py-3 hover:bg-amber-50 transition-colors ${activeDraftId === draft.id ? 'bg-amber-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ds-text1 truncate">{draft.label || 'Unnamed Student'}</p>
                  <p className="text-xs text-ds-text3 mt-0.5">
                    Saved {new Date(draft.savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {activeDraftId === draft.id && <span className="ml-2 text-ds-brand font-medium">· Currently editing</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => loadDraft(draft)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-ds-border text-ds-text2 hover:bg-ds-bg2 transition-colors"
                  >
                    {activeDraftId === draft.id ? 'Editing' : 'Continue →'}
                  </button>
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="p-1.5 text-ds-text3 hover:text-red-500 rounded transition-colors"
                    title="Delete draft"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {/* Header */}
            <div className="px-6 py-5 border-b border-ds-border">
              <h2 className="font-semibold text-ds-text1">Step 2 — Fee &amp; Admission Confirmation</h2>
              <p className="text-xs text-ds-text3 mt-0.5">
                Admitting: <span className="font-medium text-ds-text1">{form.firstName} {form.middleName ? `${form.middleName} ` : ''}{form.lastName}</span>
                {form.academicUnitId && ` → ${academicUnits.find((u) => u.id === form.academicUnitId)?.displayName || ''}`}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Fee Structure Reference */}
              {loadingFees ? (
                <p className="text-sm text-ds-text3">Loading fee structure...</p>
              ) : activePlan ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider">Annual Fee Structure</p>
                    <span className="text-xs text-ds-brand font-medium">{activePlan.name}</span>
                  </div>
                  <div className="bg-ds-bg2 rounded-lg divide-y divide-ds-border text-sm">
                    {activePlan.items.map((item) =>
                      item.installments.length > 0 ? (
                        item.installments.map((inst) => (
                          <div key={inst.id} className="flex justify-between px-4 py-2.5">
                            <span className="text-ds-text2">{item.feeCategory.name} <span className="text-ds-text3">— {inst.label}</span></span>
                            <span className="font-medium text-ds-text1">₹{inst.amount.toLocaleString('en-IN')}</span>
                          </div>
                        ))
                      ) : (
                        <div key={item.id} className="flex justify-between px-4 py-2.5">
                          <span className="text-ds-text2">{item.feeCategory.name}</span>
                          <span className="font-medium text-ds-text1">₹{item.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                      )
                    )}
                    <div className="flex justify-between px-4 py-2.5 font-semibold text-ds-text1">
                      <span>Total Annual Fees</span>
                      <span>₹{totalFeeStructure.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ) : feeStructures.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-2">Annual Fee Structure</p>
                  <div className="bg-ds-bg2 rounded-lg divide-y divide-ds-border text-sm">
                    {feeStructures.map((s) => (
                      <div key={s.id} className="flex justify-between px-4 py-2.5">
                        <span className="text-ds-text2">{s.feeHead.name}{s.installmentName ? ` (${s.installmentName})` : ''}</span>
                        <span className="font-medium text-ds-text1">₹{s.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-2.5 font-semibold text-ds-text1">
                      <span>Total Annual Fees</span>
                      <span>₹{totalFeeStructure.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ) : !loadingFees ? (
                <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 text-xs text-ds-warning-text">
                  No fee structure configured for this class. You can set it up in Fees → Fee Plans after admission.
                </div>
              ) : null}

              {/* Sibling detection warning */}
              {existingParentInfo && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5">
                  <span className="text-amber-500 shrink-0 text-base leading-none mt-0.5">⚠</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Sibling Detected</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      A parent account for <strong>{existingParentInfo.phone}</strong> already exists (from a previously admitted sibling).
                      Their portal account will be reused — no new account or password will be created.
                    </p>
                  </div>
                </div>
              )}

              {/* Payment section */}
              <div>
                <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-3">Payment at Admission</p>

                {/* Collect Now / Defer toggle */}
                <div className="flex rounded-lg border border-ds-border overflow-hidden mb-4">
                  <button
                    onClick={() => setCollectNow(true)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${collectNow ? 'bg-ds-brand text-white' : 'bg-ds-surface text-ds-text2 hover:bg-ds-bg2'}`}>
                    Collect Fees Now
                  </button>
                  <button
                    onClick={() => setCollectNow(false)}
                    className={`flex-1 py-2.5 text-sm font-medium border-l border-ds-border transition-colors ${!collectNow ? 'bg-ds-brand text-white' : 'bg-ds-surface text-ds-text2 hover:bg-ds-bg2'}`}>
                    No Payment Today
                  </button>
                </div>

                {collectNow && (
                  <div className="space-y-3">
                    {feeItems.length > 0 && (
                      <div className="flex justify-between items-center">
                        <label className={lbl}>Select fees being collected</label>
                        <button
                          type="button"
                          onClick={() => setFeeItems((prev) => prev.map((it) => ({
                            ...it,
                            checked: true,
                            amount: it.structureAmount > 0 ? String(it.structureAmount) : it.amount,
                          })))}
                          className="text-xs text-ds-brand hover:underline font-medium">
                          Mark All as Paid
                        </button>
                      </div>
                    )}
                    {feeItems.length === 0 && (
                      <p className="text-xs text-ds-text3">No fee heads available. Add them in the Fees section first.</p>
                    )}
                    <div className="space-y-2">
                      {feeItems.map((item, idx) => (
                        <div key={item.feeHeadId} className={`rounded-lg border transition-colors ${item.checked ? 'border-ds-brand bg-ds-bg2' : 'border-ds-border bg-ds-surface'}`}>
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
                              <input type="number" className={inp} placeholder="Amount collected (₹)" value={item.amount}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setFeeItems((prev) => prev.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {feeItems.some((i) => i.checked) && (
                      <div className="flex justify-between text-sm font-semibold text-ds-text1 bg-ds-bg2 px-4 py-2.5 rounded-lg">
                        <span>Collecting at admission</span>
                        <span className="text-ds-brand">₹{feeItems.filter((i) => i.checked).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {feeItems.some((i) => i.checked) && (
                      <div>
                        <label className={lbl}>Payment Mode</label>
                        <select className={inp} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="cheque">Cheque</option>
                          <option value="dd">DD (Demand Draft)</option>
                          <option value="neft">NEFT / RTGS</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {!collectNow && (
                  <div className="bg-ds-bg2 rounded-lg p-4 space-y-3">
                    <p className="text-sm text-ds-text2">
                      Admission will be confirmed without any payment today. Fees can be recorded later from the <strong>Fees</strong> section.
                    </p>
                    <div>
                      <label className={lbl}>Fee Due Date (optional)</label>
                      <input className={inp} type="date" value={feeDueDate} onChange={(e) => setFeeDueDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Parent portal info */}
              <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3">
                <p className="text-xs font-semibold text-ds-info-text mb-0.5">Parent Portal Account</p>
                {existingParentInfo ? (
                  <p className="text-xs text-ds-brand">
                    Existing account for <strong>{form.parentPhone}</strong> will be linked to this student (sibling reuse — no new password generated).
                  </p>
                ) : (
                  <p className="text-xs text-ds-brand">
                    A new parent portal account will be created with <strong>{form.parentPhone}</strong> as the login ID. A one-time password will be shown after confirmation — share it with the parent.
                  </p>
                )}
              </div>

              {error && <p className="text-ds-error-text text-sm">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-ds-border flex gap-3">
              <button onClick={confirmAdmission} disabled={confirming} className="btn-brand flex-1 py-2.5 rounded-lg">
                {confirming ? 'Confirming...' : 'Confirm Admission'}
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

      {/* ── Ledger Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-ds-surface rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-ds-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-ds-text1">Import Students from Ledger</h2>
                <p className="text-xs text-ds-text3 mt-0.5">Migrate existing students from your register / Excel / ledger book</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-ds-text3 hover:text-ds-text1 text-2xl font-light leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6 text-xs font-medium">
                {(['upload', 'preview', 'result'] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${importStep === s ? 'bg-ds-brand text-white' : (importStep === 'result' || (importStep === 'preview' && s === 'upload')) ? 'bg-green-500 text-white' : 'bg-ds-bg2 text-ds-text3'}`}>{i + 1}</div>
                    <span className={importStep === s ? 'text-ds-brand' : 'text-ds-text3'}>{s === 'upload' ? 'Upload CSV' : s === 'preview' ? 'Review & Confirm' : 'Done'}</span>
                    {i < 2 && <div className="w-8 h-px bg-ds-border" />}
                  </div>
                ))}
              </div>

              {importStep === 'upload' && (
                <div className="space-y-5">
                  <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-4">
                    <p className="text-sm font-medium text-ds-info-text mb-2">How it works</p>
                    <ol className="text-xs text-ds-info-text space-y-1 list-decimal list-inside">
                      <li>Download the CSV template and fill in your students&apos; data from your ledger / register</li>
                      <li>Class names must exactly match your configured classes (see list below)</li>
                      <li>A parent portal account is auto-created for each unique mobile number</li>
                      <li>Upload the CSV — a preview is shown before any records are created</li>
                    </ol>
                  </div>
                  {academicUnits.length > 0 && (
                    <div className="bg-ds-bg2 border border-ds-border rounded-lg p-3">
                      <p className="text-xs font-semibold text-ds-text2 mb-2">Available class names for CSV</p>
                      <div className="flex flex-wrap gap-1.5">
                        {academicUnits.map((u) => (
                          <span key={u.id} className="px-2 py-0.5 bg-ds-surface border border-ds-border rounded text-xs font-mono text-ds-text1">
                            {u.displayName || u.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {academicUnits.length === 0 && (
                    <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 text-sm text-ds-warning-text">
                      No classes configured yet. <a href="/dashboard/classes" className="underline font-medium">Set up classes</a> before importing students.
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-ds-text2 mb-2">Step 1 — Download the template</p>
                    <button
                      onClick={() => {
                        const csv = 'First Name*,Last Name*,Middle Name,Gender (Male/Female/Other),Date of Birth (DD-MM-YYYY),Class*,Old Admission No,Admission Date (DD-MM-YYYY),Father Name,Mother Name,Parent Mobile,Address,Religion,Caste Category,Blood Group\nRamesh,Sharma,Kumar,Male,15-06-2015,Class 5,OLD-001,01-06-2023,Rajesh Sharma,Sunita Sharma,9876543210,123 MG Road Mumbai,Hindu,General,A+\nPriya,Verma,,Female,20-08-2014,Class 6,,01-06-2022,Suresh Verma,Kavita Verma,9123456789,,,,';
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'student-import-template.csv'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 border border-ds-border rounded-lg text-sm font-medium text-ds-text1 hover:bg-ds-bg2 transition-colors">
                      <svg className="w-4 h-4 text-ds-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      Download CSV Template
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ds-text2 mb-2">Step 2 — Upload filled CSV</p>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-ds-border rounded-xl p-10 cursor-pointer hover:border-ds-brand hover:bg-ds-bg2 transition-colors">
                      <svg className="w-10 h-10 text-ds-text3 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      <p className="text-sm font-medium text-ds-text1 mb-1">Click to upload or drag &amp; drop</p>
                      <p className="text-xs text-ds-text3">CSV files only</p>
                      <input type="file" accept=".csv,text/csv" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCSVFile(f); e.target.value = ''; }} />
                    </label>
                  </div>
                  {error && <p className="text-ds-error-text text-sm">{error}</p>}
                </div>
              )}

              {importStep === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ds-text1">{importRows.length} students parsed from file</p>
                      <p className="text-xs text-ds-text3 mt-0.5">
                        <span className="text-green-600 font-medium">{importRows.filter(r => r._errors.length === 0).length} ready to import</span>
                        {importRows.some(r => r._errors.length > 0) && (
                          <span className="text-ds-error-text font-medium ml-3">{importRows.filter(r => r._errors.length > 0).length} have errors — will be skipped</span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => { setImportStep('upload'); setImportRows([]); setError(null); }} className="text-xs text-ds-text2 hover:text-ds-text1 underline">← Change file</button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-ds-border">
                    <table className="w-full text-xs">
                      <thead className="bg-ds-bg2 border-b border-ds-border">
                        <tr>
                          {['#', 'Name', 'Class', 'Gender', 'DOB', 'Phone', 'Status'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-medium text-ds-text2 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ds-border">
                        {importRows.map((row) => (
                          <tr key={row._rowNum} className={row._errors.length > 0 ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 text-ds-text3">{row._rowNum}</td>
                            <td className="px-3 py-2 font-medium text-ds-text1 whitespace-nowrap">{row.firstName} {row.lastName}</td>
                            <td className="px-3 py-2 text-ds-text2 whitespace-nowrap">{row.className}</td>
                            <td className="px-3 py-2 text-ds-text2 capitalize">{row.gender || '—'}</td>
                            <td className="px-3 py-2 text-ds-text2 whitespace-nowrap">{row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="px-3 py-2 text-ds-text2 whitespace-nowrap">{row.parentPhone || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row._errors.length === 0 ? (
                                <span className="text-green-600 font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                  Ready
                                </span>
                              ) : (
                                <span className="text-ds-error-text" title={row._errors.join(' · ')}>
                                  ⚠ {row._errors[0]}{row._errors.length > 1 ? ` +${row._errors.length - 1}` : ''}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {error && <p className="text-ds-error-text text-sm">{error}</p>}
                </div>
              )}

              {importStep === 'result' && importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <p className="text-3xl font-bold text-green-700">{importResult.created}</p>
                      <p className="text-xs text-green-600 mt-1 font-medium">Students Created</p>
                    </div>
                    <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5">
                      <p className="text-3xl font-bold text-ds-warning-text">{importResult.skipped}</p>
                      <p className="text-xs text-ds-warning-text mt-1 font-medium">Skipped / Errors</p>
                    </div>
                    <div className="bg-ds-bg2 border border-ds-border rounded-xl p-5">
                      <p className="text-3xl font-bold text-ds-text1">{importResult.created + importResult.skipped}</p>
                      <p className="text-xs text-ds-text3 mt-1 font-medium">Total Rows</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-2">Rows not imported</p>
                      <div className="bg-ds-error-bg border border-ds-error-border rounded-lg divide-y divide-ds-error-border max-h-48 overflow-y-auto">
                        {importResult.errors.map((e, i) => (
                          <div key={i} className="px-3 py-2 text-xs text-ds-error-text flex gap-3">
                            <span className="font-semibold shrink-0">Row {e.row}</span>
                            <span>{e.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3 text-xs text-ds-info-text">
                    Student list has been refreshed. Go to Fees to set up fee structures, or assign portal access from student profiles.
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-ds-border flex gap-3">
              {importStep === 'preview' && (
                <>
                  <button onClick={handleConfirmImport}
                    disabled={importing || importRows.filter(r => r._errors.length === 0).length === 0}
                    className="btn-brand flex-1 py-2.5 rounded-lg disabled:opacity-50">
                    {importing ? 'Importing...' : `Import ${importRows.filter(r => r._errors.length === 0).length} Students`}
                  </button>
                  <button onClick={() => setShowImport(false)} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
                </>
              )}
              {importStep === 'result' && (
                <button onClick={() => setShowImport(false)} className="btn-brand flex-1 py-2.5 rounded-lg">Done</button>
              )}
              {importStep === 'upload' && (
                <button onClick={() => setShowImport(false)} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
