'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface AcademicUnit {
  id: string;
  name: string;
  displayName: string | null;
  parent: { name: string; displayName: string | null } | null;
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  photoUrl: string | null;
  academicUnit: AcademicUnit | null;
}

function unitLabel(u: AcademicUnit | null): string {
  if (!u) return '';
  if (u.parent) return `${u.parent.displayName || u.parent.name} › ${u.displayName || u.name}`;
  return u.displayName || u.name;
}

function faceCropUrl(url: string): string {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/c_fill,g_face,w_160,h_200/');
}

export default function MyChildrenPage() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/students/child')
      .then((data) => {
        setChildren(Array.isArray(data) ? (data as Child[]) : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">My Children</h1>
      <p className="text-sm text-ds-text3 mb-6">
        Tap a profile to view details, upload a photo, or check academic records.
      </p>

      {children.length === 0 ? (
        <div className="bg-ds-surface border border-ds-border rounded-xl p-8 text-center">
          <p className="text-sm text-ds-text3">
            No children linked yet. Please contact the school office to link your child's account.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {children.map((child) => {
            const photo = child.photoUrl ? faceCropUrl(child.photoUrl) : null;
            return (
              <button
                key={child.id}
                onClick={() => router.push(`/portal/parent/students/${child.id}`)}
                className="w-full bg-ds-surface border border-ds-border rounded-xl p-4 flex items-center gap-4 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
              >
                {/* Photo */}
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-ds-border bg-slate-100 flex items-center justify-center shrink-0">
                  {photo
                    ? <img src={photo} alt="Photo" className="w-full h-full object-cover" />
                    : <span className="text-2xl text-slate-300 select-none">👤</span>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ds-text1">
                    {child.firstName} {child.lastName}
                  </p>
                  {child.academicUnit && (
                    <p className="text-sm text-ds-text3 mt-0.5">{unitLabel(child.academicUnit)}</p>
                  )}
                  <p className="text-xs font-mono text-ds-text3 mt-0.5">{child.admissionNo}</p>
                </div>

                {/* Arrow */}
                <span className="text-ds-text3 text-lg shrink-0">›</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Photo upload nudge — shown when any child lacks a photo */}
      {children.some((c) => !c.photoUrl) && (
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800">
            {children.filter((c) => !c.photoUrl).length === 1
              ? '1 child is missing a school photo'
              : `${children.filter((c) => !c.photoUrl).length} children are missing school photos`}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Open each child's profile and upload a photo. It will appear on their ID card.
          </p>
        </div>
      )}
    </div>
  );
}
