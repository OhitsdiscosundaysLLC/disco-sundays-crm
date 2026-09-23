export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-32 animate-pulse rounded bg-neutral-200" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
          />
        ))}
      </div>
    </div>
  );
}
