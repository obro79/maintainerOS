'use client';

import { useEffect } from 'react';

export default function RepoSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="w-full max-w-6xl space-y-6 p-5 sm:p-6 lg:p-8">
      <header>
        <p className="mb-1 font-sans text-[10px] uppercase tracking-[0.25em] text-[#F9F7F7]/40">Repository view</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">This page could not load</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#F9F7F7]/56">
          Without live database credentials, use fixture or rehearsal data mode so pages still render. Check{' '}
          <code className="rounded bg-[#F9F7F7]/7 px-1.5 py-0.5 font-sans text-xs text-[#F9F7F7]/68">MAINTAINEROS_DATA_MODE</code>{' '}
          and connection env vars, then try again.
        </p>
      </header>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg border border-[#F9F7F7]/20 bg-[#F9F7F7]/7 px-4 py-2 text-sm text-white hover:bg-[#F9F7F7]/10"
      >
        Try again
      </button>
      {process.env.NODE_ENV === 'development' && (
        <pre className="max-h-48 overflow-auto rounded-lg border border-[#DBE2EF]/20 bg-[#112D4E]/30 p-3 font-sans text-xs text-[#DBE2EF]">
          {error.message}
        </pre>
      )}
    </div>
  );
}
