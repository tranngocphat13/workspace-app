import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Message, MessageStatus, User } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function mapSupabaseMessage(row: any): Message {
  let sender: User = {
    id: 'user-system',
    name: 'Member',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    statusText: 'Online',
  };

  if (row.sender && typeof row.sender === 'object') {
    sender = {
      id: row.sender.id || 'user-unknown',
      name: row.sender.name || 'Anonymous',
      avatarUrl: row.sender.avatarUrl || sender.avatarUrl,
      statusText: row.sender.statusText || 'Online',
    };
  } else if (typeof row.sender === 'string') {
    try {
      const parsed = JSON.parse(row.sender);
      sender = { ...sender, ...parsed };
    } catch {
      sender.name = row.sender;
    }
  }

  const timestamp =
    row.timestamp ||
    (row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : new Date().toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }));

  return {
    id: String(row.id),
    channelId: row.channel_id || row.channelId || 'general',
    sender,
    content: row.content || '',
    timestamp,
    status: (row.status as MessageStatus) || 'sent',
  };
}
