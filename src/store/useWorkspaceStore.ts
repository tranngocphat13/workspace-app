import { create } from 'zustand';
import type { Channel, Message, User, WorkspaceStoreState } from '../types';
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

  fetchMessages: async (channelId?: string) => {
    const client = supabase;
    if (!client || !isSupabaseConfigured) {
      const cached = getPersistedMessages();
      if (cached) {
        set({ messages: cached });
      }
      return;
    }

    try {
      let query = client.from('Message').select('*');
      if (channelId) {
        query = query.eq('channel_id', channelId);
      }
      const { data, error } = await query;
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
            if (!list.some((existing) => existing.id === msg.id)) {
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

  subscribeToRealtime: () => {
    const client = supabase;
    if (!client || !isSupabaseConfigured) {
      return () => {};
    }

    const realtimeChannel = client
      .channel('messages-realtime-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Message' },
        (payload) => {
          const newMsg = mapSupabaseMessage(payload.new);
          set((state) => {
            const chId = newMsg.channelId;
            const currentList = state.messages[chId] || [];

            if (currentList.some((m) => m.id === newMsg.id)) {
              return state;
            }

            const pendingIndex = currentList.findIndex(
              (m) =>
                m.status === 'sending' &&
                m.content === newMsg.content &&
                m.sender.id === newMsg.sender.id
            );

            let updatedList: Message[];
            if (pendingIndex !== -1) {
              updatedList = [...currentList];
              updatedList[pendingIndex] = newMsg;
            } else {
              updatedList = [...currentList, newMsg];
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
      .subscribe();

    return () => {
      client.removeChannel(realtimeChannel);
    };
  },

  sendMessage: (channelId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const tempMessageId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const timestamp = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const newMessage: Message = {
      id: tempMessageId,
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

    // Supabase insert with Optimistic ID replacement
    const client = supabase;
    if (client && isSupabaseConfigured) {
      (async () => {
        try {
          const { data, error } = await client
            .from('Message')
            .insert({
              channel_id: channelId,
              sender: get().currentUser,
              content: trimmed,
              timestamp,
              status: 'sent',
            })
            .select()
            .single();

          if (!error && data) {
            const actualDbId = String(data.id);
            set((state) => {
              const currentList = state.messages[channelId];
              if (!currentList) return state;

              const updated = currentList.map((msg) =>
                msg.id === tempMessageId
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
          console.warn('Supabase insert failed, keeping local message:', err);
        }
      })();
    }

    // Simulated 1000ms delay fallback for offline & test environment
    setTimeout(() => {
      set((state) => {
        const currentChannelMessages = state.messages[channelId];
        if (!currentChannelMessages) {
          return state;
        }

        const updated = currentChannelMessages.map((msg) =>
          msg.id === tempMessageId ? { ...msg, status: 'sent' as const } : msg
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

    // Supabase insert into 'Channel' table
    const client = supabase;
    if (client && isSupabaseConfigured) {
      try {
        await client.from('Channel').insert({
          id: newChannel.id,
          name: newChannel.name,
          description: newChannel.description,
          icon_name: 'Hash',
          iconName: 'Hash',
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

    // Supabase insert into 'Member' (or 'ChannelMembers') table
    const client = supabase;
    if (client && isSupabaseConfigured) {
      try {
        await client.from('Member').insert({
          channel_id: channelId,
          channelId: channelId,
          user_id: memberObj.id,
          userId: memberObj.id,
          name: memberObj.name,
        });
      } catch (err: unknown) {
        console.warn('Supabase addMember insert failed:', err);
      }
    }
  },
}));
