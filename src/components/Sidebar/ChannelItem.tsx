'use client';

import React from 'react';
import { Hash, MessageSquare, Bell, Code, type LucideIcon } from 'lucide-react';
import type { Channel } from '../../types';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

const ICON_MAP: Record<Channel['iconName'], LucideIcon> = {
  Hash,
  MessageSquare,
  Bell,
  Code,
};

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
}

export const ChannelItem: React.FC<ChannelItemProps> = ({ channel, isActive }) => {
  const setActiveChannel = useWorkspaceStore((state) => state.setActiveChannel);
  const unreadCount = useWorkspaceStore(
    (state) => state.unreadCounts[channel.id] || 0
  );
  const IconComponent = ICON_MAP[channel.iconName] || Hash;

  const handleClick = () => {
    setActiveChannel(channel.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={isActive ? 'channel-item active-channel' : 'channel-item'}
      data-channel-id={channel.id}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'page' : undefined}
      className={`group w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer select-none ${
        isActive
          ? 'bg-zinc-800 text-white font-medium shadow-xs'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-normal'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <IconComponent
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-300'
          }`}
          aria-hidden="true"
        />
        <span className="truncate">
          {channel.isDm ? `@${channel.name}` : `#${channel.name}`}
        </span>
      </div>

      <div className="flex items-center gap-1.5 ml-2">
        {unreadCount > 0 && !isActive && (
          <span
            data-testid="unread-badge"
            className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[18px] text-center leading-none"
          >
            {unreadCount}
          </span>
        )}

        {isActive && (
          <span
            data-testid="active-channel"
            className="sr-only"
            aria-hidden="true"
          >
            (active)
          </span>
        )}
      </div>
    </button>
  );
};
