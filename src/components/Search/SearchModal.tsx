'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search as SearchIcon, X, Hash, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { supabase, isSupabaseConfigured, mapSupabaseMessage } from '../../lib/supabase';
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

const PAGE_SIZE = 20;

// Escape special regex characters for safe use in RegExp constructor
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const channels = useWorkspaceStore((state) => state.channels);
  const setActiveChannel = useWorkspaceStore((state) => state.setActiveChannel);
  const fetchMessages = useWorkspaceStore((state) => state.fetchMessages);
  const messages = useWorkspaceStore((state) => state.messages); // fallback for offline

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channelMap = useMemo(() => {
    const map = new Map<string, { name: string; isDm: boolean }>();
    channels.forEach((ch) => {
      map.set(ch.id, { name: ch.name, isDm: Boolean(ch.isDm) });
    });
    return map;
  }, [channels]);

  const searchDb = useCallback(
    async (searchQuery: string, pageNum: number) => {
      const clean = searchQuery.trim();
      if (!clean) {
        setResults([]);
        setHasMore(false);
        return;
      }

      setIsLoading(true);
      setSearchError(null);

      if (supabase && isSupabaseConfigured) {
        try {
          // Use ILIKE with pg_trgm index — RLS enforced server-side (only member channels visible)
          // Fetch one extra row to detect whether more pages exist
          const { data, error } = await supabase
            .from('messages')
            .select('*, sender:profiles(*)')
            .ilike('content', `%${clean}%`)
            .order('created_at', { ascending: false })
            .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE);

          if (error) {
            setSearchError('Search failed: ' + error.message);
            setIsLoading(false);
            return;
          }

          const rows = data || [];
          const hasMoreResults = rows.length > PAGE_SIZE;
          const sliced = rows.slice(0, PAGE_SIZE);

          const mapped: SearchResult[] = sliced.map((row) => {
            const msg = mapSupabaseMessage(row);
            const chInfo = channelMap.get(msg.channelId) || {
              name: msg.channelId,
              isDm: msg.channelId.startsWith('dm-'),
            };
            return { message: msg, channelName: chInfo.name, isDm: chInfo.isDm };
          });

          if (pageNum === 0) {
            setResults(mapped);
          } else {
            setResults((prev) => [...prev, ...mapped]);
          }
          setHasMore(hasMoreResults);
        } catch {
          setSearchError('Search failed. Please try again.');
        }
      } else {
        // Offline fallback: search in-memory Zustand messages
        const clean2 = clean.toLowerCase();
        const offlineResults: SearchResult[] = [];
        Object.entries(messages).forEach(([channelId, channelMsgs]) => {
          const chInfo = channelMap.get(channelId) || {
            name: channelId,
            isDm: channelId.startsWith('dm-'),
          };
          channelMsgs.forEach((msg) => {
            if (msg.content.toLowerCase().includes(clean2)) {
              offlineResults.push({ message: msg, channelName: chInfo.name, isDm: chInfo.isDm });
            }
          });
        });
        const start = pageNum * PAGE_SIZE;
        const end = (pageNum + 1) * PAGE_SIZE;
        if (pageNum === 0) {
          setResults(offlineResults.slice(start, end));
        } else {
          setResults((prev) => [...prev, ...offlineResults.slice(start, end)]);
        }
        setHasMore(offlineResults.length > end);
      }

      setIsLoading(false);
    },
    [channelMap, messages]
  );

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasMore(false);
    setSearchError(null);
    setPage(0);
  };

  const handleClose = () => {
    handleClear();
    onClose();
  };

  // Debounced search trigger on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const clean = query.trim();
    if (!clean) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      setPage(0);
      searchDb(clean, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchDb]);

  if (!isOpen) return null;

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      setHasMore(false);
      setSearchError(null);
      setPage(0);
    }
  };

  const handleSelectResult = async (channelId: string, messageId: string) => {
    setActiveChannel(channelId);
    if (!messages[channelId]?.some((m) => m.id === messageId)) {
      try {
        await fetchMessages(channelId);
      } catch {
        // Continue to scroll attempt even if fetch encounters an issue
      }
    }
    handleClose();
    // Scroll to message after navigation settles
    setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1');
        setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1'), 2000);
      }
    }, 150);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    searchDb(query, nextPage);
  };

  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const escaped = escapeRegex(searchTerm);
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-blue-500/30 text-blue-200 rounded px-0.5 font-medium">
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
            onChange={handleQueryChange}
            placeholder="Search messages across all channels and DMs..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            autoFocus
          />
          {isLoading && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
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
          ) : searchError ? (
            <div className="py-12 text-center text-red-400 text-xs">{searchError}</div>
          ) : isLoading && results.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">Searching…</div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No messages found matching &quot;{query}&quot;.
            </div>
          ) : (
            <>
              {results.map(({ message, channelName, isDm }) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => handleSelectResult(message.channelId, message.id)}
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
                    <span className="text-[10px] text-zinc-500">{message.timestamp}</span>
                  </div>
                  <p className="text-xs text-zinc-200 line-clamp-2 leading-relaxed">
                    {highlightMatch(message.content, query.trim())}
                  </p>
                  <div className="flex items-center justify-end text-[11px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity gap-1 mt-1">
                    <span>Jump to message</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}

              {hasMore && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 text-center disabled:opacity-50"
                >
                  {isLoading ? 'Loading…' : 'Load more results'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
