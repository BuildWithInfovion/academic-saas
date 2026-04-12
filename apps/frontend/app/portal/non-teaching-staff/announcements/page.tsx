'use client';

import AnnouncementsList from '@/components/announcements-list';

export default function NonTeachingStaffAnnouncementsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Announcements</h1>
      <p className="text-sm text-gray-400 mb-6">Notices from school management</p>
      <AnnouncementsList canCreate={false} />
    </div>
  );
}
