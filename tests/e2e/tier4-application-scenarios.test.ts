import { describe, it, expect, beforeEach, sleep } from '../harness';
import { useWorkspaceStore } from '../../src/store/useWorkspaceStore';
import { resetStore, getStoreState, waitForMessageSent } from '../helpers/store-helper';

describe('Tier 4: Real-World Application Scenarios', () => {
  beforeEach(() => {
    resetStore();
  });

  // =========================================================================
  // Scenario 1: Standard User Journey
  // User opens app, sees default channel (#general) with seed messages,
  // switches to #random, sends a message, sees 'sending' indicator, waits 1s,
  // verifies 'sent' indicator.
  // =========================================================================
  it('Scenario 1: Standard User Journey: Open app -> seed messages -> switch channel -> send -> optimistic sending -> resolved sent', async () => {
    // 1. Initial app state: default channel is general with pre-seeded messages
    const state0 = getStoreState();
    expect(state0.activeChannelId).toBe('general');
    expect(state0.messages['general'].length).toBeGreaterThanOrEqual(2);

    // 2. User switches to #random channel
    useWorkspaceStore.getState().setActiveChannel('random');
    const state1 = getStoreState();
    expect(state1.activeChannelId).toBe('random');
    const initialRandomCount = state1.messages['random'].length;

    // 3. User types and submits message in #random
    const userMessage = 'Good morning team! Coffee is ready.';
    useWorkspaceStore.getState().sendMessage('random', userMessage);

    // 4. Instantly appended with status 'sending'
    const state2 = getStoreState();
    expect(state2.messages['random'].length).toBe(initialRandomCount + 1);
    const sentMsg = state2.messages['random'][state2.messages['random'].length - 1];
    expect(sentMsg.content).toBe(userMessage);
    expect(sentMsg.status).toBe('sending');

    // 5. Wait 1000ms network delay
    const resolved = await waitForMessageSent('random', sentMsg.id, 2000);
    expect(resolved.status).toBe('sent');

    // 6. Verify final channel count and no duplicates
    const finalRandom = getStoreState().messages['random'];
    expect(finalRandom.length).toBe(initialRandomCount + 1);
    expect(finalRandom[finalRandom.length - 1].status).toBe('sent');
  });

  // =========================================================================
  // Scenario 2: Rapid-fire Multi-Message Burst
  // User sends 3 messages in quick succession in #general, all 3 show 'sending',
  // input clears each time, all 3 resolve to 'sent' in order without duplicates.
  // =========================================================================
  it('Scenario 2: Rapid-fire Multi-Message Burst in #general: immediate sending -> sequential resolution -> ordered sent', async () => {
    const initialCount = getStoreState().messages['general'].length;
    const contents = [
      'Burst 1: Starting deployment pipeline...',
      'Burst 2: Build artifacts generated.',
      'Burst 3: Deployed to staging!',
    ];

    // Rapidly submit all 3 messages (< 10ms apart)
    for (const text of contents) {
      useWorkspaceStore.getState().sendMessage('general', text);
    }

    // Immediately verify all 3 were appended with status 'sending'
    const stateImmediate = getStoreState();
    expect(stateImmediate.messages['general'].length).toBe(initialCount + 3);
    const appended = stateImmediate.messages['general'].slice(-3);
    for (let i = 0; i < 3; i++) {
      expect(appended[i].content).toBe(contents[i]);
      expect(appended[i].status).toBe('sending');
    }

    // Wait for all 3 messages to resolve
    for (const msg of appended) {
      await waitForMessageSent('general', msg.id, 2500);
    }

    // Verify ordering and statuses
    const stateFinal = getStoreState();
    const final3 = stateFinal.messages['general'].slice(-3);
    expect(final3.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(final3[i].content).toBe(contents[i]);
      expect(final3[i].status).toBe('sent');
    }
  });

  // =========================================================================
  // Scenario 3: In-flight Channel Switch
  // User sends message in #general, immediately switches to #announcements within 200ms,
  // verifies #general message resolves to 'sent' when navigating back.
  // =========================================================================
  it('Scenario 3: In-flight channel switch: Send in #general -> switch to #announcements -> wait -> return to #general verified as sent', async () => {
    const text = 'Urgent update regarding the upcoming maintenance';
    useWorkspaceStore.getState().sendMessage('general', text);
    const inFlightMsg = getStoreState().messages['general'].slice(-1)[0];
    expect(inFlightMsg.status).toBe('sending');

    // Switch to #announcements within 100ms
    await sleep(100);
    useWorkspaceStore.getState().setActiveChannel('announcements');
    expect(getStoreState().activeChannelId).toBe('announcements');

    // Confirm announcements message list does NOT contain the general message
    const annMessages = getStoreState().messages['announcements'];
    expect(annMessages.some((m) => m.id === inFlightMsg.id)).toBe(false);

    // Wait for network latency simulation to finish in background
    await sleep(1150);

    // Switch back to #general
    useWorkspaceStore.getState().setActiveChannel('general');
    expect(getStoreState().activeChannelId).toBe('general');

    // Confirm that the message successfully transitioned to 'sent'
    const genMessages = getStoreState().messages['general'];
    const target = genMessages.find((m) => m.id === inFlightMsg.id);
    expect(target).toBeDefined();
    expect(target?.status).toBe('sent');
    expect(target?.content).toBe(text);
  });

  // =========================================================================
  // Scenario 4: Whitespace & Empty Submission Rejection
  // User enters whitespace or empty text, submits, verifies message is not appended
  // and store is unmodified. Then sends valid message.
  // =========================================================================
  it('Scenario 4: Validation guard: Empty and whitespace strings rejected -> valid message accepted and delivered', async () => {
    const initialCount = getStoreState().messages['general'].length;

    // 1. Attempt empty string
    useWorkspaceStore.getState().sendMessage('general', '');
    expect(getStoreState().messages['general'].length).toBe(initialCount);

    // 2. Attempt multi-spaces
    useWorkspaceStore.getState().sendMessage('general', '     ');
    expect(getStoreState().messages['general'].length).toBe(initialCount);

    // 3. Attempt mixed whitespace (tabs, newlines, spaces)
    useWorkspaceStore.getState().sendMessage('general', '\n\t   \t\n');
    expect(getStoreState().messages['general'].length).toBe(initialCount);

    // 4. Submit valid message with leading/trailing spaces: should trim and accept
    const validRaw = '   Hello world with whitespace padding!   ';
    useWorkspaceStore.getState().sendMessage('general', validRaw);
    expect(getStoreState().messages['general'].length).toBe(initialCount + 1);

    const latest = getStoreState().messages['general'].slice(-1)[0];
    expect(latest.content).toBe('Hello world with whitespace padding!');
    expect(latest.status).toBe('sending');

    await waitForMessageSent('general', latest.id, 2000);
    expect(getStoreState().messages['general'].slice(-1)[0].status).toBe('sent');
  });

  // =========================================================================
  // Scenario 5: Full Workspace Navigation Tour
  // User navigates through all 4 channels, sends messages in each,
  // verifies channel-scoped message isolation across all channels.
  // =========================================================================
  it('Scenario 5: Full Workspace Navigation Tour: Traverse all channels, post messages, verify total channel isolation', async () => {
    const channels = ['general', 'random', 'announcements', 'development'];
    const sentMessages: Record<string, string> = {};

    for (const channelId of channels) {
      // Navigate to channel
      useWorkspaceStore.getState().setActiveChannel(channelId);
      expect(getStoreState().activeChannelId).toBe(channelId);

      // Post channel-specific message
      const msgContent = `Tour message for #${channelId} at ${Date.now()}`;
      useWorkspaceStore.getState().sendMessage(channelId, msgContent);

      const latest = getStoreState().messages[channelId].slice(-1)[0];
      expect(latest.content).toBe(msgContent);
      expect(latest.channelId).toBe(channelId);
      expect(latest.status).toBe('sending');

      sentMessages[channelId] = latest.id;
    }

    // Wait for all messages across all channels to resolve
    for (const channelId of channels) {
      await waitForMessageSent(channelId, sentMessages[channelId], 2500);
    }

    // Deep isolation verification: verify each message exists ONLY in its own channel
    for (const targetChannel of channels) {
      const targetId = sentMessages[targetChannel];

      for (const otherChannel of channels) {
        const contains = getStoreState().messages[otherChannel].some((m) => m.id === targetId);
        if (otherChannel === targetChannel) {
          expect(contains).toBe(true);
        } else {
          expect(contains).toBe(false);
        }
      }
    }
  });

  // =========================================================================
  // Scenario 6: Rich Content Delivery (Markdown, Emojis, URLs)
  // User sends messages containing rich content (links, code snippets, emojis),
  // verifies correct storage, state transitions, and preservation.
  // =========================================================================
  it('Scenario 6: Rich Content Delivery: Code snippets, emojis, and hyperlinks preserve exact characters across delivery', async () => {
    const richSnippets = [
      'Check out the docs: https://nextjs.org/docs/app 🚀',
      'Here is the function:\n```typescript\nconst add = (a: number, b: number) => a + b;\n```',
      'Great work team! 🎉💯🙌',
    ];

    for (const snippet of richSnippets) {
      useWorkspaceStore.getState().sendMessage('development', snippet);
      const latest = getStoreState().messages['development'].slice(-1)[0];
      expect(latest.content).toBe(snippet);
      await waitForMessageSent('development', latest.id, 2000);
      const verified = getStoreState().messages['development'].find((m) => m.id === latest.id);
      expect(verified?.status).toBe('sent');
      expect(verified?.content).toBe(snippet);
    }
  });
});
