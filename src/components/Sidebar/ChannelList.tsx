'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { ChannelItem } from './ChannelItem';

export const ChannelList: React.FC = () => {
  const channels = useWorkspaceStore((state) => state.channels);
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const createChannel = useWorkspaceStore((state) => state.createChannel);

  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    createChannel(newChannelName.trim(), newChannelDesc.trim());
    setNewChannelName('');
    setNewChannelDesc('');
    setIsCreating(false);
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-1"
      data-testid="channel-list"
    >
      <div className="px-2 pb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <span>Channels</span>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          title="Tạo cuộc trò chuyện mới"
          aria-label="Create channel"
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="p-2 mb-2 rounded-lg bg-zinc-900 border border-zinc-700/80 space-y-2 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-200">Tạo cuộc trò chuyện</span>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Tên kênh (ví dụ: du-an-moi)"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <input
            type="text"
            placeholder="Mô tả (tuỳ chọn)"
            value={newChannelDesc}
            onChange={(e) => setNewChannelDesc(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-2 py-1 rounded text-zinc-400 hover:bg-zinc-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!newChannelName.trim()}
              className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Tạo
            </button>
          </div>
        </form>
      )}

      <nav aria-label="Channels" className="space-y-0.5">
        {channels.map((channel) => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isActive={channel.id === activeChannelId}
          />
        ))}
      </nav>
    </div>
  );
};
