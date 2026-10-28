'use client';

import React, { useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const InAppNotification: React.FC = () => {
  const notification = useWorkspaceStore((state) => state.notification);
  const dismissNotification = useWorkspaceStore((state) => state.dismissNotification);
  const setActiveChannel = useWorkspaceStore((state) => state.setActiveChannel);
  const channels = useWorkspaceStore((state) => state.channels);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      dismissNotification();
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, dismissNotification]);

  if (!notification) return null;

  const targetChannel = channels.find((c) => c.id === notification.channelId);
  const channelLabel = targetChannel?.isDm
    ? `@${targetChannel.name}`
    : `#${targetChannel?.name || notification.channelId}`;

  const handleClick = () => {
    setActiveChannel(notification.channelId);
    dismissNotification();
  };

  return (
    <aside
      data-testid="in-app-notification"
      aria-label="New Message Notification"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-zinc-900 border border-blue-500/40 rounded-xl shadow-2xl p-3.5 text-zinc-100 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 shrink-0 mt-0.5">
        <MessageSquare className="w-4 h-4" />
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="flex-1 min-w-0 text-left hover:opacity-90 cursor-pointer"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-semibold text-xs text-white">
            {notification.title}
          </span>
          <span className="text-[10px] text-zinc-400 px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700">
            {channelLabel}
          </span>
        </div>
        <p className="text-xs text-zinc-300 truncate">{notification.message}</p>
      </button>

      <button
        type="button"
        onClick={dismissNotification}
        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
};
