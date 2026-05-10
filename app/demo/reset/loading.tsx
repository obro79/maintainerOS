export default function DemoResetLoading() {
  return (
    <div className="min-h-screen bg-[#030509] text-white">
      <div className="w-full max-w-6xl animate-pulse space-y-6 p-5 sm:p-6 lg:p-8">
        <div className="space-y-3">
          <div className="h-3 w-36 rounded bg-white/10" />
          <div className="h-9 max-w-md rounded bg-white/10" />
          <div className="h-4 max-w-2xl rounded bg-white/5" />
        </div>
        <div className="h-40 rounded-xl border border-white/8 bg-[#080d14]/60" />
      </div>
    </div>
  );
}
