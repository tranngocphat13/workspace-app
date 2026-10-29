'use client';

import React, { useState, useMemo } from 'react';
import { Plus, X, Hash, MessageSquare, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { ChannelItem } from './ChannelItem';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { User } from '../../types';

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
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  const regularChannels = channels.filter((c) => !c.isDm);
  const dmChannels = channels.filter((c) => c.isDm);

  const handleOpenStartDm = async () => {
    setIsStartingDm(true);
    setDmError(null);
    setDmSearchQuery('');

    if (supabase && isSupabaseConfigured) {
      setIsLoadingProfiles(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, status_text')
          .neq('id', currentUser.id)
          .order('name', { ascending: true })
          .limit(50);

        if (error) {
          setDmError('Failed to load profiles');
        } else if (data) {
          const users: User[] = data.map((p) => ({
            id: p.id,
            name: p.name || 'Member',
            avatarUrl: p.avatar_url || undefined,
            statusText: p.status_text || 'Online',
          }));
          setProfiles(users);
        }
      } catch {
        setDmError('Failed to load profiles');
      } finally {
        setIsLoadingProfiles(false);
      }
    } else {
      // In offline/mock mode: derive available users from channels' existing members
      const memberMap = new Map<string, User>();
      channels.forEach((ch) => {
        ch.members?.forEach((m) => {
          if (m.id && m.id !== currentUser.id) {
            memberMap.set(m.id, m);
          }
        });
      });
      setProfiles(Array.from(memberMap.values()));
    }
  };

  const handleCloseStartDm = () => {
    setIsStartingDm(false);
    setDmError(null);
    setDmSearchQuery('');
  };

  const filteredUsers = useMemo(() => {
    const query = dmSearchQuery.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        (u.statusText && u.statusText.toLowerCase().includes(query))
    );
  }, [profiles, dmSearchQuery]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    await createChannel(newChannelName.trim(), newChannelDesc.trim());
    setNewChannelName('');
    setNewChannelDesc('');
    setIsCreatingChannel(false);
  };

  const handleSelectDmUser = async (targetUser: User) => {
    try {
      setDmError(null);
      await getOrCreateDmChannel(targetUser);
      setIsStartingDm(false);
      setDmSearchQuery('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create DM';
      setDmError(msg);
    }
  };

  const handleCustomDmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = dmSearchQuery.trim();
    if (!query) return;

    // Find in loaded profiles by exact name or ID match
    const matched = profiles.find(
      (u) => u.name.toLowerCase() === query.toLowerCase() || u.id === query
    );

    if (matched) {
      await handleSelectDmUser(matched);
    } else {
      setDmError(`No user found matching "${query}"`);
    }
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
            onClick={handleOpenStartDm}
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
                onClick={handleCloseStartDm}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {dmError && (
              <p className="text-[11px] text-red-400">{dmError}</p>
            )}

            {isLoadingProfiles ? (
              <div className="py-4 flex items-center justify-center text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin mr-1.5 text-blue-500" />
                <span>Loading users...</span>
              </div>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="px-2 py-2 text-zinc-500 italic text-center">
                    No users available
                  </p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectDmUser(u)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left text-zinc-200 transition-colors"
                    >
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt={u.name}
                          className="w-4 h-4 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] text-zinc-300 shrink-0 font-medium">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate flex-1 font-medium">{u.name}</span>
                      {u.statusText && (
                        <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">
                          {u.statusText}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            <form onSubmit={handleCustomDmSubmit} className="pt-1 border-t border-zinc-800 flex gap-1">
              <input
                type="text"
                placeholder="Search user..."
                value={dmSearchQuery}
                onChange={(e) => {
                  setDmSearchQuery(e.target.value);
                  setDmError(null);
                }}
                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!dmSearchQuery.trim()}
                className="px-2.5 py-1 rounded bg-blue-600 text-white disabled:opacity-50 text-xs font-medium hover:bg-blue-500 transition-colors"
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
