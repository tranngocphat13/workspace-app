'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const MessageInput: React.FC = () => {
  const [content, setContent] = useState('');
  const activeChannelId = useWorkspaceStore((state) => state.activeChannelId);
  const channels = useWorkspaceStore((state) => state.channels);

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) || channels[0];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }
    useWorkspaceStore.getState().sendMessage(activeChannelId, trimmed);
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isSendDisabled = !content.trim();

  return (
    <form
      data-testid="chat-input-form"
      onSubmit={handleSubmit}
      className="p-4 border-t border-zinc-800 bg-zinc-900/60 backdrop-blur-xs shrink-0 select-none"
    >
      <div className="relative flex items-center">
        <input
          type="text"
          data-testid="message-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${activeChannel?.name || 'general'}...`}
          className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl pl-4 pr-12 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-transparent transition-all shadow-inner"
        />
        <button
          type="submit"
          data-testid="send-button"
          disabled={isSendDisabled}
          aria-label="Send message"
          className={`absolute right-2 p-2 rounded-lg transition-all flex items-center justify-center ${
            !isSendDisabled
              ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md'
              : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
};
