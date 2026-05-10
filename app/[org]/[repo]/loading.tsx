export default function RepoSegmentLoading() {
  return (
    <div className="w-full max-w-6xl animate-pulse space-y-6 p-5 sm:p-6 lg:p-8">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-[#F9F7F7]/10" />
        <div className="h-9 max-w-lg rounded bg-[#F9F7F7]/10" />
        <div className="h-4 max-w-2xl rounded bg-[#F9F7F7]/7" />
        <div className="h-4 max-w-xl rounded bg-[#F9F7F7]/7" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#F9F7F7]/12 bg-[#F9F7F7]/8 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-24 bg-[#0A111A]" />
        ))}
      </div>
      <div className="h-56 rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]/60" />
    </div>
  );
}
