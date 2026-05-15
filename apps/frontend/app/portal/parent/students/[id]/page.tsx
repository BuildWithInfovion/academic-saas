'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AcademicUnitWithParent {
  id: string;
  name: string;
  displayName: string | null;
  parent: { name: string; displayName: string | null } | null;
}

interface ChildProfile {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  nationality: string | null;
  religion: string | null;
  motherTongue: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  fatherName: string | null;
  motherName: string | null;
  parentPhone: string | null;
  secondaryPhone: string | null;
  medicalConditions: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  admissionDate: string | null;
  photoUrl: string | null;
  academicUnit: AcademicUnitWithParent | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Cloudinary on-the-fly face-crop: inserts transformation after /upload/
// so whatever photo is stored, it's always displayed as a tight face crop.
function faceCropUrl(url: string, w = 300, h = 375): string {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/c_fill,g_face,w_${w},h_${h}/`);
}

function unitLabel(u: AcademicUnitWithParent | null): string {
  if (!u) return '—';
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-ds-border last:border-0">
      <span className="text-xs text-ds-text3 shrink-0 min-w-32">{label}</span>
      <span className="text-sm text-ds-text1 text-right font-medium leading-snug">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ds-surface border border-ds-border rounded-xl p-5 mb-4">
      <h3 className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChildProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [student, setStudent] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSaved, setPhotoSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/students/${id}/child-detail`)
      .then((data) => {
        setStudent(data as ChildProfile);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setFetchError((e as Error).message || 'Failed to load profile');
        setLoading(false);
      });
  }, [id]);

  const handlePhotoUpload = async (file: File) => {
    if (!student) return;
    setPhotoUploading(true);
    setPhotoError('');
    setPhotoSaved(false);

    try {
      // 1. Get signed Cloudinary credentials from backend (verifies parent ownership)
      const sig = await apiFetch<{
        signature: string;
        timestamp: number;
        apiKey: string;
        cloudName: string;
        folder: string;
      }>(`/students/${student.id}/parent-photo-signature`);

      // 2. Upload directly to Cloudinary (only signed params in FormData)
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sig.apiKey);
      fd.append('timestamp', String(sig.timestamp));
      fd.append('signature', sig.signature);
      fd.append('folder', sig.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: 'POST', body: fd },
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err?.error?.message || 'Upload failed — please try again.');
      }

      const data = await uploadRes.json() as { secure_url: string };

      // 3. Save the Cloudinary URL to the student record via parent-only endpoint
      await apiFetch(`/students/${student.id}/parent-photo`, {
        method: 'PATCH',
        body: JSON.stringify({ photoUrl: data.secure_url }),
      });

      setStudent((prev) => prev ? { ...prev, photoUrl: data.secure_url } : prev);
      setPhotoSaved(true);
      setTimeout(() => setPhotoSaved(false), 5000);
    } catch (e: unknown) {
      setPhotoError((e as Error).message || 'Upload failed');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoRemove = async () => {
    if (!student?.photoUrl) return;
    setPhotoRemoving(true);
    setPhotoError('');
    setPhotoSaved(false);
    try {
      await apiFetch(`/students/${student.id}/parent-photo`, {
        method: 'PATCH',
        body: JSON.stringify({ photoUrl: null }),
      });
      setStudent((prev) => prev ? { ...prev, photoUrl: null } : prev);
    } catch (e: unknown) {
      setPhotoError((e as Error).message || 'Failed to remove photo');
    } finally {
      setPhotoRemoving(false);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !student) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="bg-ds-error-bg border border-ds-error-border rounded-xl p-5 text-center">
          <p className="text-sm font-medium text-ds-error-text">{fetchError || 'Profile not found'}</p>
          <button
            onClick={() => router.back()}
            className="mt-3 text-sm text-ds-text3 hover:text-ds-text1 underline"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const displayPhoto = student.photoUrl ? faceCropUrl(student.photoUrl) : null;
  const cls = unitLabel(student.academicUnit);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">

      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-ds-text3 hover:text-ds-text1 mb-5 transition-colors"
      >
        <span>←</span> Back
      </button>

      {/* ── Profile header ── */}
      <div className="bg-ds-surface border border-ds-border rounded-2xl p-6 mb-4 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-ds-border bg-slate-100 flex items-center justify-center shrink-0">
          {displayPhoto
            ? <img src={displayPhoto} alt="Photo" className="w-full h-full object-cover" />
            : <span className="text-3xl text-slate-300 select-none">👤</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ds-text1 leading-tight">
            {student.firstName}
            {student.middleName ? ` ${student.middleName}` : ''}
            {` ${student.lastName}`}
          </h1>
          <p className="text-sm text-ds-text2 mt-0.5">{cls}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
              {student.admissionNo}
            </span>
            {student.rollNo && (
              <span className="text-xs text-ds-text3">Roll No: {student.rollNo}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo upload ── */}
      <div className="bg-ds-surface border border-ds-border rounded-xl p-5 mb-4">
        <h3 className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-3">
          School Photo
        </h3>
        <div className="flex items-start gap-5">
          {/* Preview */}
          <div className="w-16 h-20 rounded-lg border-2 border-dashed border-ds-border bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
            {displayPhoto
              ? <img src={displayPhoto} alt="Preview" className="w-full h-full object-cover" />
              : <span className="text-[10px] text-ds-text3 text-center leading-tight px-1">No<br/>photo</span>}
          </div>

          {/* Controls */}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <label
                className={`inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  photoUploading || photoRemoving
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 pointer-events-none'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent'
                }`}
              >
                {photoUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Uploading…
                  </>
                ) : student.photoUrl ? 'Replace Photo' : 'Upload Photo'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePhotoUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>

              {student.photoUrl && (
                <button
                  type="button"
                  onClick={() => void handlePhotoRemove()}
                  disabled={photoUploading || photoRemoving}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    photoRemoving
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
                  }`}
                >
                  {photoRemoving ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-xs">✕</span>
                  )}
                  {photoRemoving ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>

            <p className="text-xs text-ds-text3 mt-2 leading-relaxed">
              Upload any clear photo of your child. We automatically crop it to show the face — no need for a formal passport photo.
            </p>

            {photoError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
                <span className="text-red-500 mt-0.5 shrink-0 text-sm">✕</span>
                <p className="text-xs text-red-700 leading-relaxed">{photoError}</p>
              </div>
            )}

            {photoSaved && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-green-600 text-sm">✓</span>
                <p className="text-xs text-green-700 font-medium">Photo saved. It will appear on the ID card.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Academic Information ── */}
      <Section title="Academic Information">
        <InfoRow label="Class / Section" value={cls} />
        <InfoRow label="Admission No." value={student.admissionNo} />
        <InfoRow label="Roll No." value={student.rollNo} />
        <InfoRow label="Admission Date" value={fmtDate(student.admissionDate)} />
      </Section>

      {/* ── Personal Details ── */}
      <Section title="Personal Details">
        <InfoRow label="Date of Birth" value={fmtDate(student.dateOfBirth)} />
        <InfoRow label="Gender" value={student.gender} />
        <InfoRow label="Blood Group" value={student.bloodGroup} />
        <InfoRow label="Nationality" value={student.nationality} />
        <InfoRow label="Religion" value={student.religion} />
        <InfoRow label="Mother Tongue" value={student.motherTongue} />
      </Section>

      {/* ── Parent / Guardian ── */}
      <Section title="Parent / Guardian">
        <InfoRow label="Father's Name" value={student.fatherName} />
        <InfoRow label="Mother's Name" value={student.motherName} />
        <InfoRow label="Primary Phone" value={student.parentPhone} />
        <InfoRow label="Secondary Phone" value={student.secondaryPhone} />
      </Section>

      {/* ── Address — shown only if at least one field is present ── */}
      {(student.address || student.city || student.state || student.pinCode) && (
        <Section title="Address">
          <InfoRow label="Address" value={student.address} />
          <InfoRow label="City / Town" value={student.city} />
          <InfoRow label="State" value={student.state} />
          <InfoRow label="PIN Code" value={student.pinCode} />
        </Section>
      )}

      {/* ── Medical & Emergency — shown only if any relevant data present ── */}
      {(student.medicalConditions || student.emergencyContactName || student.bloodGroup) && (
        <Section title="Medical & Emergency">
          <InfoRow label="Blood Group" value={student.bloodGroup} />
          <InfoRow label="Medical Notes" value={student.medicalConditions} />
          <InfoRow label="Emergency Contact" value={student.emergencyContactName} />
          <InfoRow label="Relationship" value={student.emergencyContactRelation} />
          <InfoRow label="Emergency Phone" value={student.emergencyContactPhone} />
        </Section>
      )}

      <p className="text-xs text-ds-text3 text-center mt-2 mb-4">
        To update any student details, please contact the school office.
      </p>
    </div>
  );
}
