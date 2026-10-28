import { create } from 'zustand';
import type { Channel, ChannelIconName, Message, User, WorkspaceStoreState } from '../types';
import { supabase, isSupabaseConfigured, mapSupabaseMessage } from '../lib/supabase';

const INITIAL_USER: User = {
  id: 'user-current',
  name: 'Alex Johnson',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
  statusText: 'Online',
};

const SARAH_USER: User = {
  id: 'user-sarah',
  name: 'Sarah Chen',
  avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
  statusText: 'Active',
};

const MICHAEL_USER: User = {
  id: 'user-michael',
  name: 'Michael Scott',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
  statusText: 'Away',
};

const JESSICA_USER: User = {
  id: 'user-jessica',
  name: 'Jessica Taylor',
  avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces',
  statusText: 'Focusing',
};

const BOT_USER: User = {
  id: 'user-bot',
  name: 'Deploy Bot',
  avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop&crop=faces',
  statusText: 'Automated Service',
};

const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'general',
    name: 'general',
    description: 'Company-wide announcements and team discussions',
    iconName: 'Hash',
    members: [INITIAL_USER, SARAH_USER, MICHAEL_USER],
  },
  {
    id: 'random',
    name: 'random',
    description: 'Water cooler chat, off-topic discussions, and fun',
    iconName: 'MessageSquare',
    members: [INITIAL_USER, JESSICA_USER, MICHAEL_USER],
  },
  {
    id: 'announcements',
    name: 'announcements',
    description: 'Official workspace updates, policy changes, and events',
    iconName: 'Bell',
    members: [INITIAL_USER, SARAH_USER],
  },
  {
    id: 'development',
    name: 'development',
    description: 'Engineering discussions, commits, pull requests, and deploys',
    iconName: 'Code',
    members: [INITIAL_USER, BOT_USER],
  },
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  general: [
    {
      id: 'msg-gen-1',
      channelId: 'general',
      sender: SARAH_USER,
      content: 'Welcome to the new workspace! Let us know if you need anything.',
      timestamp: '09:00 AM',
      status: 'sent',
    },
    {
      id: 'msg-gen-2',
      channelId: 'general',
      sender: INITIAL_USER,
      content: 'Thanks Sarah! Setting up our real-time messaging pipeline now.',
      timestamp: '09:05 AM',
      status: 'sent',
    },
    {
      id: 'msg-gen-3',
      channelId: 'general',
      sender: MICHAEL_USER,
      content: 'Looks great! Are we tracking sprint goals here?',
      timestamp: '09:12 AM',
      status: 'sent',
    },
  ],
  random: [
    {
      id: 'msg-rnd-1',
      channelId: 'random',
      sender: JESSICA_USER,
      content: 'Fresh pour-over coffee available in the kitchen! ☕',
      timestamp: '10:15 AM',
      status: 'sent',
    },
    {
      id: 'msg-rnd-2',
      channelId: 'random',
      sender: MICHAEL_USER,
      content: 'On my way down right now!',
      timestamp: '10:18 AM',
      status: 'sent',
    },
  ],
  announcements: [
    {
      id: 'msg-ann-1',
      channelId: 'announcements',
      sender: SARAH_USER,
      content: 'Quarterly roadmap presentation is scheduled for Thursday at 2:00 PM EST.',
      timestamp: 'Yesterday at 4:30 PM',
      status: 'sent',
    },
    {
      id: 'msg-ann-2',
      channelId: 'announcements',
      sender: SARAH_USER,
      content: 'Please review the slide deck before the meeting.',
      timestamp: 'Yesterday at 4:32 PM',
      status: 'sent',
    },
  ],
  development: [
    {
      id: 'msg-dev-1',
      channelId: 'development',
      sender: BOT_USER,
      content: 'Release v1.2.0 deployed to staging successfully.',
      timestamp: '08:45 AM',
      status: 'sent',
    },
    {
      id: 'msg-dev-2',
      channelId: 'development',
      sender: INITIAL_USER,
      content: 'Verification tests passing. Ready for canary promotion.',
      timestamp: '08:50 AM',
      status: 'sent',
    },
  ],
};

const STORAGE_KEY_MESSAGES = 'workspace_persisted_messages_v1';
const STORAGE_KEY_CHANNELS = 'workspace_persisted_channels_v1';
const activeMessageTimers = new Set<ReturnType<typeof setTimeout>>();
let isLastReadAtSupported = true;

function getPersistedMessages(): Record<string, Message[]> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePersistedMessages(messages: Record<string, Message[]>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch {
    // Ignore quota errors
  }
}

function getPersistedChannels(): Channel[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHANNELS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePersistedChannels(channels: Channel[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(channels));
  } catch {
    // Ignore quota errors
  }
}

export const useWorkspaceStore = create<WorkspaceStoreState>()((set, get) => ({
  channels: getPersistedChannels() || INITIAL_CHANNELS,
  activeChannelId: 'general',
  messages: getPersistedMessages() || INITIAL_MESSAGES,
  currentUser: INITIAL_USER,
  unreadCounts: {},
  notification: null,

  markChannelAsRead: async (channelId: string) => {
    // Optimistic in-memory update
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [channelId]: 0 },
    }));

    if (!isLastReadAtSupported) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (!client || !isSupabaseConfigured) return;

    const currentUserId = get().currentUser.id;
    if (!currentUserId || currentUserId.startsWith('user-')) return;

    const now = new Date().toISOString();

    try {
      const { error } = await client
        .from('channel_members')
        .update({ last_read_at: now })
        .eq('channel_id', channelId)
        .eq('user_id', currentUserId)
        .lt('last_read_at', now); // only update if current value is older

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('last_read_at')) {
          isLastReadAtSupported = false;
        }
        console.warn('markChannelAsRead persist failed:', error.message);
      }
    } catch (err: unknown) {
      if ((err as { message?: string })?.message?.includes('last_read_at')) {
        isLastReadAtSupported = false;
      }
      console.warn('markChannelAsRead persist failed:', err);
    }
  },

  fetchUnreadCounts: async () => {
    if (!isLastReadAtSupported) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (!client || !isSupabaseConfigured) return;

    const currentUserId = get().currentUser.id;
    if (!currentUserId || currentUserId.startsWith('user-')) return;

    try {
      // Get all memberships with last_read_at
      const { data: memberships, error: memErr } = await client
        .from('channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', currentUserId);

      if (memErr) {
        if (memErr.code === 'PGRST204' || memErr.message?.includes('last_read_at')) {
          isLastReadAtSupported = false;
        }
        return;
      }
      if (!memberships) return;

      const counts: Record<string, number> = {};

      // For each membership, count messages after last_read_at from other users
      await Promise.all(
        memberships.map(async (m: { channel_id: string; last_read_at: string }) => {
          if (!m.last_read_at) return;
          const { count, error } = await client
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', m.channel_id)
            .neq('sender_id', currentUserId)
            .gt('created_at', m.last_read_at);

          if (!error && count !== null) {
            counts[m.channel_id] = count;
          }
        })
      );

      set({ unreadCounts: counts });
    } catch (err: unknown) {
      if ((err as { message?: string })?.message?.includes('last_read_at')) {
        isLastReadAtSupported = false;
      }
      console.warn('fetchUnreadCounts failed:', err);
    }
  },

  dismissNotification: () => {
    set({ notification: null });
  },

  setActiveChannel: (channelId: string) => {
    set((state) => {
      const channelExists = state.channels.some((c) => c.id === channelId);
      if (!channelExists || state.activeChannelId === channelId) {
        return state;
      }
      return {
        activeChannelId: channelId,
        unreadCounts: { ...state.unreadCounts, [channelId]: 0 },
      };
    });
    // Persist read state for the newly activated channel
    if (!isLastReadAtSupported) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      const currentUserId = get().currentUser.id;
      if (currentUserId && !currentUserId.startsWith('user-')) {
        const now = new Date().toISOString();
        client
          .from('channel_members')
          .update({ last_read_at: now })
          .eq('channel_id', channelId)
          .eq('user_id', currentUserId)
          .lt('last_read_at', now)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ error }: { error: any }) => {
            if (error) {
              if (error.code === 'PGRST204' || error.message?.includes('last_read_at')) {
                isLastReadAtSupported = false;
              }
              console.warn('setActiveChannel read persist failed:', error.message);
            }
          });
      }
    }
  },

  fetchChannels: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (!client || !isSupabaseConfigured) {
      const cached = getPersistedChannels();
      if (cached) {
        set({ channels: cached });
      }
      return;
    }

    try {
      let { data, error } = await client
        .from('channels')
        .select('*, channel_members(*, profiles(*))');

      if (error) {
        const fallback = await client.from('channels').select('*');
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.warn('Supabase fetchChannels error:', error.message);
        return;
      }

      if (data && Array.isArray(data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedChannels: Channel[] = data.map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          description: ch.description || '',
          iconName: (ch.icon_name as ChannelIconName) || 'Hash',
          ownerId: ch.owner_id || null,
          createdAt: ch.created_at,
          isDm: ch.is_dm === true || ch.is_dm === 'true',
          members: Array.isArray(ch.channel_members)
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ch.channel_members.map((cm: any) => ({
                id: cm.profiles?.id || cm.user_id || 'unknown',
                name: cm.profiles?.name || 'Member',
                avatarUrl: cm.profiles?.avatar_url || '',
                statusText: cm.profiles?.status_text || 'Online',
              }))
            : [get().currentUser],
        }));

        if (mappedChannels.length > 0) {
          savePersistedChannels(mappedChannels);
          set({ channels: mappedChannels });
        }
      }
    } catch (err: unknown) {
      console.warn('Supabase fetchChannels failed:', err);
    }
  },

  fetchMessages: async (channelId?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (!client || !isSupabaseConfigured) {
      const cached = getPersistedMessages();
      if (cached) {
        set({ messages: cached });
      }
      return;
    }

    const targetChannelId = channelId || get().activeChannelId;
    try {
      let query = client
        .from('messages')
        .select('*, sender:profiles(*)')
        .order('created_at', { ascending: true });

      if (targetChannelId) {
        query = query.eq('channel_id', targetChannelId);
      }

      let { data, error } = await query;
      if (error) {
        const fallback = await client
          .from('messages')
          .select('*')
          .eq('channel_id', targetChannelId)
          .order('created_at', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.warn('Supabase fetchMessages error:', error.message);
        return;
      }

      if (data && Array.isArray(data)) {
        const mappedMessages = data.map(mapSupabaseMessage);
        set((state) => {
          const next = { ...state.messages };
          for (const msg of mappedMessages) {
            const list = next[msg.channelId] || [];
            // Reconcile optimistic sending message if matching clientMessageId exists
            const optimisticIndex = msg.clientMessageId
              ? list.findIndex(
                  (m) =>
                    (m.clientMessageId === msg.clientMessageId || m.id === msg.clientMessageId) &&
                    m.status === 'sending'
                )
              : -1;

            if (optimisticIndex !== -1) {
              const updated = [...list];
              updated[optimisticIndex] = { ...msg, status: 'sent' };
              next[msg.channelId] = updated;
            } else if (!list.some((existing) => existing.id === msg.id)) {
              next[msg.channelId] = [...list, msg];
            }
          }
          savePersistedMessages(next);
          return { messages: next };
        });
      }
    } catch (err: unknown) {
      console.warn('Supabase fetchMessages failed:', err);
    }
  },

  subscribeToRealtime: (channelId?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const targetChannelId = channelId || get().activeChannelId;
    if (!client || !isSupabaseConfigured) {
      return () => {};
    }

    const realtimeChannel = client
      .channel(`realtime:channel:${targetChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${targetChannelId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const row = payload?.new;
          if (!row) return;

          let mappedMsg = mapSupabaseMessage(row);

          // If sender profile was not included in payload, hydrate it from profiles table
          if (row.sender_id && mappedMsg.sender.id === 'user-system') {
            try {
              const { data: profile } = await client
                .from('profiles')
                .select('*')
                .eq('id', row.sender_id)
                .single();
              if (profile) {
                mappedMsg = {
                  ...mappedMsg,
                  sender: {
                    id: profile.id,
                    name: profile.name,
                    avatarUrl: profile.avatar_url || mappedMsg.sender.avatarUrl,
                    statusText: profile.status_text || 'Online',
                  },
                };
              }
            } catch {
              // fallback to mappedMsg
            }
          }

          set((state) => {
            const chId = mappedMsg.channelId || targetChannelId;
            const currentList = state.messages[chId] || [];

            // 1. If row.id already exists, idempotent update without duplicates
            const existingIdIndex = currentList.findIndex((m) => m.id === mappedMsg.id);
            if (existingIdIndex !== -1) {
              const updatedList = [...currentList];
              updatedList[existingIdIndex] = {
                ...updatedList[existingIdIndex],
                ...mappedMsg,
                status: 'sent',
              };
              const updatedMessages = { ...state.messages, [chId]: updatedList };
              savePersistedMessages(updatedMessages);
              return { messages: updatedMessages };
            }

            // 2. Deduplication: match against optimistic message by client_message_id
            const clientMsgId = row.client_message_id || mappedMsg.clientMessageId;
            let optimisticIndex = -1;
            if (clientMsgId) {
              optimisticIndex = currentList.findIndex(
                (m) =>
                  m.clientMessageId === clientMsgId ||
                  m.id === clientMsgId
              );
            }

            let updatedList: Message[];
            if (optimisticIndex !== -1) {
              // Reconcile optimistic message
              updatedList = [...currentList];
              updatedList[optimisticIndex] = {
                ...updatedList[optimisticIndex],
                id: mappedMsg.id,
                clientMessageId: clientMsgId,
                status: 'sent',
                timestamp: mappedMsg.timestamp || updatedList[optimisticIndex].timestamp,
              };
            } else {
              // New incoming message from other user: append
              updatedList = [...currentList, { ...mappedMsg, status: 'sent' }];
            }

            const updatedMessages = {
              ...state.messages,
              [chId]: updatedList,
            };
            savePersistedMessages(updatedMessages);

            // In-app unread tracking & notification if message is from another user in a different channel
            const isFromOther = row.sender_id && row.sender_id !== get().currentUser.id;
            const isOtherChannel = targetChannelId !== get().activeChannelId;
            const nextUnread = { ...state.unreadCounts };
            let nextNotification = state.notification;

            if (isFromOther && isOtherChannel) {
              nextUnread[targetChannelId] = (nextUnread[targetChannelId] || 0) + 1;
              nextNotification = {
                id: String(row.id || Date.now()),
                title: mappedMsg.sender.name || 'New Message',
                message: mappedMsg.content || 'New attachment received',
                channelId: targetChannelId,
              };
            }

            return {
              messages: updatedMessages,
              unreadCounts: nextUnread,
              notification: nextNotification,
            };
          });

          // Auto-mark as read if user is currently viewing this channel and message is from someone else
          const isFromOther = row.sender_id && row.sender_id !== get().currentUser.id;
          const isActiveChannel = targetChannelId === get().activeChannelId;
          if (isFromOther && isActiveChannel) {
            get().markChannelAsRead(targetChannelId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${targetChannelId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;

          set((state) => {
            const list = state.messages[targetChannelId] || [];
            const updated = list.map((m) =>
              m.id === String(row.id)
                ? {
                    ...m,
                    content: row.content,
                    isEdited: true,
                    attachment: row.attachment_url
                      ? {
                          url: row.attachment_url,
                          name: row.attachment_name || 'attachment',
                          type: row.attachment_type || 'application/octet-stream',
                          size: row.attachment_size ?? undefined,
                        }
                      : m.attachment,
                  }
                : m
            );
            const next = { ...state.messages, [targetChannelId]: updated };
            savePersistedMessages(next);
            return { messages: next };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${targetChannelId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const old = payload?.old;
          if (!old?.id) return;

          set((state) => {
            const list = state.messages[targetChannelId] || [];
            const filtered = list.filter((m) => m.id !== String(old.id));
            const next = { ...state.messages, [targetChannelId]: filtered };
            savePersistedMessages(next);
            return { messages: next };
          });
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Reconnection resync to recover any messages dropped during reconnect
          get().fetchMessages(targetChannelId);
        }
      });

    return () => {
      client.removeChannel(realtimeChannel);
    };
  },

  sendMessage: (channelId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const clientMessageId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const timestamp = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const newMessage: Message = {
      id: clientMessageId,
      clientMessageId,
      channelId,
      sender: get().currentUser,
      content: trimmed,
      timestamp,
      status: 'sending',
    };

    set((state) => {
      const currentChannelMessages = state.messages[channelId] || [];
      const updatedMessages = {
        ...state.messages,
        [channelId]: [...currentChannelMessages, newMessage],
      };
      savePersistedMessages(updatedMessages);
      return { messages: updatedMessages };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      (async () => {
        try {
          const { data, error } = await client
            .from('messages')
            .insert({
              channel_id: channelId,
              sender_id: get().currentUser.id,
              content: trimmed,
              client_message_id: clientMessageId,
            })
            .select()
            .single();

          if (error) {
            throw error;
          }

          if (data) {
            const actualDbId = String(data.id);
            set((state) => {
              const currentList = state.messages[channelId];
              if (!currentList) return state;

              // Guard: abort if message was purged during in-flight request
              const exists = currentList.some(
                (msg) => msg.clientMessageId === clientMessageId || msg.id === clientMessageId
              );
              if (!exists) return state;

              const updated = currentList.map((msg) =>
                msg.clientMessageId === clientMessageId || msg.id === clientMessageId
                  ? { ...msg, id: actualDbId, status: 'sent' as const }
                  : msg
              );

              const updatedMessages = {
                ...state.messages,
                [channelId]: updated,
              };
              savePersistedMessages(updatedMessages);
              return { messages: updatedMessages };
            });
          }
        } catch (err: unknown) {
          console.warn('Supabase insert failed, transitioning to failed status:', err);
          set((state) => {
            const currentList = state.messages[channelId];
            if (!currentList) return state;

            const updated = currentList.map((msg) =>
              msg.clientMessageId === clientMessageId || msg.id === clientMessageId
                ? { ...msg, status: 'failed' as const }
                : msg
            );

            const updatedMessages = {
              ...state.messages,
              [channelId]: updated,
            };
            savePersistedMessages(updatedMessages);
            return { messages: updatedMessages };
          });
        }
      })();
    } else {
      // Simulated 1000ms delay fallback for offline & test environment
      const timerId = setTimeout(() => {
        activeMessageTimers.delete(timerId);

        set((state) => {
          const currentChannelMessages = state.messages[channelId];
          if (!currentChannelMessages) {
            return state;
          }

          // Guard: abort if message was purged or state reset by logout
          const messageExists = currentChannelMessages.some(
            (msg) => msg.clientMessageId === clientMessageId || msg.id === clientMessageId
          );
          if (!messageExists) {
            return state;
          }

          const updated = currentChannelMessages.map((msg) =>
            msg.clientMessageId === clientMessageId || msg.id === clientMessageId
              ? { ...msg, status: 'sent' as const }
              : msg
          );

          const updatedMessages = {
            ...state.messages,
            [channelId]: updated,
          };
          savePersistedMessages(updatedMessages);

          return {
            messages: updatedMessages,
          };
        });
      }, 1000);

      activeMessageTimers.add(timerId);
    }
  },

  retryMessage: async (channelId: string, messageId: string) => {
    const state = get();
    const currentList = state.messages[channelId] || [];
    const targetMsg = currentList.find(
      (m) => m.id === messageId || m.clientMessageId === messageId
    );
    if (!targetMsg) return;

    const clientMessageId = targetMsg.clientMessageId || targetMsg.id;

    // Transition back to 'sending'
    set((currState) => {
      const list = currState.messages[channelId];
      if (!list) return currState;

      const updated = list.map((m) =>
        m.id === messageId || m.clientMessageId === messageId
          ? { ...m, status: 'sending' as const }
          : m
      );
      const updatedMessages = { ...currState.messages, [channelId]: updated };
      savePersistedMessages(updatedMessages);
      return { messages: updatedMessages };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      try {
        const { data, error } = await client
          .from('messages')
          .insert({
            channel_id: channelId,
            sender_id: targetMsg.sender.id,
            content: targetMsg.content,
            client_message_id: clientMessageId,
          })
          .select()
          .single();

        if (error) {
          // Handle PostgreSQL 23505 unique violation recovery
          if (
            error.code === '23505' ||
            error.message?.includes('unique') ||
            error.message?.includes('duplicate key')
          ) {
            const { data: existingRow } = await client
              .from('messages')
              .select('*')
              .eq('client_message_id', clientMessageId)
              .single();

            const resolvedId = existingRow?.id ? String(existingRow.id) : targetMsg.id;

            set((currState) => {
              const list = currState.messages[channelId];
              if (!list) return currState;

              const updated = list.map((m) =>
                m.id === messageId || m.clientMessageId === messageId
                  ? { ...m, id: resolvedId, status: 'sent' as const }
                  : m
              );
              const updatedMessages = { ...currState.messages, [channelId]: updated };
              savePersistedMessages(updatedMessages);
              return { messages: updatedMessages };
            });
            return;
          }

          throw error;
        }

        const actualDbId = data?.id ? String(data.id) : targetMsg.id;
        set((currState) => {
          const list = currState.messages[channelId];
          if (!list) return currState;

          const updated = list.map((m) =>
            m.id === messageId || m.clientMessageId === messageId
              ? { ...m, id: actualDbId, status: 'sent' as const }
              : m
          );
          const updatedMessages = { ...currState.messages, [channelId]: updated };
          savePersistedMessages(updatedMessages);
          return { messages: updatedMessages };
        });
      } catch (err: unknown) {
        console.warn('Supabase retryMessage failed:', err);
        set((currState) => {
          const list = currState.messages[channelId];
          if (!list) return currState;

          const updated = list.map((m) =>
            m.id === messageId || m.clientMessageId === messageId
              ? { ...m, status: 'failed' as const }
              : m
          );
          const updatedMessages = { ...currState.messages, [channelId]: updated };
          savePersistedMessages(updatedMessages);
          return { messages: updatedMessages };
        });
      }
    } else {
      // Offline fallback: resolve to 'sent' after 500ms
      const timerId = setTimeout(() => {
        activeMessageTimers.delete(timerId);
        set((currState) => {
          const list = currState.messages[channelId];
          if (!list) return currState;

          const updated = list.map((m) =>
            m.id === messageId || m.clientMessageId === messageId
              ? { ...m, status: 'sent' as const }
              : m
          );
          const updatedMessages = { ...currState.messages, [channelId]: updated };
          savePersistedMessages(updatedMessages);
          return { messages: updatedMessages };
        });
      }, 500);
      activeMessageTimers.add(timerId);
    }
  },

  createChannel: async (name: string, description?: string) => {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanName) return;

    const newChannel: Channel = {
      id: cleanName,
      name: cleanName,
      description: description?.trim() || `Channel for #${cleanName}`,
      iconName: 'Hash',
      members: [get().currentUser],
    };

    set((state) => {
      if (state.channels.some((c) => c.id === newChannel.id)) {
        return { activeChannelId: newChannel.id };
      }
      const updatedChannels = [...state.channels, newChannel];
      const updatedMessages = {
        ...state.messages,
        [newChannel.id]: state.messages[newChannel.id] || [],
      };
      savePersistedChannels(updatedChannels);
      savePersistedMessages(updatedMessages);
      return {
        channels: updatedChannels,
        messages: updatedMessages,
        activeChannelId: newChannel.id,
      };
    });

    // Supabase insert into 'channels' table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      try {
        await client.from('channels').insert({
          id: newChannel.id,
          name: newChannel.name,
          description: newChannel.description,
          icon_name: 'Hash',
          owner_id: get().currentUser.id,
        });
      } catch (err: unknown) {
        console.warn('Supabase createChannel insert failed:', err);
      }
    }
  },

  addMemberToChannel: async (channelId: string, user: User | string) => {
    const memberObj: User =
      typeof user === 'string'
        ? {
            id: user,
            name: user,
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user)}`,
            statusText: 'Member',
          }
        : user;

    // Save previous channels state for rollback
    const previousChannels = get().channels;

    set((state) => {
      const channelIndex = state.channels.findIndex((c) => c.id === channelId);
      if (channelIndex === -1) return state;

      const target = state.channels[channelIndex];
      const currentMembers = target.members || [get().currentUser];
      if (currentMembers.some((m) => m.id === memberObj.id)) return state;

      const updatedChannel: Channel = {
        ...target,
        members: [...currentMembers, memberObj],
      };

      const updatedChannels = [...state.channels];
      updatedChannels[channelIndex] = updatedChannel;

      savePersistedChannels(updatedChannels);
      return { channels: updatedChannels };
    });

    // Supabase insert into 'channel_members' table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      const { error } = await client.from('channel_members').insert({
        channel_id: channelId,
        user_id: memberObj.id,
        role: 'member',
      });

      if (error) {
        // Rollback: restore previous channels if the channel still exists
        set((state) => {
          const channelStillExists = state.channels.some((c) => c.id === channelId);
          if (!channelStillExists) return state;
          savePersistedChannels(previousChannels);
          return {
            channels: previousChannels,
            notification: {
              id: `err-${Date.now()}`,
              title: 'Error',
              message: error.message || 'Could not add member. Check permissions.',
              channelId,
            },
          };
        });
      }
    }
  },

  setCurrentUser: (user: User) => {
    set({ currentUser: user });
  },

  editMessage: async (channelId: string, messageId: string, newContent: string) => {
    const trimmed = newContent.trim();
    if (!trimmed) return;

    // Save previous messages for rollback
    const previousMessages = get().messages[channelId];

    // Optimistic update
    set((state) => {
      const list = state.messages[channelId];
      if (!list) return state;

      const updated = list.map((msg) =>
        msg.id === messageId || msg.clientMessageId === messageId
          ? { ...msg, content: trimmed, isEdited: true }
          : msg
      );
      const updatedMessages = { ...state.messages, [channelId]: updated };
      savePersistedMessages(updatedMessages);
      return { messages: updatedMessages };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      const { error } = await client
        .from('messages')
        .update({
          content: trimmed,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) {
        // Rollback: restore previous state only if the channel messages haven't been replaced
        set((state) => {
          const currentList = state.messages[channelId];
          if (!currentList || !previousMessages) return state;
          const updatedMessages = { ...state.messages, [channelId]: previousMessages };
          savePersistedMessages(updatedMessages);
          return {
            messages: updatedMessages,
            notification: {
              id: `err-${Date.now()}`,
              title: 'Edit Failed',
              message: error.message || 'Could not edit message. Check permissions.',
              channelId,
            },
          };
        });
      }
    }
  },

  deleteMessage: async (channelId: string, messageId: string) => {
    // Save the full message object for rollback on failure
    const previousMessages = get().messages[channelId];
    const messageToDelete = previousMessages?.find(
      (msg) => msg.id === messageId || msg.clientMessageId === messageId
    );

    // Optimistic removal
    set((state) => {
      const list = state.messages[channelId];
      if (!list) return state;

      const updated = list.filter(
        (msg) => msg.id !== messageId && msg.clientMessageId !== messageId
      );
      const updatedMessages = { ...state.messages, [channelId]: updated };
      savePersistedMessages(updatedMessages);
      return { messages: updatedMessages };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      const { error } = await client.from('messages').delete().eq('id', messageId);

      if (error) {
        // Rollback: re-insert the deleted message if it was saved and channel still exists
        set((state) => {
          const currentList = state.messages[channelId];
          if (!currentList || !messageToDelete) return state;
          // Re-insert at original position (append to current list to avoid index complexity)
          const restored = [...currentList, messageToDelete].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const updatedMessages = { ...state.messages, [channelId]: restored };
          savePersistedMessages(updatedMessages);
          return {
            messages: updatedMessages,
            notification: {
              id: `err-${Date.now()}`,
              title: 'Delete Failed',
              message: error.message || 'Could not delete message. Check permissions.',
              channelId,
            },
          };
        });
      }
    }
  },

  updateChannel: async (
    channelId: string,
    updates: { name?: string; description?: string }
  ) => {
    const cleanName = updates.name
      ? updates.name.trim().toLowerCase().replace(/\s+/g, '-')
      : undefined;
    const cleanDesc =
      updates.description !== undefined ? updates.description.trim() : undefined;

    // Save previous channel state for rollback
    const previousChannels = get().channels;

    // Optimistic update
    set((state) => {
      const updatedChannels = state.channels.map((ch) =>
        ch.id === channelId
          ? {
              ...ch,
              name: cleanName || ch.name,
              description: cleanDesc !== undefined ? cleanDesc : ch.description,
            }
          : ch
      );
      savePersistedChannels(updatedChannels);
      return { channels: updatedChannels };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      const payload: Record<string, string> = {};
      if (cleanName) payload.name = cleanName;
      if (cleanDesc !== undefined) payload.description = cleanDesc;

      const { error } = await client.from('channels').update(payload).eq('id', channelId);

      if (error) {
        // Rollback: restore previous channel list if the channel still exists
        set((state) => {
          const channelStillExists = state.channels.some((c) => c.id === channelId);
          if (!channelStillExists) return state;
          savePersistedChannels(previousChannels);
          return {
            channels: previousChannels,
            notification: {
              id: `err-${Date.now()}`,
              title: 'Update Failed',
              message: error.message || 'Could not update channel. Check permissions.',
              channelId,
            },
          };
        });
      }
    }
  },

  deleteChannel: async (channelId: string) => {
    if (channelId === 'general') {
      console.warn('Cannot delete default general channel');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      // Do DB call FIRST — destructive action should be confirmed before state update
      const { error } = await client.from('channels').delete().eq('id', channelId);

      if (error) {
        set({
          notification: {
            id: `err-${Date.now()}`,
            title: 'Delete Failed',
            message: error.message || 'Could not delete channel. Check permissions.',
            channelId,
          },
        });
        return;
      }
    }

    // Only update state after DB confirms deletion (or when Supabase is not configured)
    set((state) => {
      const updatedChannels = state.channels.filter((ch) => ch.id !== channelId);
      const updatedMessages = { ...state.messages };
      delete updatedMessages[channelId];
      const nextActiveId =
        state.activeChannelId === channelId ? 'general' : state.activeChannelId;

      savePersistedChannels(updatedChannels);
      savePersistedMessages(updatedMessages);

      return {
        channels: updatedChannels,
        messages: updatedMessages,
        activeChannelId: nextActiveId,
      };
    });
  },

  leaveChannel: async (channelId: string) => {
    if (channelId === 'general') {
      console.warn('Cannot leave default general channel');
      return;
    }

    const currentUserId = get().currentUser.id;

    // Save previous channels state for rollback
    const previousChannels = get().channels;
    const previousActiveChannelId = get().activeChannelId;

    // Optimistic update
    set((state) => {
      const channelIndex = state.channels.findIndex((c) => c.id === channelId);
      if (channelIndex === -1) return state;

      const target = state.channels[channelIndex];
      const updatedMembers = (target.members || []).filter(
        (m) => m.id !== currentUserId
      );

      let updatedChannels: Channel[];
      // If user is not the owner, hide channel from user's sidebar
      if (target.ownerId && target.ownerId !== currentUserId) {
        updatedChannels = state.channels.filter((c) => c.id !== channelId);
      } else {
        updatedChannels = [...state.channels];
        updatedChannels[channelIndex] = { ...target, members: updatedMembers };
      }

      const nextActiveId =
        state.activeChannelId === channelId ? 'general' : state.activeChannelId;

      savePersistedChannels(updatedChannels);
      return { channels: updatedChannels, activeChannelId: nextActiveId };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      const { error } = await client
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', currentUserId);

      if (error) {
        // Rollback: restore channels to previous state
        set(() => {
          savePersistedChannels(previousChannels);
          return {
            channels: previousChannels,
            activeChannelId: previousActiveChannelId,
            notification: {
              id: `err-${Date.now()}`,
              title: 'Leave Failed',
              message: error.message || 'Could not leave channel. Check permissions.',
              channelId,
            },
          };
        });
      }
    }
  },

  getOrCreateDmChannel: async (targetUser: User): Promise<string> => {
    const currentUser = get().currentUser;
    if (currentUser.id === targetUser.id) {
      return get().activeChannelId;
    }

    // Deterministic canonical DM ID sorted lexicographically
    const sortedIds = [currentUser.id, targetUser.id].sort();
    const dmId = `dm-${sortedIds[0]}-${sortedIds[1]}`;

    // Check if channel already exists
    const existing = get().channels.find((c) => c.id === dmId);
    if (existing) {
      set({ activeChannelId: dmId });
      return dmId;
    }

    const dmChannel: Channel = {
      id: dmId,
      name: targetUser.name,
      description: `Direct message with ${targetUser.name}`,
      iconName: 'MessageSquare',
      ownerId: currentUser.id,
      isDm: true,
      members: [currentUser, targetUser],
    };

    set((state) => {
      const updatedChannels = [...state.channels, dmChannel];
      const updatedMessages = {
        ...state.messages,
        [dmId]: state.messages[dmId] || [],
      };
      savePersistedChannels(updatedChannels);
      savePersistedMessages(updatedMessages);
      return {
        channels: updatedChannels,
        messages: updatedMessages,
        activeChannelId: dmId,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      try {
        // Try RPC first
        const { data, error } = await client.rpc('get_or_create_dm', {
          target_user_id: targetUser.id,
        });
        if (error) {
          // RPC failed — rollback the optimistic channel we just added
          set((state) => {
            const updatedChannels = state.channels.filter((c) => c.id !== dmId);
            const updatedMessages = { ...state.messages };
            delete updatedMessages[dmId];
            savePersistedChannels(updatedChannels);
            savePersistedMessages(updatedMessages);
            return {
              channels: updatedChannels,
              messages: updatedMessages,
              activeChannelId: get().activeChannelId,
            };
          });
          throw new Error(error.message || 'Failed to create DM');
        }
        // RPC returns the canonical DM channel id — use it
        if (data && data !== dmId) {
          // Update state to use the canonical id from server
          set((state) => {
            const updatedChannels = state.channels.map((c) =>
              c.id === dmId ? { ...c, id: data } : c
            );
            const msgs = { ...state.messages };
            if (msgs[dmId]) {
              msgs[data] = msgs[dmId];
              delete msgs[dmId];
            }
            savePersistedChannels(updatedChannels);
            savePersistedMessages(msgs);
            return { channels: updatedChannels, messages: msgs, activeChannelId: data };
          });
          return data as string;
        }
      } catch (err) {
        console.warn('Supabase getOrCreateDmChannel RPC failed:', err);
        // Re-throw so caller can handle
        throw err;
      }
    }

    return dmId;
  },

  sendMessageWithAttachment: async (
    channelId: string,
    content: string,
    attachment: import('../types').MessageAttachment
  ) => {
    const trimmed = content.trim();

    const clientMessageId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const timestamp = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const newMessage: Message = {
      id: clientMessageId,
      clientMessageId,
      channelId,
      sender: get().currentUser,
      content: trimmed || attachment.name,
      timestamp,
      status: 'sending',
      attachment,
    };

    set((state) => {
      const currentChannelMessages = state.messages[channelId] || [];
      const updatedMessages = {
        ...state.messages,
        [channelId]: [...currentChannelMessages, newMessage],
      };
      savePersistedMessages(updatedMessages);
      return { messages: updatedMessages };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (client && isSupabaseConfigured) {
      try {
        const { data, error } = await client
          .from('messages')
          .insert({
            channel_id: channelId,
            sender_id: get().currentUser.id,
            content: trimmed || attachment.name,
            client_message_id: clientMessageId,
            attachment_url: attachment.url,
            attachment_name: attachment.name,
            attachment_type: attachment.type,
            attachment_size: attachment.size,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const actualDbId = String(data.id);
          set((state) => {
            const currentList = state.messages[channelId];
            if (!currentList) return state;

            const updated = currentList.map((msg) =>
              msg.clientMessageId === clientMessageId ||
              msg.id === clientMessageId
                ? { ...msg, id: actualDbId, status: 'sent' as const }
                : msg
            );
            const updatedMessages = { ...state.messages, [channelId]: updated };
            savePersistedMessages(updatedMessages);
            return { messages: updatedMessages };
          });
        }
      } catch (err) {
        console.warn('Supabase sendMessageWithAttachment failed:', err);
        set((state) => {
          const currentList = state.messages[channelId];
          if (!currentList) return state;

          const updated = currentList.map((msg) =>
            msg.clientMessageId === clientMessageId ||
            msg.id === clientMessageId
              ? { ...msg, status: 'failed' as const }
              : msg
          );
          const updatedMessages = { ...state.messages, [channelId]: updated };
          savePersistedMessages(updatedMessages);
          return { messages: updatedMessages };
        });
      }
    } else {
      // Offline fallback: simulated 1000ms delay
      const timerId = setTimeout(() => {
        activeMessageTimers.delete(timerId);
        set((state) => {
          const currentChannelMessages = state.messages[channelId];
          if (!currentChannelMessages) return state;

          const updated = currentChannelMessages.map((msg) =>
            msg.clientMessageId === clientMessageId ||
            msg.id === clientMessageId
              ? { ...msg, status: 'sent' as const }
              : msg
          );
          const updatedMessages = { ...state.messages, [channelId]: updated };
          savePersistedMessages(updatedMessages);
          return { messages: updatedMessages };
        });
      }, 1000);
      activeMessageTimers.add(timerId);
    }
  },

  subscribeToChannelChanges: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (!client || !isSupabaseConfigured) return () => {};

    const channel = client
      .channel('realtime:channels-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channels' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          set((state) => {
            if (state.channels.some((c) => c.id === row.id)) return state;
            const newCh: Channel = {
              id: row.id,
              name: row.name,
              description: row.description || '',
              iconName: (row.icon_name as ChannelIconName) || 'Hash',
              ownerId: row.owner_id || null,
              isDm: row.is_dm === true,
              members: [],
            };
            const updated = [...state.channels, newCh];
            savePersistedChannels(updated);
            return { channels: updated };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channels' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          set((state) => {
            const updated = state.channels.map((c) =>
              c.id === row.id
                ? { ...c, name: row.name, description: row.description || c.description }
                : c
            );
            savePersistedChannels(updated);
            return { channels: updated };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'channels' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const old = payload?.old;
          if (!old?.id) return;
          set((state) => {
            const updated = state.channels.filter((c) => c.id !== old.id);
            const nextActiveId =
              state.activeChannelId === old.id ? 'general' : state.activeChannelId;
            savePersistedChannels(updated);
            return { channels: updated, activeChannelId: nextActiveId };
          });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  },

  subscribeToReadStateChanges: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    if (!client || !isSupabaseConfigured) return () => {};

    const currentUserId = get().currentUser.id;
    if (!currentUserId || currentUserId.startsWith('user-')) return () => {};

    const channel = client
      .channel(`realtime:read-state:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channel_members',
          filter: `user_id=eq.${currentUserId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload?.new;
          if (!row?.channel_id || !row?.last_read_at) return;
          // Another device updated read state — re-fetch unread counts for all channels
          get().fetchUnreadCounts?.();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  },

  resetWorkspaceState: () => {
    // Clear all in-flight message timers to prevent post-reset execution
    activeMessageTimers.forEach((timerId) => clearTimeout(timerId));
    activeMessageTimers.clear();

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_MESSAGES);
        localStorage.removeItem(STORAGE_KEY_CHANNELS);
      } catch {
        // Ignore storage errors
      }
    }
    set({
      channels: INITIAL_CHANNELS,
      activeChannelId: 'general',
      messages: INITIAL_MESSAGES,
      currentUser: INITIAL_USER,
      unreadCounts: {},
      notification: null,
    });
  },
}));
