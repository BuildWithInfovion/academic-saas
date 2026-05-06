'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { AcademicUnit, AcademicYear, FeeHead, FeeStructure, FeePlan, Student } from '@/lib/types';
import { emptyForm, FeeLineItem, AdmissionDraft, loadDraftsFromStorage, saveDraftsToStorage } from './_components/students-utils';
import { AdmissionForm } from './_components/AdmissionForm';
import { FeeConfirmModal } from './_components/FeeConfirmModal';
import { CredentialsModal } from './_components/CredentialsModal';
import { StudentProfilePanel } from './_components/StudentProfilePanel';
import { LinkModal } from './_components/LinkModal';
import { ImportModal, IMPORT_BATCH_KEY, type ImportBatch } from './_components/ImportModal';

const inp = 'border border-ds-border-strong p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';
const PAGE_SIZE = 50;

export default function StudentsPage() {
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

  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState('');

  // Fee step state
  const [showFeeStep, setShowFeeStep] = useState(false);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [activePlan, setActivePlan] = useState<FeePlan | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [collectNow, setCollectNow] = useState(true);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [feeDueDate, setFeeDueDate] = useState('');
  const [existingParentInfo, setExistingParentInfo] = useState<{ phone: string } | null>(null);
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

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [lastImportBatch, setLastImportBatch] = useState<ImportBatch | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Drafts
  const [drafts, setDrafts] = useState<AdmissionDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for stale-closure-safe handlers (beforeunload / unmount)
  const formRef = useRef(form);
  const editingIdRef = useRef(editingId);
  const activeDraftIdRef = useRef(activeDraftId);
  const currentYearIdRef = useRef(currentYearId);
  const academicUnitsRef = useRef(academicUnits);

  // Fee plan prefetch cache
  const feePlanCache = useRef<Map<string, { plans: FeePlan[]; legacy: any[] }>>(new Map());

  useEffect(() => { setIsReady(true); }, []);

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { activeDraftIdRef.current = activeDraftId; }, [activeDraftId]);
  useEffect(() => { currentYearIdRef.current = currentYearId; }, [currentYearId]);
  useEffect(() => { academicUnitsRef.current = academicUnits; }, [academicUnits]);

  useEffect(() => {
    if (user?.institutionId) setDrafts(loadDraftsFromStorage(user.institutionId));
  }, [user?.institutionId]);

  // Load recent import batch from localStorage for undo banner (show for 24h)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPORT_BATCH_KEY);
      if (!raw) return;
      const batch = JSON.parse(raw) as ImportBatch;
      if (Date.now() - batch.timestamp < 24 * 60 * 60 * 1000) setLastImportBatch(batch);
      else localStorage.removeItem(IMPORT_BATCH_KEY);
    } catch { localStorage.removeItem(IMPORT_BATCH_KEY); }
  }, []);

  const saveFromRefs = useCallback(() => {
    const institutionId = user?.institutionId;
    if (!institutionId || editingIdRef.current) return;
    const f = formRef.current;
    if (!f.firstName.trim()) return;
    const existing = loadDraftsFromStorage(institutionId);
    const id = activeDraftIdRef.current ?? `draft-${Date.now()}`;
    const label = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(' ').trim() || 'Unnamed Student';
    const unit = academicUnitsRef.current.find((u) => u.id === f.academicUnitId);
    const cls = unit?.displayName ?? unit?.name ?? '';
    const draft: AdmissionDraft = { id, savedAt: new Date().toISOString(), label: cls ? `${label} — ${cls}` : label, form: f, yearId: currentYearIdRef.current };
    saveDraftsToStorage(institutionId, [draft, ...existing.filter((d) => d.id !== id)]);
  }, [user?.institutionId]);

  useEffect(() => () => { saveFromRefs(); }, [saveFromRefs]);
  useEffect(() => {
    window.addEventListener('beforeunload', saveFromRefs);
    return () => window.removeEventListener('beforeunload', saveFromRefs);
  }, [saveFromRefs]);

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const fetchStudents = useCallback(async (p = page) => {
    try {
      const res = await apiFetch(`/students?page=${p}&limit=${PAGE_SIZE}`) as any;
      setStudents(res.data || res || []);
      const total = res.meta?.total ?? res.total;
      if (total !== undefined) setTotalStudents(total);
    } catch (err: any) { setError(err.message || 'Failed to load students'); }
    finally { setLoading(false); }
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
      } else { setError((s as any).reason?.message || 'Failed to load students'); }
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
    setEditingId(null); setActiveDraftId(null); setDraftSaved(false); setError(null);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  };

  const saveDraft = useCallback((silent = false) => {
    if (!user?.institutionId) return;
    if (!form.firstName.trim()) { if (!silent) setError("Enter at least the student's first name before saving as draft."); return; }
    const existing = loadDraftsFromStorage(user.institutionId);
    const id = activeDraftId ?? `draft-${Date.now()}`;
    const label = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ').trim() || 'Unnamed Student';
    const className = academicUnits.find((u) => u.id === form.academicUnitId)?.displayName ?? '';
    const draft: AdmissionDraft = { id, savedAt: new Date().toISOString(), label: className ? `${label} — ${className}` : label, form: { ...form }, yearId: currentYearId };
    const updated = [draft, ...existing.filter((d) => d.id !== id)];
    saveDraftsToStorage(user.institutionId, updated);
    setDrafts(updated); setActiveDraftId(id);
    if (!silent) { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2500); }
  }, [form, activeDraftId, user?.institutionId, academicUnits, currentYearId]);

  useEffect(() => {
    if (editingId || !form.firstName.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDraft(true), 60_000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [form, editingId, saveDraft]);

  useEffect(() => {
    if (!form.academicUnitId || !currentYearId) return;
    const cacheKey = `${form.academicUnitId}|${currentYearId}`;
    if (feePlanCache.current.has(cacheKey)) return;
    Promise.all([
      apiFetch<FeePlan[]>(`/fees/plans?yearId=${currentYearId}&unitId=${form.academicUnitId}`).catch(() => [] as FeePlan[]),
      apiFetch(`/fees/structures?unitId=${form.academicUnitId}&yearId=${currentYearId}`).catch(() => []),
    ]).then(([plans, legacy]) => {
      feePlanCache.current.set(cacheKey, { plans: Array.isArray(plans) ? plans : [], legacy: Array.isArray(legacy) ? legacy : [] });
    });
  }, [form.academicUnitId, currentYearId]);

  const loadDraft = (draft: AdmissionDraft) => {
    setForm({ ...draft.form }); setActiveDraftId(draft.id); setDraftSaved(false); setError(null);
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

  const validate = () => {
    if (!form.firstName.trim()) return 'First name is required';
    if (!form.lastName.trim()) return 'Last name is required';
    if (!form.dateOfBirth) return 'Date of Birth is required';
    if (!form.gender) return 'Gender is required';
    if (!form.fatherName.trim()) return "Father's name is required";
    if (!form.motherName.trim()) return "Mother's name is required";
    if (!form.parentPhone.trim()) return 'Parent mobile number is required';
    if (!/^[6-9]\d{9}$/.test(form.parentPhone.trim())) return 'Parent mobile must be a valid 10-digit Indian number (starting with 6–9)';
    if (form.phone.trim() && !/^[6-9]\d{9}$/.test(form.phone.trim())) return 'Student mobile must be a valid 10-digit Indian number';
    if (form.secondaryPhone.trim() && !/^[6-9]\d{9}$/.test(form.secondaryPhone.trim())) return "Mother's mobile must be a valid 10-digit Indian number";
    if (form.emergencyContactPhone.trim() && !/^[6-9]\d{9}$/.test(form.emergencyContactPhone.trim())) return 'Emergency contact must be a valid 10-digit Indian number';
    if (form.aadharNumber && !/^\d{12}$/.test(form.aadharNumber)) return 'Aadhar number must be exactly 12 digits';
    if (form.pinCode && !/^\d{6}$/.test(form.pinCode)) return 'PIN code must be exactly 6 digits';
    if (!form.academicUnitId) return 'Please select a class';
    return null;
  };

  const openFeeStep = async () => {
    setError(null);
    const err = validate();
    if (err) return setError(err);
    setShowFeeStep(true); setCollectNow(true); setPaymentMode('cash'); setFeeDueDate('');
    setFeeItems([]); setActivePlan(null); setFeeStructures([]); setExistingParentInfo(null); setLoadingFees(true);

    if (form.parentPhone) {
      apiFetch(`/users?phone=${encodeURIComponent(form.parentPhone)}&role=parent`)
        .then((res) => { if (Array.isArray(res) && res.length > 0) setExistingParentInfo({ phone: form.parentPhone }); })
        .catch(() => {});
    }

    const cacheKey = `${form.academicUnitId}|${currentYearId}`;
    const cached = feePlanCache.current.get(cacheKey);
    const planPromise = cached ? Promise.resolve(cached.plans)
      : (form.academicUnitId && currentYearId)
        ? apiFetch<FeePlan[]>(`/fees/plans?yearId=${currentYearId}&unitId=${form.academicUnitId}`).catch(() => null)
        : Promise.resolve(null);
    const legacyPromise = cached ? Promise.resolve(cached.legacy)
      : (form.academicUnitId && currentYearId)
        ? apiFetch(`/fees/structures?unitId=${form.academicUnitId}&yearId=${currentYearId}`).catch(() => null)
        : Promise.resolve(null);
    if (cached) setLoadingFees(false);

    try {
      const [planClassRes, legacyRes] = await Promise.all([planPromise, legacyPromise]);
      const classPlans: FeePlan[] = Array.isArray(planClassRes) ? planClassRes : [];
      const plan = classPlans.length > 0 ? classPlans[0] : null;
      if (plan && plan.items.length > 0) {
        setActivePlan(plan);
        const items: FeeLineItem[] = [];
        for (const item of plan.items) {
          if (item.installments.length > 0) {
            for (const inst of item.installments) {
              items.push({ feePlanItemId: item.id, feePlanInstallmentId: inst.id, feeCategoryId: item.feeCategoryId, name: `${item.feeCategory.name} — ${inst.label}`, structureAmount: inst.amount, amount: '', checked: false });
            }
          } else {
            items.push({ feePlanItemId: item.id, feeCategoryId: item.feeCategoryId, name: item.feeCategory.name, structureAmount: item.totalAmount, amount: '', checked: false });
          }
        }
        const admIdx = items.findIndex((i) => i.name.toLowerCase().includes('admission'));
        if (admIdx >= 0) { items[admIdx].checked = true; items[admIdx].amount = String(items[admIdx].structureAmount); }
        setFeeItems(items);
      } else {
        const structs: FeeStructure[] = Array.isArray(legacyRes) ? legacyRes : [];
        setFeeStructures(structs);
        if (structs.length > 0) {
          const items = structs.map((s) => ({ feeHeadId: s.feeHeadId, name: s.feeHead.name + (s.installmentName ? ` (${s.installmentName})` : ''), structureAmount: s.amount, amount: '', checked: false }));
          const admIdx = items.findIndex((i) => i.name.toLowerCase().includes('admission'));
          if (admIdx >= 0) { items[admIdx].checked = true; items[admIdx].amount = String(items[admIdx].structureAmount); }
          setFeeItems(items);
        } else {
          setFeeItems(feeHeads.map((fh) => ({ feeHeadId: fh.id, name: fh.name, structureAmount: 0, amount: '', checked: false })));
        }
      }
    } catch { setActivePlan(null); setFeeStructures([]); setFeeItems([]); }
    finally { setLoadingFees(false); }
  };

  const confirmAdmission = async () => {
    setConfirming(true); setError(null);
    try {
      const payload: any = {
        ...form,
        dateOfBirth: form.dateOfBirth || undefined, gender: form.gender || undefined,
        phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
        admissionDate: form.admissionDate || new Date().toISOString().split('T')[0],
        tcFromPrevious: form.tcFromPrevious || undefined, tcReceivedDate: form.tcReceivedDate || undefined,
        bloodGroup: form.bloodGroup || undefined, nationality: form.nationality || 'Indian',
        religion: form.religion.trim() || undefined, casteCategory: form.casteCategory || undefined,
        aadharNumber: form.aadharNumber.trim() || undefined,
        tcPreviousInstitution: form.tcPreviousInstitution.trim() || undefined,
        previousClass: form.previousClass.trim() || undefined, previousBoard: form.previousBoard.trim() || undefined,
        previousMarks: form.previousMarks.trim() || undefined, middleName: form.middleName.trim() || undefined,
        placeOfBirth: form.placeOfBirth.trim() || undefined, motherTongue: form.motherTongue.trim() || undefined,
        fatherOccupation: form.fatherOccupation.trim() || undefined, fatherQualification: form.fatherQualification || undefined,
        fatherEmail: form.fatherEmail.trim() || undefined, fatherAadhar: form.fatherAadhar.trim() || undefined,
        motherOccupation: form.motherOccupation.trim() || undefined, motherQualification: form.motherQualification || undefined,
        motherEmail: form.motherEmail.trim() || undefined, motherAadhar: form.motherAadhar.trim() || undefined,
        annualIncome: form.annualIncome || undefined, isEwsCategory: form.isEwsCategory,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactRelation: form.emergencyContactRelation.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        address: form.address.trim() || undefined, locality: form.locality.trim() || undefined,
        city: form.city.trim() || undefined, state: form.state || undefined, pinCode: form.pinCode.trim() || undefined,
        hasDisability: form.hasDisability,
        disabilityDetails: form.hasDisability ? form.disabilityDetails.trim() || undefined : undefined,
        medicalConditions: form.medicalConditions.trim() || undefined,
      };
      if (collectNow) {
        const paidItems = feeItems.filter((i) => i.checked && parseFloat(i.amount) > 0);
        if (paidItems.length > 0) {
          if (activePlan) {
            payload.admissionCollections = paidItems.map((i) => ({ feePlanItemId: i.feePlanItemId, feePlanInstallmentId: i.feePlanInstallmentId ?? undefined, feeCategoryId: i.feeCategoryId, amount: parseFloat(i.amount), paymentMode, academicYearId: currentYearId || undefined }));
          } else {
            payload.admissionFees = paidItems.map((i) => ({ feeHeadId: i.feeHeadId, amountPaid: parseFloat(i.amount), paymentMode, academicYearId: currentYearId || undefined }));
          }
        }
      } else { payload.admissionFee = { paid: false, dueDate: feeDueDate || undefined }; }

      const result = await apiFetch('/students/confirm-admission', { method: 'POST', body: JSON.stringify(payload) });
      setShowFeeStep(false);
      clearDraftAfterAdmission(activeDraftId);
      resetForm();
      await fetchStudents();
      setCredentials(result);
    } catch (e: any) {
      const msg: string = e.message || 'Admission failed';
      const isWakeUp = msg.toLowerCase().includes('waking up') || msg.toLowerCase().includes('unavailable');
      setError(isWakeUp ? 'Database is waking up — please wait 5 seconds and try again.' : msg);
    } finally { setConfirming(false); }
  };

  const handleEdit = (student: Student) => {
    setEditingId(student.id); setError(null);
    setForm({
      academicUnitId: student.academicUnitId || '', admissionDate: student.admissionDate?.split('T')[0] || '',
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
      tcFromPrevious: student.tcFromPrevious || '', tcPreviousInstitution: student.tcPreviousInstitution || '',
      tcReceivedDate: '', previousClass: student.previousClass || '',
      previousBoard: student.previousBoard || '', previousMarks: student.previousMarks || '',
      hasDisability: student.hasDisability ?? false,
      disabilityDetails: student.disabilityDetails || '', medicalConditions: student.medicalConditions || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setError(null); setUpdating(true);
    try {
      await apiFetch(`/students/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          dateOfBirth: form.dateOfBirth || undefined, tcReceivedDate: form.tcReceivedDate || undefined,
          phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
          middleName: form.middleName.trim() || undefined, placeOfBirth: form.placeOfBirth.trim() || undefined,
          motherTongue: form.motherTongue.trim() || undefined, fatherOccupation: form.fatherOccupation.trim() || undefined,
          fatherQualification: form.fatherQualification || undefined, fatherEmail: form.fatherEmail.trim() || undefined,
          fatherAadhar: form.fatherAadhar.trim() || undefined, motherOccupation: form.motherOccupation.trim() || undefined,
          motherQualification: form.motherQualification || undefined, motherEmail: form.motherEmail.trim() || undefined,
          motherAadhar: form.motherAadhar.trim() || undefined, annualIncome: form.annualIncome || undefined,
          emergencyContactName: form.emergencyContactName.trim() || undefined,
          emergencyContactRelation: form.emergencyContactRelation.trim() || undefined,
          emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
          address: form.address.trim() || undefined, locality: form.locality.trim() || undefined,
          city: form.city.trim() || undefined, state: form.state || undefined, pinCode: form.pinCode.trim() || undefined,
          previousClass: form.previousClass.trim() || undefined, previousBoard: form.previousBoard.trim() || undefined,
          previousMarks: form.previousMarks.trim() || undefined, religion: form.religion.trim() || undefined,
          casteCategory: form.casteCategory || undefined, aadharNumber: form.aadharNumber.trim() || undefined,
          bloodGroup: form.bloodGroup || undefined, hasDisability: form.hasDisability,
          disabilityDetails: form.hasDisability ? form.disabilityDetails.trim() || undefined : undefined,
          medicalConditions: form.medicalConditions.trim() || undefined,
        }),
      });
      resetForm(); await fetchStudents(); showSuccess('Student updated');
    } catch (e: any) { setError(e.message || 'Failed to update'); } finally { setUpdating(false); }
  };

  const handleUnlink = async (studentId: string, role: 'student' | 'parent') => {
    if (!confirm(`Unlink ${role} account? The user will immediately lose portal access.`)) return;
    setUnlinking(true);
    try {
      await apiFetch(`/students/${studentId}/link-user?role=${role}`, { method: 'DELETE' });
      await fetchStudents();
      if (profileStudent?.id === studentId) {
        const updated = await apiFetch<Student>(`/students/${studentId}`);
        setProfileStudent(updated);
      }
      showSuccess(`${role} account unlinked`);
    } catch (e: any) { setError(e.message || 'Failed to unlink'); } finally { setUnlinking(false); }
  };

  const openLinkModal = (student: Student) => setLinkingStudent(student);

  const totalFeeStructure = activePlan
    ? activePlan.items.reduce((sum, item) => sum + item.totalAmount, 0)
    : feeStructures.reduce((sum, s) => sum + s.amount, 0);

  const filteredStudents = search.trim().length >= 1
    ? students.filter((s) => {
        const q = search.toLowerCase();
        return s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) || (s.parentPhone || '').includes(q);
      })
    : students;

  const admittingClassName = academicUnits.find((u) => u.id === form.academicUnitId)?.displayName || academicUnits.find((u) => u.id === form.academicUnitId)?.name || '';
  const studentFullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ds-text1">Student Admission</h1>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ds-border text-sm font-medium text-ds-text1 hover:bg-ds-bg2 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Import from Ledger
        </button>
      </div>

      {error && <div className="mb-4 bg-ds-error-bg border border-ds-error-border rounded-lg p-3 text-ds-error-text text-sm">{error}</div>}
      {success && <div className="mb-4 bg-ds-success-bg border border-ds-success-border rounded-lg p-3 text-ds-success-text text-sm">{success}</div>}

      {/* Undo last import banner */}
      {lastImportBatch && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{lastImportBatch.count} students</span> were imported recently.
            You can undo this if the data was incorrect.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={async () => {
                if (!confirm(`Delete all ${lastImportBatch.count} imported students? This cannot be undone.`)) return;
                setUndoing(true);
                try {
                  await apiFetch('/students/import-batch', {
                    method: 'DELETE',
                    body: JSON.stringify({ studentIds: lastImportBatch.studentIds }),
                  });
                  localStorage.removeItem(IMPORT_BATCH_KEY);
                  setLastImportBatch(null);
                  showSuccess(`${lastImportBatch.count} imported students deleted`);
                  void fetchStudents();
                } catch (e: any) { setError(e.message || 'Failed to undo import'); }
                finally { setUndoing(false); }
              }}
              disabled={undoing}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
              {undoing ? 'Deleting…' : 'Undo Import'}
            </button>
            <button onClick={() => { localStorage.removeItem(IMPORT_BATCH_KEY); setLastImportBatch(null); }}
              className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <AdmissionForm
        form={form} setForm={setForm}
        editingId={editingId} updating={updating}
        academicUnits={academicUnits} academicYears={academicYears}
        currentYearId={currentYearId} onCurrentYearIdChange={setCurrentYearId}
        error={error} draftSaved={draftSaved} activeDraftId={activeDraftId} drafts={drafts}
        onNext={() => void openFeeStep()} onUpdate={() => void handleUpdate()}
        onCancel={resetForm} onSaveDraft={() => saveDraft()}
        onLoadDraft={loadDraft} onDeleteDraft={deleteDraft}
      />

      {/* Recently Admitted */}
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
          <input className={`${inp} max-w-sm`} placeholder="Search by name, admission no, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="animate-pulse">
            <table className="w-full text-left text-sm">
              <thead className="bg-ds-bg2">
                <tr>{['Adm. No', 'Name', 'Class', 'Parent Mobile', 'Portal', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-3 bg-ds-bg2 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-ds-bg2 rounded w-32" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-ds-bg2 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-ds-bg2 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-ds-bg2 rounded-full w-20" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-ds-bg2 rounded w-16" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-ds-text3 text-sm">No students found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ds-bg2">
              <tr>{['Adm. No', 'Name', 'Class', 'Parent Mobile', 'Portal', 'Actions'].map((h) => <th key={h} className="px-4 py-3 text-xs font-medium text-ds-text2 uppercase tracking-wider">{h}</th>)}</tr>
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
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Parent linked
                          </span>
                        ) : (
                          <span className="text-xs text-ds-warning-text bg-ds-warning-bg border border-ds-warning-border rounded-full px-2 py-0.5">No portal</span>
                        )}
                      </td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => openLinkModal(s)} className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">{hasParent ? 'Re-link' : 'Link Parent'}</button>
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

      <FeeConfirmModal
        open={showFeeStep}
        onClose={() => { setShowFeeStep(false); setError(null); }}
        studentName={studentFullName}
        className={admittingClassName}
        parentPhone={form.parentPhone}
        loadingFees={loadingFees}
        activePlan={activePlan}
        feeStructures={feeStructures}
        totalFeeStructure={totalFeeStructure}
        existingParentInfo={existingParentInfo}
        collectNow={collectNow} onCollectNowChange={setCollectNow}
        feeItems={feeItems} onFeeItemsChange={setFeeItems}
        paymentMode={paymentMode} onPaymentModeChange={setPaymentMode}
        feeDueDate={feeDueDate} onFeeDueDateChange={setFeeDueDate}
        confirming={confirming} error={error}
        onConfirm={() => void confirmAdmission()}
      />

      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />

      <StudentProfilePanel
        student={profileStudent}
        onClose={() => setProfileStudent(null)}
        onUnlink={(id, role) => void handleUnlink(id, role)}
        unlinking={unlinking}
        onOpenLinkModal={openLinkModal}
      />

      <LinkModal
        student={linkingStudent}
        onClose={() => { setLinkingStudent(null); setError(null); }}
        onSuccess={(msg) => { showSuccess(msg); setLinkingStudent(null); void fetchStudents(); }}
      />

      <ImportModal
        open={showImport}
        academicUnits={academicUnits}
        onClose={() => setShowImport(false)}
        onImportComplete={async (batch) => { setLastImportBatch(batch); setShowImport(false); await fetchStudents(); }}
      />
    </div>
  );
}
