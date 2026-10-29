'use client';

import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useAuthStore } from '../../store/useAuthStore';

export const UserFooter: React.FC = () => {
  const currentUser = useWorkspaceStore((state) => state.currentUser);
  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [imageError, setImageError] = useState(false);

  // Prefer workspace store user (where active session / overrides live), fall back to auth user
  const displayUser = currentUser || authUser;

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const initials = displayUser?.name ? getInitials(displayUser.name) : 'U';

  return (
    <div
      className="h-14 px-3 border-t border-zinc-800 flex items-center justify-between flex-shrink-0 bg-zinc-950 select-none"
      data-testid="user-footer"
    >
      <div
        className="flex items-center gap-2.5 min-w-0 flex-1"
        data-testid="sidebar-footer"
      >
        <div className="relative shrink-0">
          {displayUser?.avatarUrl && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUser.avatarUrl}
              alt={displayUser.name}
              onError={() => setImageError(true)}
              className="w-8 h-8 rounded-full object-cover border border-zinc-700/80 bg-zinc-800"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 text-violet-300 flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
          )}
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-200 truncate">
            {displayUser?.name || 'Anonymous'}
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {displayUser?.statusText || authUser?.email || 'Online'}
          </div>
        </div>
      </div>

      {/* Logout button — only shown when authenticated */}
      {authUser && (
        <button
          type="button"
          onClick={logout}
          title="Đăng xuất"
          className="ml-2 p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
