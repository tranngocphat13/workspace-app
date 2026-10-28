'use client';

import React, { useState } from 'react';
import { Hash, MessageSquare, Bell, Code, UserPlus, Users, X, type LucideIcon } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { Channel, User } from '../../types';

const ICON_MAP: Record<Channel['iconName'], LucideIcon> = {
  Hash,
  MessageSquare,
  Bell,
  Code,
};

export const ChatHeader: React.FC = () => {
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const channels = useWorkspaceStore((state) => state.channels);
  const addMemberToChannel = useWorkspaceStore((state) => state.addMemberToChannel);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userName, setUserName] = useState('');

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) || channels[0];

  const IconComponent =
    activeChannel && ICON_MAP[activeChannel.iconName]
      ? ICON_MAP[activeChannel.iconName]
      : Hash;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !activeChannel) return;
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: userName.trim(),
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName.trim())}`,
      statusText: 'Online',
    };
    addMemberToChannel(activeChannel.id, newUser);
    setUserName('');
    setIsAddUserOpen(false);
  };

  const members = activeChannel?.members || [];

  return (
    <header
      className="h-14 px-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xs shrink-0 select-none relative"
      data-testid="chat-header"
    >
      <div className="flex items-center gap-2 min-w-0">
        <IconComponent className="w-5 h-5 text-zinc-400 shrink-0" aria-hidden="true" />
        <span className="text-zinc-400 font-normal">#</span>
        <h2
          className="text-base font-semibold text-zinc-100 truncate"
          data-testid="chat-channel-name"
        >
          {activeChannel?.name || 'general'}
        </h2>
        {activeChannel?.description && (
          <span className="text-xs text-zinc-400 hidden sm:inline ml-3 border-l border-zinc-700 pl-3 truncate">
            {activeChannel.description}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1 text-xs text-zinc-400">
          <Users className="w-3.5 h-3.5" />
          <span>{members.length} thành viên</span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddUserOpen(!isAddUserOpen)}
          title="Thêm người vào cuộc trò chuyện"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Thêm người</span>
        </button>
      </div>

      {isAddUserOpen && (
        <div className="absolute right-6 top-16 w-72 p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-zinc-200">
              Thêm người vào #{activeChannel?.name}
            </h4>
            <button
              onClick={() => setIsAddUserOpen(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <form onSubmit={handleAddMember} className="space-y-2">
            <input
              type="text"
              placeholder="Tên người dùng mới"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!userName.trim()}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50"
              >
                Thêm
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
};
