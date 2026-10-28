'use client';

import React, { useEffect } from 'react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const ChatArea: React.FC = () => {
  const fetchMessages = useWorkspaceStore((state) => state.fetchMessages);
  const subscribeToRealtime = useWorkspaceStore(
    (state) => state.subscribeToRealtime
  );
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);

  useEffect(() => {
    // 1. Fetch existing messages from Supabase 'Message' table into Zustand store
    fetchMessages(activeChannelId);

    // 2. Subscribe to Supabase Realtime channel for new 'Message' inserts to update Zustand automatically
    const unsubscribe = subscribeToRealtime();

    return () => {
      unsubscribe();
    };
  }, [fetchMessages, subscribeToRealtime, activeChannelId]);

  return (
    <main
      className="flex-1 flex flex-col min-w-0 h-full bg-zinc-900"
      data-testid="chat-area"
      aria-label="Chat Area"
    >
      <ChatHeader />
      <MessageList />
      <MessageInput />
    </main>
  );
};
