'use client';

import type { Student } from '@/lib/types';

export function StudentProfilePanel({ student, onClose, onUnlink, unlinking, onOpenLinkModal }: {
  student: Student | null;
  onClose: () => void;
  onUnlink: (studentId: string, role: 'student' | 'parent') => void;
  unlinking: boolean;
  onOpenLinkModal: (student: Student) => void;
}) {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-ds-surface h-full shadow-xl flex flex-col overflow-y-auto">
        <div className="px-6 py-5 border-b border-ds-border flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-ds-text1">{student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}</h2>
            <p className="text-xs text-ds-text3 font-mono">{student.admissionNo}</p>
          </div>
          <button onClick={onClose} className="text-ds-text3 hover:text-ds-text2 text-xl">×</button>
        </div>
        <div className="flex-1 px-6 py-5 space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">Class</p>
            <p className="text-ds-text1">{(student.academicUnit as any)?.displayName || (student.academicUnit as any)?.name || 'Not assigned'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">Parents</p>
            <p>{student.fatherName} / {student.motherName}</p>
            <p className="text-ds-text2">{student.parentPhone}{student.secondaryPhone ? ` · ${student.secondaryPhone}` : ''}</p>
          </div>
          {student.city && (
            <div>
              <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-1">Address</p>
              <p className="text-ds-text2 text-xs">{[student.address, student.locality, student.city, student.state, student.pinCode].filter(Boolean).join(', ')}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-2">Parent Portal</p>
            {student.parentUser ? (
              <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ds-success-text">Linked &amp; Active</p>
                  <p className="text-xs text-ds-success-text mt-0.5">{student.parentUser.email || student.parentUser.phone || student.parentUser.id.slice(-8)}</p>
                </div>
                <button onClick={() => onUnlink(student.id, 'parent')} disabled={unlinking} className="text-xs text-red-500 hover:text-ds-error-text font-medium">Unlink</button>
              </div>
            ) : (
              <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3">
                <p className="text-xs text-ds-warning-text">No parent portal account linked.</p>
                <button onClick={() => { onClose(); onOpenLinkModal(student); }} className="text-xs text-indigo-600 hover:underline mt-1">Link manually →</button>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-ds-text3 uppercase tracking-wider mb-2">Student Portal</p>
            {student.userAccount ? (
              <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ds-success-text">Linked</p>
                  <p className="text-xs text-ds-success-text">{student.userAccount.email || student.userAccount.phone}</p>
                </div>
                <button onClick={() => onUnlink(student.id, 'student')} disabled={unlinking} className="text-xs text-red-500 hover:text-ds-error-text font-medium">Unlink</button>
              </div>
            ) : (
              <p className="text-xs text-ds-text3">Not linked</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
