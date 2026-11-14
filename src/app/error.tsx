'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-[100dvh] w-full bg-[#0B0D18] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-2xl bg-[#10132B] border border-purple-500/30 p-6 space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Something went wrong</h2>
          <p className="text-xs text-slate-400 break-words">
            {error?.message || 'An unexpected rendering error occurred.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4824D5] to-[#7438F5] text-white text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reload Workspace</span>
        </button>
      </div>
    </div>
  );
}
