'use client';

import AnnouncementsList from '@/components/announcements-list';

export default function ParentAnnouncementsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ds-text1 mb-1">Announcements</h1>
      <p className="text-sm text-ds-text3 mb-6">Notices from school management</p>
      <AnnouncementsList canCreate={false} />
    </div>
  );
}
