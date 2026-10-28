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

  setActiveChannel: (channelId: string) => {
    set((state) => {
      const channelExists = state.channels.some((c) => c.id === channelId);
      if (!channelExists || state.activeChannelId === channelId) {
        return state;
      }
      return { activeChannelId: channelId };
    });
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
            return { messages: updatedMessages };
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
      try {
        await client.from('channel_members').insert({
          channel_id: channelId,
          user_id: memberObj.id,
          role: 'member',
        });
      } catch (err: unknown) {
        console.warn('Supabase addMember insert failed:', err);
      }
    }
  },

  setCurrentUser: (user: User) => {
    set({ currentUser: user });
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
    });
  },
}));
