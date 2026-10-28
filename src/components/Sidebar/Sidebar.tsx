'use client';

import React, { useState } from 'react';
import { PlusCircle, UserPlus, X, Hash, UserCheck } from 'lucide-react';
import { SidebarHeader } from './SidebarHeader';
import { ChannelList } from './ChannelList';
import { UserFooter } from './UserFooter';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
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

export const Sidebar: React.FC = () => {
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const channels = useWorkspaceStore((state) => state.channels);
  const createChannel = useWorkspaceStore((state) => state.createChannel);
  const addMemberToChannel = useWorkspaceStore((state) => state.addMemberToChannel);

  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customUserId, setCustomUserId] = useState('');

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

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = customUserId.trim() || selectedUserId.trim();
    if (!targetId || !activeChannelId) return;

    const matchedUser = SAMPLE_USERS.find((u) => u.id === targetId);
    const userToAdd: User = matchedUser || {
      id: targetId,
      name: targetId,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(targetId)}`,
      statusText: 'Member',
    };

    await addMemberToChannel(activeChannelId, userToAdd);
    setSelectedUserId('');
    setCustomUserId('');
    setIsAddMemberOpen(false);
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
          onClick={() => setIsAddMemberOpen(true)}
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
                onClick={() => setIsAddMemberOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddMemberSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Select User ID
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {SAMPLE_USERS.map((user) => {
                    const isAlreadyMember = activeMembers.some((m) => m.id === user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        disabled={isAlreadyMember}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setCustomUserId('');
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-5 h-5 rounded-full object-cover shrink-0"
                          />
                          <span className="truncate">{user.name}</span>
                          <span className="text-[10px] text-zinc-500">({user.id})</span>
                        </div>
                        {isAlreadyMember && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
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
                  Or Enter User ID Manually
                </label>
                <input
                  type="text"
                  placeholder="e.g. user-alex or user-123"
                  value={customUserId}
                  onChange={(e) => {
                    setCustomUserId(e.target.value);
                    setSelectedUserId('');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
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
