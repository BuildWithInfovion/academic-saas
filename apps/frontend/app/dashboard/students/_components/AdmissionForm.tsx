'use client';

import React from 'react';
import type { AcademicUnit, AcademicYear } from '@/lib/types';
import { DateSelect } from './DateSelect';
import { QUALIFICATIONS, INDIAN_STATES, INCOME_BRACKETS, emptyForm, AdmissionDraft } from './students-utils';

const inp = 'border border-ds-border-strong p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';
const lbl = 'text-xs font-medium text-ds-text2 block mb-1';
const sec = 'text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-3 mt-1 pb-1 border-b border-ds-border';

function Checkbox({ checked, onChange, label, desc }: { checked: boolean; onChange: () => void; label: string; desc?: string }) {
  return (
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
}

interface Props {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  editingId: string | null;
  updating: boolean;
  academicUnits: AcademicUnit[];
  academicYears: AcademicYear[];
  currentYearId: string;
  onCurrentYearIdChange: (id: string) => void;
  error: string | null;
  draftSaved: boolean;
  activeDraftId: string | null;
  drafts: AdmissionDraft[];
  onNext: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onLoadDraft: (draft: AdmissionDraft) => void;
  onDeleteDraft: (id: string) => void;
}

export function AdmissionForm({
  form, setForm, editingId, updating,
  academicUnits, academicYears, currentYearId, onCurrentYearIdChange,
  error, draftSaved, activeDraftId, drafts,
  onNext, onUpdate, onCancel, onSaveDraft, onLoadDraft, onDeleteDraft,
}: Props) {
  const sf = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <div className="bg-ds-surface shadow-sm rounded-xl p-6 mb-6 border border-ds-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-ds-text1">{editingId ? 'Edit Student Record' : 'Admission Form'}</h2>
            {!editingId && <p className="text-xs text-ds-text3 mt-0.5">Step 1 of 2 — Complete student details, then proceed to fee confirmation</p>}
          </div>
          {editingId && <button onClick={onCancel} className="text-sm text-ds-text2 hover:text-ds-text1 underline">Cancel Edit</button>}
        </div>

        {(academicUnits.length === 0 || academicYears.length === 0) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Setup required before admission</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              {academicUnits.length === 0 && <li>No classes configured — <a href="/dashboard/classes" className="underline font-medium">Go to Classes</a> to add LKG, Class 1, etc.</li>}
              {academicYears.length === 0 && <li>No academic year set up — <a href="/dashboard/settings" className="underline font-medium">Go to Settings</a> to add 2025-26.</li>}
            </ul>
          </div>
        )}

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
            <select className={inp} value={currentYearId} onChange={(e) => onCurrentYearIdChange(e.target.value)}>
              <option value="">{academicYears.length === 0 ? '— No academic year —' : 'Select Year'}</option>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Date of Admission</label>
            <DateSelect value={form.admissionDate} onChange={(v) => setForm({ ...form, admissionDate: v })} minYear={2000} maxYear={new Date().getFullYear()} />
          </div>
        </div>

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
            <select className={inp} value={form.motherTongue} onChange={sf('motherTongue')}>
              <option value="">Select</option>
              {['Hindi','Marathi','Kannada','Tamil','Telugu','Malayalam','Gujarati','Punjabi','Bengali','Odia','Assamese','Urdu','Konkani','Sindhi','Nepali','Sanskrit','Maithili','Kashmiri','Manipuri','Bodo','Santali','Dogri','Tulu','Bhili','Gondi','Kurukh','Other'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
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
              <button onClick={onUpdate} disabled={updating} className="flex-1 btn-brand px-4 py-2.5 rounded-lg">
                {updating ? 'Updating...' : 'Update Student Record'}
              </button>
              <button onClick={onCancel} className="px-6 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={onNext} className="btn-brand w-full px-4 py-2.5 rounded-lg">
                Next: Fee &amp; Confirm Admission →
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onSaveDraft}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-ds-border text-sm font-medium text-ds-text2 hover:bg-ds-bg2 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  {draftSaved ? '✓ Draft Saved' : activeDraftId ? 'Update Draft' : 'Save as Draft'}
                </button>
                {activeDraftId && (
                  <span className="text-xs text-ds-brand font-medium px-2 py-1 bg-ds-info-bg border border-ds-info-border rounded-md">Draft active</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
                  <button onClick={() => onLoadDraft(draft)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-ds-border text-ds-text2 hover:bg-ds-bg2 transition-colors">
                    {activeDraftId === draft.id ? 'Editing' : 'Continue →'}
                  </button>
                  <button onClick={() => onDeleteDraft(draft.id)} className="p-1.5 text-ds-text3 hover:text-red-500 rounded transition-colors" title="Delete draft">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
