// ==============================================================================
// Production-Ready TypeScript Data Contracts & Database Schema Mappings
// Target: src/types/index.ts
// ==============================================================================

export type MessageStatus = 'sending' | 'sent' | 'failed';

export type ChannelIconName = 'Hash' | 'MessageSquare' | 'Bell' | 'Code';

export type ChannelMemberRole = 'owner' | 'admin' | 'member';

// ─── Application Domain Models ───────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  statusText?: string;
}

export interface AuthUser extends User {
  email: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  iconName: ChannelIconName;
  ownerId?: string | null;
  createdAt?: string;
  members?: User[];
}

export interface ChannelMember {
  channelId: string;
  userId: string;
  role: ChannelMemberRole;
  joinedAt: string;
  user?: User;
}

export interface Message {
  id: string;
  channelId: string;
  sender: User;
  content: string;
  timestamp: string;
  status: MessageStatus;
  clientMessageId?: string;
  createdAt?: string;
}

// ─── Store State Interfaces ──────────────────────────────────────────────────

export interface AuthStoreState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void> | void;
  signIn?: (email: string, password: string) => Promise<void>;
  signUp?: (name: string, email: string, password: string) => Promise<void>;
  signOut?: () => Promise<void> | void;
}

export interface WorkspaceStoreState {
  channels: Channel[];
  activeChannelId: string;
  messages: Record<string, Message[]>;
  currentUser: User;
  setActiveChannel: (channelId: string) => void;
  sendMessage: (channelId: string, content: string) => void;
  retryMessage: (channelId: string, messageId: string) => Promise<void> | void;
  fetchChannels?: () => Promise<void>;
  fetchMessages: (channelId?: string) => Promise<void>;
  subscribeToRealtime: (channelId?: string) => () => void;
  createChannel: (name: string, description?: string) => Promise<void> | void;
  addMemberToChannel: (channelId: string, user: User | string) => Promise<void> | void;
  setCurrentUser: (user: User) => void;
  resetWorkspaceState: () => void;
}

// ─── Database Row, Insert, and Update Types (Supabase Postgres) ──────────────

export type ProfileRow = {
  id: string; // uuid references auth.users(id)
  name: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  status_text: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  name: string;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  status_text?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  name?: string;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  status_text?: string | null;
  updated_at?: string;
};

export type ChannelRow = {
  id: string; // text slug or uuid string
  name: string;
  description: string | null;
  icon_name: ChannelIconName;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ChannelInsert = {
  id: string;
  name: string;
  description?: string | null;
  icon_name?: ChannelIconName;
  owner_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ChannelUpdate = {
  name?: string;
  description?: string | null;
  icon_name?: ChannelIconName;
  owner_id?: string | null;
  updated_at?: string;
};

export type ChannelMemberRow = {
  channel_id: string;
  user_id: string;
  role: ChannelMemberRole;
  joined_at: string;
};

export type ChannelMemberInsert = {
  channel_id: string;
  user_id: string;
  role?: ChannelMemberRole;
  joined_at?: string;
};

export type ChannelMemberUpdate = {
  role?: ChannelMemberRole;
};

export type MessageRow = {
  id: string; // uuid
  channel_id: string;
  sender_id: string;
  content: string;
  client_message_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageInsert = {
  id?: string;
  channel_id: string;
  sender_id: string;
  content: string;
  client_message_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MessageUpdate = {
  content?: string;
  updated_at?: string;
};

// ─── Supabase Database Definition ────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      channels: {
        Row: ChannelRow;
        Insert: ChannelInsert;
        Update: ChannelUpdate;
        Relationships: [];
      };
      channel_members: {
        Row: ChannelMemberRow;
        Insert: ChannelMemberInsert;
        Update: ChannelMemberUpdate;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: MessageUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_channel_member: {
        Args: { target_channel_id: string; target_user_id: string };
        Returns: boolean;
      };
      get_channel_role: {
        Args: { target_channel_id: string; target_user_id: string };
        Returns: ChannelMemberRole;
      };
      create_channel_atomic: {
        Args: {
          p_id: string;
          p_name: string;
          p_description?: string;
          p_icon_name?: string;
        };
        Returns: ChannelRow;
      };
    };
  };
}
