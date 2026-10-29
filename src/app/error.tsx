'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home as HomeIcon } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled workspace error:', error);
  }, [error]);

  return (
    <div
      data-testid="error-boundary-container"
      className="h-screen h-dvh flex items-center justify-center p-4 bg-zinc-900 text-zinc-100"
    >
      <div className="max-w-md w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl p-6 shadow-2xl space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">
            Something went wrong in the workspace
          </h2>
          <p className="text-xs text-zinc-400">
            An unexpected error occurred while rendering this view. You can retry the operation or return to the main channel.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300 text-left overflow-x-auto max-h-32">
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium transition-colors border border-zinc-600"
          >
            <HomeIcon className="w-3.5 h-3.5" />
            Reload Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
