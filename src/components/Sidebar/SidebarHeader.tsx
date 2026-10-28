'use client';

import React from 'react';
import { MessageSquare, ChevronDown } from 'lucide-react';

interface SidebarHeaderProps {
  workspaceName?: string;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  workspaceName = 'Dev Workspace',
}) => {
  return (
    <div
      className="h-14 px-4 flex items-center justify-between border-b border-zinc-800 flex-shrink-0 bg-zinc-950/60"
      data-testid="workspace-header"
    >
      <div
        className="flex items-center gap-2.5 min-w-0"
        data-testid="sidebar-header"
      >
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 shrink-0 shadow-inner">
          <MessageSquare className="w-4 h-4 text-blue-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-zinc-100 truncate tracking-tight">
            {workspaceName}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">Real-time Workspace</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Workspace menu"
        className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
};
