'use client';

import AnnouncementsList from '@/components/announcements-list';

export default function PrincipalAnnouncementsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Announcements</h1>
      <p className="text-sm text-gray-400 mb-6">Post and review school-wide announcements</p>
      <AnnouncementsList canCreate={true} />
    </div>
  );
}
