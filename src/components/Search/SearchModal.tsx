'use client';

import React, { useState, useMemo } from 'react';
import { Search as SearchIcon, X, Hash, MessageSquare, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { Message } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  message: Message;
  channelName: string;
  isDm: boolean;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const messages = useWorkspaceStore((state) => state.messages);
  const channels = useWorkspaceStore((state) => state.channels);
  const setActiveChannel = useWorkspaceStore((state) => state.setActiveChannel);

  const channelMap = useMemo(() => {
    const map = new Map<string, { name: string; isDm: boolean }>();
    channels.forEach((ch) => {
      map.set(ch.id, { name: ch.name, isDm: Boolean(ch.isDm) });
    });
    return map;
  }, [channels]);

  const searchResults = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];

    const results: SearchResult[] = [];

    // Search through all channel and DM messages in store
    Object.entries(messages).forEach(([channelId, channelMsgs]) => {
      const chInfo = channelMap.get(channelId) || {
        name: channelId,
        isDm: channelId.startsWith('dm-'),
      };

      channelMsgs.forEach((msg) => {
        if (msg.content.toLowerCase().includes(clean)) {
          results.push({
            message: msg,
            channelName: chInfo.name,
            isDm: chInfo.isDm,
          });
        }
      });
    });

    return results;
  }, [query, messages, channelMap]);

  if (!isOpen) return null;

  const handleSelectResult = (channelId: string) => {
    setActiveChannel(channelId);
    onClose();
  };

  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark
          key={index}
          className="bg-blue-500/30 text-blue-200 rounded px-0.5 font-medium"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      data-testid="search-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-xl rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search header / input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <SearchIcon className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            type="text"
            data-testid="search-modal-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages across all channels and DMs..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
          >
            Esc
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!query.trim() ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              Type a keyword to search through your messages and conversations.
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No messages found matching &quot;{query}&quot;.
            </div>
          ) : (
            searchResults.map(({ message, channelName, isDm }) => (
              <button
                key={message.id}
                type="button"
                onClick={() => handleSelectResult(message.channelId)}
                className="w-full text-left p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                    {isDm ? (
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Hash className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    <span>{isDm ? `@${channelName}` : `#${channelName}`}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-400">{message.sender.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {message.timestamp}
                  </span>
                </div>

                <p className="text-xs text-zinc-200 line-clamp-2 leading-relaxed">
                  {highlightMatch(message.content, query.trim())}
                </p>

                <div className="flex items-center justify-end text-[11px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity gap-1 mt-1">
                  <span>Jump to message</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
