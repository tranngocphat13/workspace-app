import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Message, MessageStatus, User } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface SupabaseMessageRowInput {
  id?: string | number | null;
  channel_id?: string | null;
  channelId?: string | null;
  content?: string | null;
  status?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  client_message_id?: string | null;
  is_edited?: boolean | null;
  isEdited?: boolean | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  attachment?: {
    url: string;
    name: string;
    type: string;
    size?: number;
  } | null;
  sender?:
    | {
        id?: string | null;
        name?: string | null;
        avatarUrl?: string | null;
        avatar_url?: string | null;
        statusText?: string | null;
        status_text?: string | null;
      }
    | string
    | null;
}

export function mapSupabaseMessage(row: unknown): Message {
  const r = (row && typeof row === 'object' ? row : {}) as SupabaseMessageRowInput;

  let sender: User = {
    id: 'user-system',
    name: 'Member',
    avatarUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    statusText: 'Online',
  };

  if (r.sender && typeof r.sender === 'object') {
    sender = {
      id: r.sender.id || 'user-unknown',
      name: r.sender.name || 'Anonymous',
      avatarUrl: r.sender.avatarUrl || r.sender.avatar_url || sender.avatarUrl,
      statusText: r.sender.statusText || r.sender.status_text || 'Online',
    };
  } else if (typeof r.sender === 'string') {
    try {
      const parsed = JSON.parse(r.sender) as Record<string, unknown>;
      sender = {
        id: typeof parsed.id === 'string' ? parsed.id : sender.id,
        name: typeof parsed.name === 'string' ? parsed.name : r.sender,
        avatarUrl:
          typeof parsed.avatarUrl === 'string'
            ? parsed.avatarUrl
            : typeof parsed.avatar_url === 'string'
            ? parsed.avatar_url
            : sender.avatarUrl,
        statusText:
          typeof parsed.statusText === 'string'
            ? parsed.statusText
            : typeof parsed.status_text === 'string'
            ? parsed.status_text
            : 'Online',
      };
    } catch {
      sender.name = r.sender;
    }
  }

  const timestamp =
    r.timestamp ||
    (r.created_at
      ? new Date(r.created_at).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : new Date().toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }));

  const isEdited = Boolean(
    r.is_edited ||
    r.isEdited ||
    (r.created_at && r.updated_at && new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 1000)
  );

  let attachment = r.attachment || undefined;
  if (!attachment && r.attachment_url) {
    attachment = {
      url: r.attachment_url,
      name: r.attachment_name || 'attachment',
      type: r.attachment_type || 'application/octet-stream',
      size: r.attachment_size ?? undefined,
    };
  }

  return {
    id: r.id !== undefined && r.id !== null ? String(r.id) : `msg-${Date.now()}`,
    channelId: r.channel_id || r.channelId || 'general',
    sender,
    content: r.content || '',
    timestamp,
    status: (r.status as MessageStatus) || 'sent',
    clientMessageId: r.client_message_id || undefined,
    isEdited,
    attachment,
  };
}

