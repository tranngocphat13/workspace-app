export type MessageStatus = 'sending' | 'sent';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  statusText?: string;
}

export interface AuthStoreState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  iconName: 'Hash' | 'MessageSquare' | 'Bell' | 'Code';
  members?: User[];
}

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  statusText?: string;
}

export interface Message {
  id: string;
  channelId: string;
  sender: User;
  content: string;
  timestamp: string;
  status: MessageStatus;
}

export interface WorkspaceStoreState {
  channels: Channel[];
  activeChannelId: string;
  messages: Record<string, Message[]>;
  currentUser: User;
  setActiveChannel: (channelId: string) => void;
  sendMessage: (channelId: string, content: string) => void;
  fetchMessages: (channelId?: string) => Promise<void>;
  subscribeToRealtime: () => () => void;
  createChannel: (name: string, description?: string) => Promise<void> | void;
  addMemberToChannel: (channelId: string, user: User | string) => Promise<void> | void;
}
