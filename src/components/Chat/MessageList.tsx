'use client';

import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';

const EMPTY_MESSAGES: Message[] = [];

export const MessageList: React.FC = () => {
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const channels = useWorkspaceStore((state) => state.channels);
  const channelMessages = useWorkspaceStore(
    (state) => state.messages[activeChannelId]
  );
  const messages = channelMessages || EMPTY_MESSAGES;

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) || channels[0];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col items-center justify-center text-center select-none"
        data-testid="message-list"
      >
        <div
          className="flex flex-col items-center justify-center text-center max-w-md"
          data-testid="empty-channel-message"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mb-3 shadow-inner">
            <MessageSquare className="w-6 h-6 text-zinc-400" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-200">
            Welcome to #{activeChannel?.name || 'general'}!
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mt-1">
            {activeChannel?.description || 'This is the start of this channel.'}
          </p>
          <div className="mt-4 px-3 py-1.5 rounded-md bg-zinc-800/80 border border-zinc-700/50 text-xs text-zinc-400">
            Active Channel ID: <code className="text-zinc-200 font-mono">{activeChannel?.id}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
      data-testid="message-list"
    >
      <div className="pb-4 border-b border-zinc-800/60 mb-2">
        <h3 className="text-base font-semibold text-zinc-200">
          Welcome to #{activeChannel?.name || 'general'}!
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          {activeChannel?.description || 'This is the start of this channel.'}
        </p>
        <div className="mt-2 text-xs text-zinc-500">
          Active Channel ID: <code className="text-zinc-200 font-mono">{activeChannel?.id}</code>
        </div>
      </div>

      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};
