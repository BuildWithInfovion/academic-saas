'use client';

import { usePortalAuthStore } from '@/store/portal-auth.store';

export default function StudentPortalPage() {
  const user = usePortalAuthStore((s) => s.user);

  return (
    <div className="p-6 max-w-lg mx-auto mt-16 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      </div>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>
        Student Portal
      </h1>
      <p className="text-sm mb-1" style={{ color: 'var(--text-2)' }}>
        Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
      </p>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
        Your student dashboard is being set up. Please contact your school administrator
        to link your student record to this account.
      </p>
    </div>
  );
}
