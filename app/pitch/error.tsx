'use client';

import { useEffect } from 'react';

export default function PitchError({
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
    <div className="min-h-screen bg-[#030509] text-white">
      <div className="w-full max-w-6xl space-y-6 p-5 sm:p-6 lg:p-8">
        <header>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">Pitch</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white">Pitch assets could not load</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Retry to reload this shell. The pitch page does not require provider credentials.
          </p>
        </header>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          Try again
        </button>
        {process.env.NODE_ENV === 'development' && (
          <pre className="max-h-48 overflow-auto rounded-lg border border-red-500/20 bg-red-950/30 p-3 font-mono text-xs text-red-200/90">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  );
}
