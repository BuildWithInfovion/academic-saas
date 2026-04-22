export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-ds-bg2 rounded-lg mb-2" />
      <div className="h-4 w-72 bg-ds-bg2 rounded mb-6" />
      <div className="bg-ds-surface rounded-xl border border-ds-border shadow-sm p-6 mb-4">
        <div className="h-4 w-32 bg-ds-bg2 rounded mb-4" />
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="h-10 bg-ds-bg2 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
