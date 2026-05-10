export default function RepoSegmentLoading() {
  return (
    <div className="w-full max-w-6xl animate-pulse space-y-6 p-5 sm:p-6 lg:p-8">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-white/10" />
        <div className="h-9 max-w-lg rounded bg-white/10" />
        <div className="h-4 max-w-2xl rounded bg-white/5" />
        <div className="h-4 max-w-xl rounded bg-white/5" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-24 bg-[#080d14]" />
        ))}
      </div>
      <div className="h-56 rounded-xl border border-white/8 bg-[#080d14]/60" />
    </div>
  );
}
