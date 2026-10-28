'use client';

import React, { useState } from 'react';
import { Plus, X, Hash, MessageSquare } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { ChannelItem } from './ChannelItem';
import type { User } from '../../types';

const SAMPLE_USERS: User[] = [
  {
    id: 'user-sarah',
    name: 'Sarah Chen',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
    statusText: 'Active',
  },
  {
    id: 'user-michael',
    name: 'Michael Scott',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
    statusText: 'Away',
  },
  {
    id: 'user-jessica',
    name: 'Jessica Taylor',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces',
    statusText: 'Focusing',
  },
  {
    id: 'user-david',
    name: 'David Kim',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
    statusText: 'Engineering',
  },
];

export const ChannelList: React.FC = () => {
  const channels = useWorkspaceStore((state) => state.channels);
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const createChannel = useWorkspaceStore((state) => state.createChannel);
  const getOrCreateDmChannel = useWorkspaceStore(
    (state) => state.getOrCreateDmChannel
  );
  const currentUser = useWorkspaceStore((state) => state.currentUser);

  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const [isStartingDm, setIsStartingDm] = useState(false);
  const [customDmName, setCustomDmName] = useState('');

  const regularChannels = channels.filter((c) => !c.isDm);
  const dmChannels = channels.filter((c) => c.isDm);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    await createChannel(newChannelName.trim(), newChannelDesc.trim());
    setNewChannelName('');
    setNewChannelDesc('');
    setIsCreatingChannel(false);
  };

  const handleSelectDmUser = async (targetUser: User) => {
    await getOrCreateDmChannel(targetUser);
    setIsStartingDm(false);
  };

  const handleCustomDmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDmName.trim()) return;
    const clean = customDmName.trim();
    const newUser: User = {
      id: `user-${clean.toLowerCase().replace(/\s+/g, '-')}`,
      name: clean,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(clean)}`,
      statusText: 'Online',
    };
    await getOrCreateDmChannel(newUser);
    setCustomDmName('');
    setIsStartingDm(false);
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4"
      data-testid="channel-list"
    >
      {/* ─── 1. Channels Section ───────────────────────────── */}
      <div>
        <div className="px-2 pb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" />
            <span>Channels</span>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingChannel(true)}
            title="Create channel"
            aria-label="Create channel"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isCreatingChannel && (
          <form
            onSubmit={handleCreateChannel}
            className="p-2 my-2 rounded-lg bg-zinc-900 border border-zinc-700/80 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-200">New Channel</span>
              <button
                type="button"
                onClick={() => setIsCreatingChannel(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="channel-name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingChannel(false)}
                className="px-2 py-1 rounded text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newChannelName.trim()}
                className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        )}

        <nav aria-label="Channels" className="space-y-0.5 mt-1">
          {regularChannels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === activeChannelId}
            />
          ))}
        </nav>
      </div>

      {/* ─── 2. Direct Messages Section ────────────────────── */}
      <div>
        <div className="px-2 pb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Direct Messages</span>
          </div>
          <button
            type="button"
            onClick={() => setIsStartingDm(true)}
            title="Start Direct Message"
            aria-label="Start direct message"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isStartingDm && (
          <div className="p-2 my-2 rounded-lg bg-zinc-900 border border-zinc-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-200">Start Direct Message</span>
              <button
                type="button"
                onClick={() => setIsStartingDm(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto">
              {SAMPLE_USERS.filter((u) => u.id !== currentUser.id).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectDmUser(u)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left text-zinc-200 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                  <span className="truncate flex-1">{u.name}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleCustomDmSubmit} className="pt-1 border-t border-zinc-800 flex gap-1">
              <input
                type="text"
                placeholder="Or user name..."
                value={customDmName}
                onChange={(e) => setCustomDmName(e.target.value)}
                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!customDmName.trim()}
                className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50 text-xs font-medium"
              >
                Chat
              </button>
            </form>
          </div>
        )}

        <nav aria-label="Direct Messages" className="space-y-0.5 mt-1">
          {dmChannels.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-zinc-500 italic">
              No direct messages yet
            </p>
          ) : (
            dmChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={channel.id === activeChannelId}
              />
            ))
          )}
        </nav>
      </div>
    </div>
  );
};
