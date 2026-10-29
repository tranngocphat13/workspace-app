'use client';

import React, { useEffect } from 'react';
import { AlertOctagon, RefreshCw, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Critical global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 antialiased font-sans">
        <div
          data-testid="global-error-container"
          className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertOctagon className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-zinc-100">
              Critical Application Error
            </h1>
            <p className="text-xs text-zinc-400">
              The application encountered an unhandled root exception. Try resetting the root component or reload the page.
            </p>
          </div>

          {error?.message && (
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono text-zinc-300 text-left overflow-x-auto max-h-32">
              {error.message}
            </div>
          )}

          {error?.digest && (
            <p className="text-[11px] text-zinc-500 font-mono">
              Digest: {error.digest}
            </p>
          )}

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors border border-zinc-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
