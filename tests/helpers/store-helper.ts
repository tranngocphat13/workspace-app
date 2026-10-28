import { useWorkspaceStore } from '../../src/store/useWorkspaceStore';
import type { Channel, Message, User, WorkspaceStoreState } from '../../src/types';

export const INITIAL_TEST_USER: User = {
  id: 'user-current',
  name: 'Alex Johnson',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
  statusText: 'Online',
};

export const INITIAL_TEST_CHANNELS: Channel[] = [
  {
    id: 'general',
    name: 'general',
    description: 'Company-wide announcements and team discussions',
    iconName: 'Hash',
  },
  {
    id: 'random',
    name: 'random',
    description: 'Water cooler chat, off-topic discussions, and fun',
    iconName: 'MessageSquare',
  },
  {
    id: 'announcements',
    name: 'announcements',
    description: 'Official workspace updates, policy changes, and events',
    iconName: 'Bell',
  },
  {
    id: 'development',
    name: 'development',
    description: 'Engineering discussions, commits, pull requests, and deploys',
    iconName: 'Code',
  },
];

export function resetStore(): void {
  useWorkspaceStore.setState({
    channels: INITIAL_TEST_CHANNELS,
    activeChannelId: 'general',
    currentUser: INITIAL_TEST_USER,
    messages: {
      general: [
        {
          id: 'msg-gen-1',
          channelId: 'general',
          sender: { id: 'user-sarah', name: 'Sarah Chen' },
          content: 'Welcome to the new workspace! Let us know if you need anything.',
          timestamp: '09:00 AM',
          status: 'sent',
        },
        {
          id: 'msg-gen-2',
          channelId: 'general',
          sender: INITIAL_TEST_USER,
          content: 'Thanks Sarah! Setting up our real-time messaging pipeline now.',
          timestamp: '09:05 AM',
          status: 'sent',
        },
      ],
      random: [
        {
          id: 'msg-rnd-1',
          channelId: 'random',
          sender: { id: 'user-jessica', name: 'Jessica Taylor' },
          content: 'Fresh pour-over coffee available in the kitchen! ☕',
          timestamp: '10:15 AM',
          status: 'sent',
        },
      ],
      announcements: [
        {
          id: 'msg-ann-1',
          channelId: 'announcements',
          sender: { id: 'user-sarah', name: 'Sarah Chen' },
          content: 'Quarterly roadmap presentation is scheduled for Thursday at 2:00 PM EST.',
          timestamp: 'Yesterday at 4:30 PM',
          status: 'sent',
        },
      ],
      development: [
        {
          id: 'msg-dev-1',
          channelId: 'development',
          sender: { id: 'user-bot', name: 'Deploy Bot' },
          content: 'Release v1.2.0 deployed to staging successfully.',
          timestamp: '08:45 AM',
          status: 'sent',
        },
      ],
    },
  });
}

export function getStoreState(): WorkspaceStoreState {
  return useWorkspaceStore.getState();
}

export async function waitForMessageSent(
  channelId: string,
  messageId: string,
  timeoutMs = 2500
): Promise<Message> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const messages = useWorkspaceStore.getState().messages[channelId] || [];
    const msg = messages.find((m) => m.id === messageId);
    if (msg && msg.status === 'sent') {
      return msg;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for message ${messageId} in channel ${channelId} to reach status 'sent'`);
}
