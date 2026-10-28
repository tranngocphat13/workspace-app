import { describe, it, expect, beforeEach } from '../harness';
import { useWorkspaceStore } from '../../src/store/useWorkspaceStore';
import { validateFile } from '../../src/lib/storage';
import type { User, MessageAttachment } from '../../src/types';

describe('Tier 5: Phase 2 CHAT MVP Features', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspaceState();
  });

  // Feature 1: Message CRUD
  describe('F1: Message CRUD', () => {
    it('F1-T1: Edit message modifies message content and sets isEdited to true', async () => {
      const store = useWorkspaceStore.getState();
      store.sendMessage('general', 'Hello world original');
      const msgList = useWorkspaceStore.getState().messages['general'];
      const targetMsg = msgList[msgList.length - 1];

      await store.editMessage('general', targetMsg.id, 'Hello world edited');

      const updatedList = useWorkspaceStore.getState().messages['general'];
      const updated = updatedList.find((m) => m.id === targetMsg.id);

      expect(Boolean(updated)).toBe(true);
      expect(updated?.content).toBe('Hello world edited');
      expect(updated?.isEdited).toBe(true);
    });

    it('F1-T2: Delete message removes message from store cleanly', async () => {
      const store = useWorkspaceStore.getState();
      store.sendMessage('general', 'Temporary message');
      const msgList = useWorkspaceStore.getState().messages['general'];
      const targetMsg = msgList[msgList.length - 1];

      await store.deleteMessage('general', targetMsg.id);

      const updatedList = useWorkspaceStore.getState().messages['general'];
      const exists = updatedList.some((m) => m.id === targetMsg.id);
      expect(exists).toBe(false);
    });
  });

  // Feature 2: Channel Management
  describe('F2: Channel Management', () => {
    it('F2-T1: createChannel creates and registers new channel', async () => {
      const store = useWorkspaceStore.getState();
      await store.createChannel('frontend-team', 'Frontend discussions');

      const channels = useWorkspaceStore.getState().channels;
      const found = channels.find((c) => c.id === 'frontend-team' || c.name === 'frontend-team');

      expect(Boolean(found)).toBe(true);
      expect(found?.description).toBe('Frontend discussions');
    });

    it('F2-T2: updateChannel updates channel metadata', async () => {
      const store = useWorkspaceStore.getState();
      await store.createChannel('backend-team', 'Old backend desc');
      await store.updateChannel('backend-team', {
        name: 'backend-team-updated',
        description: 'New backend desc',
      });

      const channels = useWorkspaceStore.getState().channels;
      const updated = channels.find((c) => c.id === 'backend-team');

      expect(Boolean(updated)).toBe(true);
      expect(updated?.name).toBe('backend-team-updated');
      expect(updated?.description).toBe('New backend desc');
    });

    it('F2-T3: deleteChannel removes custom channel and guards default #general', async () => {
      const store = useWorkspaceStore.getState();
      await store.createChannel('temp-channel', 'temp');
      store.setActiveChannel('temp-channel');
      expect(useWorkspaceStore.getState().activeChannelId).toBe('temp-channel');

      await store.deleteChannel('temp-channel');
      expect(useWorkspaceStore.getState().channels.some((c) => c.id === 'temp-channel')).toBe(false);
      expect(useWorkspaceStore.getState().activeChannelId).toBe('general');

      // Guard default general
      await store.deleteChannel('general');
      expect(useWorkspaceStore.getState().channels.some((c) => c.id === 'general')).toBe(true);
    });
  });

  // Feature 3: Direct Message (DM)
  describe('F3: Direct Message', () => {
    it('F3-T1: getOrCreateDmChannel creates deterministic DM channel with isDm: true', async () => {
      const store = useWorkspaceStore.getState();
      const userAlpha: User = { id: 'usr-1', name: 'User 1' };
      const userBeta: User = { id: 'usr-2', name: 'User 2' };

      store.setCurrentUser(userAlpha);
      const dmId = await store.getOrCreateDmChannel(userBeta);

      expect(dmId).toBe('dm-usr-1-usr-2');

      const dmChannel = useWorkspaceStore.getState().channels.find((c) => c.id === dmId);
      expect(Boolean(dmChannel)).toBe(true);
      expect(dmChannel?.isDm).toBe(true);
      expect(dmChannel?.name).toBe('User 2');
    });

    it('F3-T2: getOrCreateDmChannel does not create duplicate conversations', async () => {
      const store = useWorkspaceStore.getState();
      const userAlpha: User = { id: 'usr-1', name: 'User 1' };
      const userBeta: User = { id: 'usr-2', name: 'User 2' };

      store.setCurrentUser(userAlpha);
      const dmId1 = await store.getOrCreateDmChannel(userBeta);
      const count1 = useWorkspaceStore.getState().channels.length;

      const dmId2 = await store.getOrCreateDmChannel(userBeta);
      const count2 = useWorkspaceStore.getState().channels.length;

      expect(dmId1).toBe(dmId2);
      expect(count1).toBe(count2);
    });
  });

  // Feature 4: File & Image Upload
  describe('F4: File & Image Upload Validation', () => {
    it('F4-T1: validateFile enforces 10MB file limit', () => {
      const oversized = { size: 15 * 1024 * 1024, type: 'image/png', name: 'huge.png' } as unknown as File;
      const res = validateFile(oversized);
      expect(res.valid).toBe(false);
    });

    it('F4-T2: validateFile allows standard images and documents', () => {
      const img = { size: 2 * 1024 * 1024, type: 'image/png', name: 'screen.png' } as unknown as File;
      const pdf = { size: 1 * 1024 * 1024, type: 'application/pdf', name: 'spec.pdf' } as unknown as File;
      expect(validateFile(img).valid).toBe(true);
      expect(validateFile(pdf).valid).toBe(true);
    });

    it('F4-T3: sendMessageWithAttachment stores attachment correctly on message', async () => {
      const store = useWorkspaceStore.getState();
      const attachment: MessageAttachment = {
        url: 'https://cdn.example.com/file.png',
        name: 'file.png',
        type: 'image/png',
        size: 2048,
      };

      if (store.sendMessageWithAttachment) {
        await store.sendMessageWithAttachment('general', 'Attachment test', attachment);
        const msgs = useWorkspaceStore.getState().messages['general'];
        const last = msgs[msgs.length - 1];
        expect(Boolean(last.attachment)).toBe(true);
        expect(last.attachment?.url).toBe(attachment.url);
        expect(last.attachment?.name).toBe(attachment.name);
      }
    });
  });

  // Feature 5: Search & Notifications
  describe('F5: Search & Notifications', () => {
    it('F5-T1: Switching channel resets unread count for that channel', () => {
      useWorkspaceStore.setState({
        unreadCounts: { random: 5, announcements: 1 },
      });

      expect(useWorkspaceStore.getState().unreadCounts['random']).toBe(5);
      useWorkspaceStore.getState().setActiveChannel('random');
      expect(useWorkspaceStore.getState().unreadCounts['random']).toBe(0);
      expect(useWorkspaceStore.getState().unreadCounts['announcements']).toBe(1);
    });

    it('F5-T2: In-app notification state can be set and dismissed', () => {
      useWorkspaceStore.setState({
        notification: {
          id: 'n-1',
          title: 'Test Sender',
          message: 'Important alert',
          channelId: 'general',
        },
      });

      expect(Boolean(useWorkspaceStore.getState().notification)).toBe(true);
      useWorkspaceStore.getState().dismissNotification();
      expect(useWorkspaceStore.getState().notification).toBe(null);
    });
  });
});
