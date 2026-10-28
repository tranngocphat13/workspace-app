'use client';

import React, { useState } from 'react';
import {
  Hash,
  MessageSquare,
  Bell,
  Code,
  UserPlus,
  Users,
  X,
  Settings,
  Trash2,
  LogOut,
  Search,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { Channel, User } from '../../types';
import { SearchModal } from '../Search/SearchModal';

const ICON_MAP: Record<Channel['iconName'], LucideIcon> = {
  Hash,
  MessageSquare,
  Bell,
  Code,
};

export const ChatHeader: React.FC = () => {
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const channels = useWorkspaceStore((state) => state.channels);
  const currentUser = useWorkspaceStore((state) => state.currentUser);
  const addMemberToChannel = useWorkspaceStore((state) => state.addMemberToChannel);
  const updateChannel = useWorkspaceStore((state) => state.updateChannel);
  const deleteChannel = useWorkspaceStore((state) => state.deleteChannel);
  const leaveChannel = useWorkspaceStore((state) => state.leaveChannel);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userName, setUserName] = useState('');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) || channels[0];

  const IconComponent =
    activeChannel && ICON_MAP[activeChannel.iconName]
      ? ICON_MAP[activeChannel.iconName]
      : Hash;

  const isOwner =
    activeChannel?.ownerId === currentUser.id ||
    activeChannel?.ownerId === null ||
    !activeChannel?.ownerId;

  const isDefaultChannel = activeChannel?.id === 'general';
  const isDm = Boolean(activeChannel?.isDm);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !activeChannel) return;
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: userName.trim(),
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        userName.trim()
      )}`,
      statusText: 'Online',
    };
    addMemberToChannel(activeChannel.id, newUser);
    setUserName('');
    setIsAddUserOpen(false);
  };

  const handleOpenEdit = () => {
    if (!activeChannel) return;
    setEditName(activeChannel.name);
    setEditDesc(activeChannel.description || '');
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel || !editName.trim()) return;
    await updateChannel(activeChannel.id, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    setIsEditOpen(false);
  };

  const handleDeleteChannel = async () => {
    if (!activeChannel || isDefaultChannel) return;
    if (confirm(`Are you sure you want to delete #${activeChannel.name}? This action cannot be undone.`)) {
      await deleteChannel(activeChannel.id);
    }
  };

  const handleLeaveChannel = async () => {
    if (!activeChannel || isDefaultChannel) return;
    if (confirm(`Leave #${activeChannel.name}?`)) {
      await leaveChannel(activeChannel.id);
    }
  };

  const members = activeChannel?.members || [];

  return (
    <>
      <header
        className="h-14 px-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xs shrink-0 select-none relative"
        data-testid="chat-header"
      >
        <div className="flex items-center gap-2 min-w-0">
          <IconComponent
            className="w-5 h-5 text-zinc-400 shrink-0"
            aria-hidden="true"
          />
          <span className="text-zinc-400 font-normal">
            {isDm ? '@' : '#'}
          </span>
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

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search trigger button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            title="Search messages (Ctrl+K)"
            aria-label="Search messages"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-xs text-zinc-300 border border-zinc-700/60 transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden md:inline text-zinc-400">Search</span>
          </button>

          {!isDm && (
            <>
              <div className="hidden md:flex items-center gap-1 text-xs text-zinc-400">
                <Users className="w-3.5 h-3.5" />
                <span>{members.length}</span>
              </div>

              <button
                type="button"
                onClick={() => setIsAddUserOpen(!isAddUserOpen)}
                title="Add member to channel"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Add</span>
              </button>

              {/* Edit Channel Settings */}
              {isOwner && (
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  title="Channel Settings"
                  aria-label="Edit channel settings"
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Delete Channel (Owner only, non-default) */}
              {isOwner && !isDefaultChannel && (
                <button
                  type="button"
                  onClick={handleDeleteChannel}
                  title="Delete Channel"
                  aria-label="Delete channel"
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Leave Channel (Non-owner or non-default) */}
              {!isDefaultChannel && (
                <button
                  type="button"
                  onClick={handleLeaveChannel}
                  title="Leave Channel"
                  aria-label="Leave channel"
                  className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Add Member Dropdown Modal */}
        {isAddUserOpen && (
          <div className="absolute right-6 top-16 w-72 p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-zinc-200">
                Add member to #{activeChannel?.name}
              </h4>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-2">
              <input
                type="text"
                placeholder="User display name"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!userName.trim()}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Channel Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-5 text-zinc-100">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="font-semibold text-sm">
                  Edit #{activeChannel?.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="text-zinc-400 hover:text-zinc-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!editName.trim()}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </header>

      {/* Global Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
};
