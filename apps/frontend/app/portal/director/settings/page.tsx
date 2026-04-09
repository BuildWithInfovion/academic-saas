'use client';

export default function DirectorSettingsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Institution Settings</h1>
      <p className="text-sm text-gray-400 mb-8">Configure institution details, academic structure, and system preferences</p>

      <div className="space-y-4">
        {[
          { title: 'Institution Profile', desc: 'Name, address, logo, contact details, affiliation board' },
          { title: 'Academic Year Management', desc: 'Create and manage academic years, set current year' },
          { title: 'Class Structure', desc: 'Add or manage divisions, sections, and class hierarchy' },
          { title: 'Fee Configuration', desc: 'Manage fee heads and default fee structures per class' },
          { title: 'Subject Master', desc: 'Institution-wide subject catalogue' },
          { title: 'Notification Settings', desc: 'SMS/email gateway configuration' },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </div>
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
