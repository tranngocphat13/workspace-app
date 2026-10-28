import { useWorkspaceStore } from '../src/store/useWorkspaceStore';
import { validateFile } from '../src/lib/storage';
import type { User, MessageAttachment } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase2Tests() {
  console.log('\n================================================================');
  console.log('   PHASE 2 CHAT MVP TARGETED FEATURE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ [FAIL] ${name}: ${msg}`);
      failed++;
    }
  }

  const store = useWorkspaceStore.getState();

  // ─── FEATURE 1: MESSAGE CRUD ──────────────────────────────────────────────
  console.log('\n--- FEATURE 1: MESSAGE CRUD ---');

  await test('F1.1: Edit message updates content and sets isEdited flag', async () => {
    store.resetWorkspaceState();
    store.sendMessage('general', 'Original message');

    const msgs = useWorkspaceStore.getState().messages['general'];
    const targetMsg = msgs[msgs.length - 1];

    await useWorkspaceStore.getState().editMessage('general', targetMsg.id, 'Edited message content');

    const updatedMsgs = useWorkspaceStore.getState().messages['general'];
    const updated = updatedMsgs.find((m) => m.id === targetMsg.id);

    assert(Boolean(updated), 'Message should exist');
    assert(updated?.content === 'Edited message content', 'Content should be updated');
    assert(updated?.isEdited === true, 'isEdited flag should be true');
  });

  await test('F1.2: Delete message removes message from channel message list', async () => {
    store.sendMessage('general', 'Message to delete');
    const msgs = useWorkspaceStore.getState().messages['general'];
    const targetMsg = msgs[msgs.length - 1];

    await useWorkspaceStore.getState().deleteMessage('general', targetMsg.id);

    const updatedMsgs = useWorkspaceStore.getState().messages['general'];
    const exists = updatedMsgs.some((m) => m.id === targetMsg.id);
    assert(!exists, 'Deleted message should not be present in messages list');
  });

  // ─── FEATURE 2: CHANNEL MANAGEMENT ────────────────────────────────────────
  console.log('\n--- FEATURE 2: CHANNEL MANAGEMENT ---');

  await test('F2.1: Create channel appends new channel to channels list', async () => {
    await useWorkspaceStore.getState().createChannel('dev-testing', 'Test channel description');
    const channels = useWorkspaceStore.getState().channels;
    const created = channels.find((c) => c.name === 'dev-testing' || c.id === 'dev-testing');
    assert(Boolean(created), 'Created channel should exist');
    assert(created?.description === 'Test channel description', 'Description should match');
  });

  await test('F2.2: Update channel modifies name and description', async () => {
    await useWorkspaceStore.getState().updateChannel('dev-testing', {
      name: 'dev-testing-updated',
      description: 'Updated description',
    });
    const channels = useWorkspaceStore.getState().channels;
    const updated = channels.find((c) => c.id === 'dev-testing');
    assert(Boolean(updated), 'Channel should exist');
    assert(updated?.name === 'dev-testing-updated', 'Channel name should be updated');
    assert(updated?.description === 'Updated description', 'Channel description should be updated');
  });

  await test('F2.3: Delete channel removes non-default channel and resets activeChannel if active', async () => {
    useWorkspaceStore.getState().setActiveChannel('dev-testing');
    assert(useWorkspaceStore.getState().activeChannelId === 'dev-testing', 'Active channel should be dev-testing');

    await useWorkspaceStore.getState().deleteChannel('dev-testing');
    const channels = useWorkspaceStore.getState().channels;
    const exists = channels.some((c) => c.id === 'dev-testing');
    assert(!exists, 'Deleted channel should not exist');
    assert(useWorkspaceStore.getState().activeChannelId === 'general', 'Active channel should fall back to general');
  });

  await test('F2.4: Default channel #general cannot be deleted or left', async () => {
    await useWorkspaceStore.getState().deleteChannel('general');
    assert(useWorkspaceStore.getState().channels.some((c) => c.id === 'general'), '#general must still exist');

    await useWorkspaceStore.getState().leaveChannel('general');
    assert(useWorkspaceStore.getState().channels.some((c) => c.id === 'general'), '#general must still be present');
  });

  // ─── FEATURE 3: DIRECT MESSAGE (DM) ───────────────────────────────────────
  console.log('\n--- FEATURE 3: DIRECT MESSAGE ---');

  const testUserA: User = { id: 'user-alice', name: 'Alice Smith' };
  const testUserB: User = { id: 'user-bob', name: 'Bob Jones' };

  await test('F3.1: getOrCreateDmChannel creates deterministic DM channel with isDm: true', async () => {
    useWorkspaceStore.getState().setCurrentUser(testUserA);
    const dmId = await useWorkspaceStore.getState().getOrCreateDmChannel(testUserB);

    assert(dmId.startsWith('dm-'), 'DM ID should start with dm-');
    assert(dmId.includes('user-alice') && dmId.includes('user-bob'), 'DM ID should contain both user IDs');

    const channels = useWorkspaceStore.getState().channels;
    const dmChannel = channels.find((c) => c.id === dmId);
    assert(Boolean(dmChannel), 'DM channel should exist in channels');
    assert(dmChannel?.isDm === true, 'DM channel should have isDm flag set to true');
  });

  await test('F3.2: getOrCreateDmChannel prevents duplicate DM channels between same users', async () => {
    const channelCountBefore = useWorkspaceStore.getState().channels.length;
    const dmIdSecondCall = await useWorkspaceStore.getState().getOrCreateDmChannel(testUserB);
    const channelCountAfter = useWorkspaceStore.getState().channels.length;

    assert(channelCountBefore === channelCountAfter, 'Duplicate DM channel must not be created');
    assert(useWorkspaceStore.getState().activeChannelId === dmIdSecondCall, 'Active channel should switch to existing DM');
  });

  // ─── FEATURE 4: FILE & IMAGE UPLOAD ───────────────────────────────────────
  console.log('\n--- FEATURE 4: FILE & IMAGE UPLOAD ---');

  await test('F4.1: validateFile rejects files larger than 10MB', () => {
    const largeFile = { size: 12 * 1024 * 1024, type: 'image/png', name: 'large.png' } as unknown as File;
    const result = validateFile(largeFile);
    assert(result.valid === false, 'Large file must be rejected');
    assert(Boolean(result.error?.includes('10MB')), 'Error message should mention 10MB limit');
  });

  await test('F4.2: validateFile accepts valid images and PDF documents', () => {
    const validImg = { size: 2 * 1024 * 1024, type: 'image/jpeg', name: 'photo.jpg' } as unknown as File;
    const validPdf = { size: 1 * 1024 * 1024, type: 'application/pdf', name: 'doc.pdf' } as unknown as File;
    assert(validateFile(validImg).valid === true, 'Valid JPEG image must be accepted');
    assert(validateFile(validPdf).valid === true, 'Valid PDF document must be accepted');
  });

  await test('F4.3: sendMessageWithAttachment stores attachment metadata on message', async () => {
    const attachment: MessageAttachment = {
      url: 'https://example.com/uploaded.png',
      name: 'uploaded.png',
      type: 'image/png',
      size: 1024,
    };

    if (useWorkspaceStore.getState().sendMessageWithAttachment) {
      await useWorkspaceStore.getState().sendMessageWithAttachment!('general', 'Here is the diagram', attachment);
      const msgs = useWorkspaceStore.getState().messages['general'];
      const lastMsg = msgs[msgs.length - 1];
      assert(Boolean(lastMsg.attachment), 'Attachment must be present on message');
      assert(lastMsg.attachment?.url === attachment.url, 'Attachment URL must match');
      assert(lastMsg.attachment?.name === attachment.name, 'Attachment name must match');
    }
  });

  // ─── FEATURE 5: SEARCH & NOTIFICATIONS ────────────────────────────────────
  console.log('\n--- FEATURE 5: SEARCH & NOTIFICATIONS ---');

  await test('F5.1: Switching active channel resets unread count for that channel', () => {
    useWorkspaceStore.setState({
      unreadCounts: { random: 3, announcements: 2 },
    });
    assert(useWorkspaceStore.getState().unreadCounts['random'] === 3, 'Initial unread count is 3');

    useWorkspaceStore.getState().setActiveChannel('random');
    assert(useWorkspaceStore.getState().unreadCounts['random'] === 0, 'Unread count for active channel must reset to 0');
    assert(useWorkspaceStore.getState().unreadCounts['announcements'] === 2, 'Unread count for other channel must be preserved');
  });

  await test('F5.2: In-app notification can be dismissed cleanly', () => {
    useWorkspaceStore.setState({
      notification: {
        id: 'notif-1',
        title: 'Sarah Chen',
        message: 'Hello team!',
        channelId: 'announcements',
      },
    });

    assert(Boolean(useWorkspaceStore.getState().notification), 'Notification should be present');
    useWorkspaceStore.getState().dismissNotification();
    assert(useWorkspaceStore.getState().notification === null, 'Notification should be dismissed');
  });

  console.log('\n================================================================');
  console.log(`Phase 2 MVP Test Run: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
