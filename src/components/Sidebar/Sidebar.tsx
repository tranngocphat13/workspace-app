'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, UserPlus, X, Hash, UserCheck } from 'lucide-react';
import { SidebarHeader } from './SidebarHeader';
import { ChannelList } from './ChannelList';
import { UserFooter } from './UserFooter';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { User } from '../../types';

export const Sidebar: React.FC = () => {
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const channels = useWorkspaceStore((state) => state.channels);
  const createChannel = useWorkspaceStore((state) => state.createChannel);
  const addMemberToChannel = useWorkspaceStore((state) => state.addMemberToChannel);
  const currentUser = useWorkspaceStore((state) => state.currentUser);
  const fetchChannels = useWorkspaceStore((state) => state.fetchChannels);
  const subscribeToChannelChanges = useWorkspaceStore((state) => state.subscribeToChannelChanges);
  const fetchUnreadCounts = useWorkspaceStore((state) => state.fetchUnreadCounts);
  const subscribeToReadStateChanges = useWorkspaceStore((state) => state.subscribeToReadStateChanges);

  useEffect(() => {
    fetchChannels?.();
    fetchUnreadCounts?.();
    const unsubChannels = subscribeToChannelChanges?.();
    const unsubReadState = subscribeToReadStateChanges?.();
    return () => {
      unsubChannels?.();
      unsubReadState?.();
    };
  }, [fetchChannels, fetchUnreadCounts, subscribeToChannelChanges, subscribeToReadStateChanges]);

  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customUserId, setCustomUserId] = useState('');

  // Real profiles fetched from Supabase
  const [realProfiles, setRealProfiles] = useState<User[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activeMembers = activeChannel?.members || [];

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    await createChannel(newChannelName.trim(), newChannelDesc.trim());
    setNewChannelName('');
    setNewChannelDesc('');
    setIsCreateChannelOpen(false);
  };

  const handleOpenAddMember = async () => {
    setAddMemberError(null);
    setProfilesError(null);
    setRealProfiles([]);
    setSelectedUserId('');
    setCustomUserId('');
    setIsAddMemberOpen(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured && currentUser) {
      setProfilesLoading(true);
      try {
        const { data, error } = await client
          .from('profiles')
          .select('id, name, avatar_url, status_text')
          .neq('id', currentUser.id)
          .order('name', { ascending: true })
          .limit(50);

        if (error) {
          setProfilesError('Could not load users: ' + error.message);
        } else if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const users: User[] = data.map((p: any) => ({
            id: p.id,
            name: p.name || 'Member',
            avatarUrl: p.avatar_url || undefined,
            statusText: p.status_text || 'Online',
          }));
          setRealProfiles(users);
        }
      } catch {
        setProfilesError('Could not load users');
      } finally {
        setProfilesLoading(false);
      }
    }
    // If Supabase not configured: realProfiles stays empty, modal shows a message
  };

  const handleCloseAddMember = () => {
    setIsAddMemberOpen(false);
    setProfilesError(null);
    setAddMemberError(null);
    setSelectedUserId('');
    setCustomUserId('');
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError(null);
    const targetId = customUserId.trim() || selectedUserId.trim();
    if (!targetId || !activeChannelId) return;

    let userToAdd: User | null = null;

    // Check in already-loaded profiles first
    userToAdd = realProfiles.find((u) => u.id === targetId) || null;

    // If not found (custom UUID entered), try to look it up from DB
    if (!userToAdd && isSupabaseConfigured) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      try {
        const { data } = await client
          .from('profiles')
          .select('id, name, avatar_url, status_text')
          .eq('id', targetId)
          .single();
        if (data) {
          userToAdd = {
            id: data.id,
            name: data.name || 'Member',
            avatarUrl: data.avatar_url,
            statusText: data.status_text || 'Online',
          };
        }
      } catch {
        // not found — userToAdd stays null
      }
    }

    if (!userToAdd) {
      setAddMemberError('User not found. Please select a registered user.');
      return;
    }

    // Prevent adding self
    if (currentUser && userToAdd.id === currentUser.id) {
      setAddMemberError('You are already a member of this channel.');
      return;
    }

    // Check not already a member
    if (activeMembers.some((m) => m.id === userToAdd!.id)) {
      setAddMemberError('User is already a member of this channel.');
      return;
    }

    try {
      await addMemberToChannel(activeChannelId, userToAdd);
      setSelectedUserId('');
      setCustomUserId('');
      setAddMemberError(null);
      setIsAddMemberOpen(false);
    } catch {
      setAddMemberError('Failed to add member. Check permissions.');
    }
  };

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col bg-zinc-950 border-r border-zinc-800 h-full select-none relative"
      data-testid="sidebar"
      aria-label="Workspace Sidebar"
    >
      <SidebarHeader />

      <div className="px-3 pt-3 pb-1 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setIsCreateChannelOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/60 text-xs font-medium transition-colors"
          title="Tạo cuộc trò chuyện mới (Insert into Channel table)"
        >
          <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
          <span>New Channel</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenAddMember()}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/60 text-xs font-medium transition-colors"
          title="Thêm thành viên vào kênh (Insert into Member table)"
        >
          <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add Member</span>
        </button>
      </div>

      <ChannelList />
      <UserFooter />

      {/* Modal: Create Conversation */}
      {isCreateChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-5 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm">Create Conversation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateChannelOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateChannelSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. project-updates"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="What is this channel about?"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateChannelOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Member */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-5 text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">
                  Add Member to #{activeChannel?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseAddMember}
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddMemberSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Select User
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {/* Loading state */}
                  {profilesLoading && (
                    <p className="text-xs text-zinc-500 italic px-1 py-2">Loading users…</p>
                  )}

                  {/* Error fetching profiles */}
                  {profilesError && !profilesLoading && (
                    <p className="text-xs text-red-400 px-1 py-2">{profilesError}</p>
                  )}

                  {/* Supabase not configured */}
                  {!isSupabaseConfigured && !profilesLoading && (
                    <p className="text-xs text-zinc-500 italic px-1 py-2">
                      Connect Supabase to see registered users.
                    </p>
                  )}

                  {/* No users found */}
                  {isSupabaseConfigured && !profilesLoading && !profilesError && realProfiles.length === 0 && (
                    <p className="text-xs text-zinc-500 italic px-1 py-2">No other users found.</p>
                  )}

                  {/* Real profile list */}
                  {realProfiles.map((user) => {
                    const isAlreadyMember = activeMembers.some((m) => m.id === user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        disabled={isAlreadyMember}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setCustomUserId('');
                          setAddMemberError(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                          isAlreadyMember
                            ? 'opacity-40 bg-zinc-800/40 border-zinc-800 cursor-not-allowed'
                            : selectedUserId === user.id
                            ? 'bg-blue-950/60 border-blue-500 text-white'
                            : 'bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800 text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.avatarUrl}
                              alt={user.name}
                              className="w-5 h-5 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-semibold text-zinc-300 shrink-0">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{user.name}</span>
                        </div>
                        {isAlreadyMember && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-0.5 shrink-0 ml-2">
                            <UserCheck className="w-3 h-3" /> Joined
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Or Enter User UUID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-…"
                  value={customUserId}
                  onChange={(e) => {
                    setCustomUserId(e.target.value);
                    setSelectedUserId('');
                    setAddMemberError(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Inline error message */}
              {addMemberError && (
                <p className="text-xs text-red-400">{addMemberError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseAddMember}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customUserId.trim() && !selectedUserId.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
